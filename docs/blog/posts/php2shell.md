---
date: 2026-10-26
authors: [barbacana]
categories:
  - detection
  - research
---

# Can't upgrade PHP? Block PHP2Shell with a WAF

In October 2026, PHP disclosed two critical remote code execution (RCE) vulnerabilities, CVE-2026-109618 and CVE-2026-109619, together named "PHP2Shell". The only complete fix is to upgrade PHP. The versions most exposed are the ones that cannot be upgraded: PHP 7 and older are end-of-life and get no official patch, even though they share the same vulnerable code. This post summarizes the vulnerabilities, shows how far a web application firewall (WAF) can protect an application that has to stay on an unsupported version, and where that protection stops.

<!-- more -->


## Upgrade PHP first

A WAF does not remove a vulnerability. It only blocks the requests that try to exploit it. Every vendor that published guidance says the same thing:

- [Cloudflare](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/) deployed protections for its customers and states that WAF rules are defense in depth. Its advice is to patch PHP.
- [AWS](https://aws.amazon.com/blogs/security/using-aws-waf-to-apply-mitigations-for-php2shell-rce-vulnerabilities-cve-2026-109618-and-cve-2026-109619/) published managed and custom AWS WAF rules. It states that a WAF lowers the risk for applications that accept multipart uploads but does not remove it, and that patching is the only complete fix.

The fixed PHP versions are:

| Branch | Fixed version |
| ------ | ------------- |
| 8.2    | 8.2.35        |
| 8.3    | 8.3.36        |
| 8.4    | 8.4.27        |
| 8.5    | 8.5.12        |

Versions 5.4 to 8.1 get no official fix. The vulnerable code is the same across these versions, so PHP 7 behaves like PHP 8. If you must stay on an unsupported version, a WAF in front of the application is the most practical stopgap.

## The two vulnerabilities

|                | CVE-2026-109618                                                    | CVE-2026-109619                                                  |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Advisory       | GHSA-w8hw-w9fx-j79w                                                | GHSA-6wmf-4rv5-p3rp                                              |
| Class          | Out-of-memory (OOM) handling leaves the engine in an invalid state | Stale global state is reused across requests in a PHP-FPM worker |
| Severity       | CVSS 9.2 (critical)                                                | CVSS 9.2 (critical)                                              |
| Authentication | Not required                                                       | Not required                                                     |

Both affect PHP from 5.4.0 up to 8.5.11. Both start in `session.upload_progress`, a PHP feature that is on by default. When a multipart request contains a field named `PHP_SESSION_UPLOAD_PROGRESS`, PHP records upload progress in a session file while it parses the body. This happens before application code runs, even if the application never calls `session_start()`.

Upgrading PHP does not remove every risk. Even a fixed PHP version stores the raw file names of uploads in the session file, so PHP code written into a file name can still lead to code execution if the application has a local file inclusion (LFI) flaw.

For the full technical analysis, including the six defects in the PHP source and what the patch changes, read:

- [Qi Deng's PHP2Shell write-up](https://qideng.substack.com/p/php2shell-dissecting-phps-critical), the original research.
- The PHP advisories [GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [GHSA-6wmf-4rv5-p3rp](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp), for affected versions and the official fix.
- [ikow/php2shell-poc](https://github.com/ikow/php2shell-poc), the public proof of concept.

## What a WAF can see

Most of the attack surface is in the request. These request shapes stand out:

- A multipart `POST` that contains a field named `PHP_SESSION_UPLOAD_PROGRESS`. This is the entry point for the attacks that go through the session file. Normal applications almost never send it.
- A multipart body with an extreme number of part headers.
- A multipart body with many file parts that have an empty file name.
- A very large body with no declared length.

A WAF cannot see these parts:

- An unsafe `unserialize()` call, or the file inclusion step of the session-file attack, happens in the application's own code.
- The step of CVE-2026-109619 that reads the stale state happens inside the PHP worker.
- If the application uses a different `session.upload_progress.name`, requests do not contain the default field name.

AWS and Cloudflare make the same points. AWS notes that its rules cannot parse the internal structure of multipart bodies and that header amplification below its size limit is not caught. Cloudflare notes that sites that changed `session.upload_progress.name` are not covered by its rule.

## Protections in Barbacana

Barbacana 0.10.0 adds three protections to the [WAF Protection Catalog](../../reference/catalog.md). All are on by default.

| Leaf                                    | What it blocks                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `php-php2shell-session-upload-progress` | A `POST` that carries the `PHP_SESSION_UPLOAD_PROGRESS` field. This covers the attacks that go through the session file. |
| `php-php2shell-part-headers`            | A multipart body with more than 4000 part header lines in total, or a part whose header block is too large to parse.     |
| `php-php2shell-empty-file-controls`     | A multipart body with more than 20 empty file controls. 20 is the PHP default for `max_file_uploads`.                    |

Bodies with no declared length are buffered up to the `accept.max_body_size` limit (10 MB by default) and rejected with `413` when they exceed it, in every mode, so a chunked stream cannot grow without a limit. The request-body rules inspect bodies sent with `Transfer-Encoding: chunked` the same way as any other body.

A block means the request has the shape of the attack. It does not mean that PHP was exploited.

To turn off one of these leaves for a route, use `disable:`:

```yaml
routes:
  - match:
      paths: ["/uploads"]
    upstream: http://app:9000
    disable:
      - php-php2shell-empty-file-controls   # form has 30 optional file inputs
```

Disabling a leaf removes the block at the edge. It does not change the vulnerability in PHP.

## How we tested this

We validated the protections against the public proof-of-concept lab, [ikow/php2shell-poc](https://github.com/ikow/php2shell-poc), running the repository's own exploit and verifier scripts unmodified. The lab runs the vulnerable PHP 8.2.34, the end-of-life 7.4.33 (which has no official fix), and Apache mod_php 8.2.34, with Barbacana in front in blocking mode. Everything ran on `127.0.0.1` only, in containers without extra privileges.

### Every vector was blocked before it reached PHP

- Without Barbacana, the session-file exploits ran code on PHP 8.2.34 and 7.4.33. With Barbacana in front, they did nothing.
- Barbacana rejected the memory-exhaustion requests.

A clean multipart upload still passes, and disabling the protections re-opens the attack, which shows the blocks come from these protections. If you run an application that cannot be upgraded, put a WAF in front of it.

## Known weaknesses

We list the limits here so that you can decide what else to put in place. Each is something you can act on as an operator.

1. **Renamed progress field.** If your application sets `session.upload_progress.name` to another value, `php-php2shell-session-upload-progress` does not match it. Change the setting back to the default, or turn the feature off with `session.upload_progress.enabled = 0`.
2. **Large bodies that are not multipart.** A multipart upload of any size up to `accept.max_body_size` is inspected, because the contents of uploaded files do not count against `max_inspect_size` (128 KB by default). A body that is not multipart, such as a raw `PUT` upload, is rejected with `413` when it is larger than `max_inspect_size`. For routes that need such bodies, raise the limit or disable `resource-limits-max-inspection-size` on that route. With the protection disabled, only the first `max_inspect_size` bytes are inspected.
3. **Application-level flaws.** An unsafe `unserialize()` call and the file inclusion step of the session-file attack happen in your application code, not in the request. A WAF cannot see them. Only upgrading PHP and fixing the file inclusion flaw close them.

## Final thoughts

The most effective step is to upgrade PHP to a fixed version. The steps below are for applications that cannot do that yet.

1. Put Barbacana in front of the application. To check for false positives first, run the route in [detect-only mode](../../reference/detect-only.md).
2. Set `session.upload_progress.enabled = 0` in `php.ini` and restart PHP. This makes CVE-2026-109619 harder to exploit, but it does not fix CVE-2026-109618.
3. If your application does not need file uploads, leave `multipart/form-data` out of `accept.content_types` on those routes.
4. Set `accept.max_body_size` to the largest body your application needs.
5. On PHP 8.5, AWS also recommends setting `fatal_error_backtraces=0`. Check the AWS post for the reason and the exact scope.
6. Add alerts for `Allowed memory size ... exhausted` and `Session object destruction failed` in your application logs, and for bursts of HTTP 502 responses from PHP-FPM.
7. Plan the upgrade to a fixed version, or a vendor backport for versions without official support.
8. To get help with these steps, ask your AI coding agent. Install the [Barbacana skills](../../getting-started/ai-agents.md) and give the agent the link to this post.

## Sources

- [AWS: Using AWS WAF to apply mitigations for PHP2Shell RCE vulnerabilities](https://aws.amazon.com/blogs/security/using-aws-waf-to-apply-mitigations-for-php2shell-rce-vulnerabilities-cve-2026-109618-and-cve-2026-109619/)
- [Cloudflare: protections against the php2shell vulnerability](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/)
- [Qi Deng: PHP2Shell write-up](https://qideng.substack.com/p/php2shell-dissecting-phps-critical)
- [PHP security advisory GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) (CVE-2026-109618)
- [PHP security advisory GHSA-6wmf-4rv5-p3rp](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) (CVE-2026-109619)
- [Public lab proof-of-concept with WAF bypass notes](https://github.com/dinosn/php-cve-2026-10961x-lab-poc)
- [Public proof-of-concept repository — ikow/php2shell-poc](https://github.com/ikow/php2shell-poc)
