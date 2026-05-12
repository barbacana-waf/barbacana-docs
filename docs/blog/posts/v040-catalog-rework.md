---
date: 2026-05-04
authors: [barbacana]
categories:
  - releases
  - breaking-changes
---

# v0.4.0: Easier to configure, with new opt-in aggressive rules

This release makes Barbacana easier to configure. Protection names are rewritten in plain language, the rule catalog is reorganized into a three-level tree, and aggressive rules with high false-positive rates move to a new opt-in `enable:` list. A few security headers that were breaking apps in surprising ways are now off by default. A latent bug that prevented response-side detection from running is fixed. Detection rates on the request side are practically unchanged.

This is a breaking change, but the migration is straightforward.

<!-- more -->

## What changed in the catalog

The old catalog was flat: one category like `sql-injection`, with about 15 sub-protections under it. The names came from CRS authors (`xss-libinjection`) or used short jargon (`lfi`, `rfi`, `rce`). They rarely told an operator what a rule did, or when to turn it off.

The new catalog has **three levels**, and the names are written for the person running the WAF:

```
sql                                       (L1 family)
├── sql-injection                         (L2 bucket)
│   ├── sql-injection-union-select        (leaf)
│   ├── sql-injection-time-based          (leaf)
│   ├── sql-injection-quotes-in-text      (leaf, off-by-default)
│   └── … 22 more
└── sql-data-leakage                      (L2 bucket)
    ├── sql-data-leakage-mysql            (leaf)
    └── … 15 vendor-specific protections
```

Both `disable:` and the new `enable:` list accept any of the three levels. The rule is simple: **the most specific wins**. A leaf in `enable:` overrides its family in `disable:`, and a leaf in `disable:` overrides its family in `enable:`. One rule, no surprises.

Each leaf has a short *what it does*, *why disable*, and *why enable* note written for an operator. Run `barbacana --catalog-leaf <leaf>` on the binary to read them, or `barbacana --catalog` to print the whole tree as markdown.

## Aggressive rule variants are now opt-in

Before v0.4.0, false-positive-prone variants were bundled with their cleaner counterparts under one switch. Disabling `sql-injection` to silence false positives on `O'Brien`-style names also turned off time-based and union-select detection. There was no way to address the false positive without losing the rest of the category.

In v0.4.0, the error-prone variants are **turned off by default, but can be enabled**, each with a `Why enable` note. Examples:

- `sql-injection-quotes-in-text` — catches real auth-bypass attacks, but also flags every `O'Brien` in a customer list.
- `command-injection-english-words` — triggers on plain text containing `echo`, `curl`, or `bash`.
- `cross-site-scripting-angular-templates` — only useful when the server renders Angular templates.

Turn them on per route with `enable: [<leaf-name>]`. The `enable:` list is the opposite of `disable:` — same shape, same precedence rule. Default behavior is conservative; the high-recall variants are available where they pay off.

## Six security headers are now off by default

CSP, COOP, COEP, CORP, Permissions-Policy, and Cache-Control are no longer added by default. They share one problem: they break most of the apps they protect, and a weak default value is worse than no header. Operator feedback was clear — web apps broke, and the cause was hard to find. The table below explains why each header flipped.

| Header | Why off by default |
|---|---|
| `Content-Security-Policy` | Inline scripts, third-party origins, and frame ancestors are different in every app. A weak default CSP is worse than no CSP. |
| `Cross-Origin-Opener-Policy` | Strict values break OAuth popup flows and `window.opener` integrations. |
| `Cross-Origin-Embedder-Policy` | Requires every cross-origin resource to opt in via CORP/CORS — most apps break immediately. |
| `Cross-Origin-Resource-Policy` | The safe default value gives no real protection. Stricter values block legitimate embedding. |
| `Permissions-Policy` | Any policy strong enough to be useful also blocks legitimate features (camera, microphone, payment). |
| `Cache-Control` | Cache policy depends on the route. It belongs in the app or CDN, not in the WAF. |

Two HTTP-compliance protections are also off by default now: `http-compliance-accept-header` and `http-compliance-user-agent-header`. An empty `Accept` or a missing `User-Agent` is normal for `curl`, internal service-to-service calls, and SDK clients. Flagging them only signals that a request is automated, not that it is an attack.

The five strict-default headers (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`) are still added by default. The eleven leaky-header strippers (`Server`, `X-Powered-By`, …) still strip by default.

## Response-side detection now actually runs

This behavior change is a bug fix.

Earlier versions shipped several default-on response-side protections in the catalog — `web-shell-detection`, every `sql-data-leakage-*` vendor variant, `ruby-data-leakage-version-info`, and others. The catalog said they were active. They were never running, because no response-phase pipeline existed. This is now fixed.

v0.4.0 adds the response-phase pipeline. Those rules now fire as the catalog has always claimed they would. Operators upgrading from v0.3.x and earlier should expect to see new entries in audit logs and metrics:

- Web-shell signatures matching response bodies (rules `955100`–`955400`, 27 known shell families).
- SQL error patterns from MySQL, MSSQL, PostgreSQL, Oracle, DB2, MS Access, Sybase, etc.
- PHP, Ruby, Java, IIS version-info leaks in response bodies and headers.

Nothing in the catalog changed for these protections — only the runtime caught up to it. If a route surfaces noise from a vendor that does not match its actual backend (for example, MSSQL error patterns on a MySQL-only app), turn off the unused vendor leaf:

```yaml
disable:
  - sql-data-leakage-mssql
```

## Detection: request-side unchanged, response-side activated

A release that mostly renames and reorganizes should not change request-side behavior. The [GoTestWAF](https://github.com/wallarm/gotestwaf) attack suite was run against v0.4.0 with the default config — no `enable:` overrides, so the new opt-in aggressive protections stay off — and compared to v0.3.2.

| Metric | v0.3.2 | v0.4.0 |
|---|---:|---:|
| Overall score | 86.20% | 86.16% |
| Application security (attacks blocked) | 54.0% | 53.9% |
| API security (attacks blocked) | 100% | 100% |
| Legitimate traffic allowed through | 90.78% | 90.78% |

The numbers are flat for request-side detection. That is the result the rename was meant to preserve. GoTestWAF's payload mix exercises request-side detection almost exclusively, which is why the response-side activation does not show up in this table — but it is a real behavior change, just not one this suite measures.

Across all OWASP and API categories, only one row moved:

| Category | v0.3.2 | v0.4.0 | Δ |
|---|---:|---:|---:|
| xss-scripting | 92 / 224 (41.07%) | 90 / 224 (40.18%) | −0.89pp |

Two XSS payloads that used to match a noisy variant no longer match by default, because that variant moved from on-by-default to a named opt-in leaf — specifically `cross-site-scripting-angular-templates` and `cross-site-scripting-css-style-injection`. Routes that need either can turn it back on via `enable:`.

The number to focus on is the **rate of legitimate traffic allowed through, which stayed at 90.78%**. Most of the misses come from one specific cause: **base64-encoded payloads**. The [v0.1.0 baseline post](v010-security-baseline.md) has the full breakdown.

Raw reports:

- v0.4.0: [PDF report](assets/gotestwaf-v0.4.0-report.pdf) · [JSON report](assets/gotestwaf-v0.4.0-report.json)
- v0.3.2: [PDF report](assets/gotestwaf-v0.3.2-report.pdf) · [JSON report](assets/gotestwaf-v0.3.2-report.json)

## Migration recipe

There is no migration tool — the rename is straightforward, the catalog is generated from the binary, and the validator catches mistakes at startup.

1. Apply the rename table to existing `disable:` entries.
2. Decide whether to enable any of the six default-off response headers. Add them to `enable:` or supply a tuned value via `inject:`.
3. Audit logs and dashboards for new response-side detections after the upgrade.
4. Re-pin Prometheus alerts that match `protection=` labels — every label value changed.
5. Run `barbacana --validate` against the new config.

## Before → after rename map (selection)

The full list has about 125 protections. The selection below covers most production configs. The first column is what an old config and dashboards use; the second is what to put in a v0.4.0 config and Prometheus alerts.

### Native protections

| v0.3.x | v0.4.0 |
|---|---|
| `request-smuggling` | `http-attacks-request-smuggling` |
| `crlf-injection` | `http-attacks-header-crlf-injection` |
| `null-byte-injection` | `http-compliance-null-bytes` |
| `method-override` | `http-compliance-method-override-param` (now off-by-default) |
| `double-encoding` | `http-compliance-double-url-encoding` (now off-by-default) |
| `unicode-normalization` | `http-compliance-utf8-tricks` |
| `path-normalization` | `local-file-access-dot-dot-paths` |
| `max-body-size` | `request-validation-max-body-size` |
| `max-url-length` | `request-validation-max-url-length` |
| `max-header-size` | `request-validation-max-header-size` |
| `max-header-count` | `request-validation-max-header-count` |
| `allowed-methods` | `request-validation-allowed-methods` |
| `require-host-header` | `request-validation-require-host-header` |
| `require-content-type` | `request-validation-require-content-type` |
| `multipart-file-limit` | `file-upload-limits-max-file-count` |
| `multipart-file-size` | `file-upload-limits-max-file-size` |
| `multipart-allowed-types` | `file-upload-limits-allowed-types` |
| `multipart-double-extension` | `file-upload-limits-double-extension` |
| `json-depth-limit` | `json-parsing-max-depth` |
| `json-key-limit` | `json-parsing-max-keys` |
| `xml-depth-limit` | `xml-parsing-max-depth` |
| `xml-entity-expansion` | `xml-parsing-entity-expansion` |
| `max-inspection-size` | `resource-limits-max-inspection-size` |
| `max-memory-buffer` | `resource-limits-max-memory` |
| `decompression-ratio-limit` | `resource-limits-decompression-ratio` |

### Response headers (inject)

| v0.3.x | v0.4.0 | Default |
|---|---|---|
| `header-hsts` | `response-headers-add-hsts` | on |
| `header-x-frame-options` | `response-headers-add-frame-options` | on |
| `header-x-content-type-options` | `response-headers-add-nosniff` | on |
| `header-referrer-policy` | `response-headers-add-referrer-policy` | on |
| `header-x-dns-prefetch` | `response-headers-add-dns-prefetch` | on |
| `header-csp` | `response-headers-add-csp` | **off** |
| `header-coop` | `response-headers-add-coop` | **off** |
| `header-coep` | `response-headers-add-coep` | **off** |
| `header-corp` | `response-headers-add-corp` | **off** |
| `header-permissions-policy` | `response-headers-add-permissions-policy` | **off** |
| `header-cache-control` | `response-headers-add-cache-control` | **off** |

### Response headers (strip)

| v0.3.x | v0.4.0 |
|---|---|
| `strip-server` | `response-headers-remove-server` |
| `strip-x-powered-by` | `response-headers-remove-powered-by` |
| `strip-aspnet-version` | `response-headers-remove-aspnet-version` |
| `strip-generator` | `response-headers-remove-generator` |
| `strip-drupal` | `response-headers-remove-drupal` |
| `strip-varnish` | `response-headers-remove-varnish` |
| `strip-via` | `response-headers-remove-via` |
| `strip-runtime` | `response-headers-remove-runtime` |
| `strip-debug` | `response-headers-remove-debug` |
| `strip-backend-server` | `response-headers-remove-backend-server` |
| `strip-version` | `response-headers-remove-version` |

### OpenAPI

| v0.3.x | v0.4.0 |
|---|---|
| `openapi-path` | `openapi-path-not-in-spec` |
| `openapi-method` | `openapi-method-not-in-spec` |
| `openapi-params` | `openapi-parameter-mismatch` |
| `openapi-body` | `openapi-body-mismatch` |
| `openapi-content-type` | `openapi-content-type-not-in-spec` |

### CRS-side examples

The CRS-backed protections all gained an L1 prefix and lost the CRS-author-flavored names. A representative subset:

| v0.3.x | v0.4.0 |
|---|---|
| `sql-injection-union` | `sql-injection-union-select` |
| `sql-injection-auth-bypass` | `sql-injection-login-bypass` |
| `data-leakage-sql-mysql` | `sql-data-leakage-mysql` |
| `data-leakage-php-info` | `php-data-leakage-version-info` |
| `data-leakage-php-source` | `php-data-leakage-source-code` |
| `data-leakage-java-error` | `java-data-leakage-stack-trace` |
| `data-leakage-iis-info` | `iis-data-leakage-version-headers` |
| `php-open-tag` | `php-injection-open-tags` |
| `php-stream-wrapper` | `php-injection-stream-wrappers` |
| `php-object-injection` | `php-injection-serialized-objects` |
| `php-function-high-risk` | `php-injection-dangerous-functions` |
| `java-class-loading` | `java-injection-class-and-method-names` |
| `java-deserialization` | `java-injection-serialized-objects` |
| `java-log4j` | `java-injection-log4shell` |
| `lfi-path-traversal` | `local-file-access-dot-dot-paths` |
| `lfi-system-files` | `local-file-access-os-files` |
| `lfi-restricted-files` | `local-file-access-dotfiles` |
| `protocol-attack-smuggling` | `http-attacks-request-smuggling` (merged with native) |
| `protocol-attack-header-injection` | `http-attacks-header-crlf-injection` (merged with native) |
| `protocol-attack-response-splitting` | `http-attacks-response-splitting` |
| `protocol-attack-ldap-injection` | `ldap-injection` (promoted to L1) |
| `protocol-attack-parameter-pollution` | `http-attacks-duplicate-parameters` (now off-by-default) |
| `protocol-enforcement-accept-header` | `http-compliance-accept-header` (now off-by-default) |
| `protocol-enforcement-user-agent-header` | `http-compliance-user-agent-header` (now off-by-default) |
| `protocol-enforcement-null-byte` | `http-compliance-null-bytes` (merged with native) |
| `protocol-enforcement-method-override` | `http-compliance-method-override-param` (merged with native) |
| `multipart-attack-content-type` | `file-upload-attacks-content-type` |
| `multipart-attack-header-chars` | `file-upload-attacks-header-chars` |

For names not listed, run `barbacana --catalog` against the v0.4.0 binary to print the full tree, or `barbacana --catalog-leaf <leaf-name>` to read a single leaf's rationale and CWE mappings.

*AI assistance was used to analyze the GoTestWAF report data and draft the structure of this post; the final text was reviewed by a human.*
