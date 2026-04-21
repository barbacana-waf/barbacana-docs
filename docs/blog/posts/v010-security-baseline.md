---
date: 2026-04-22
authors: [barbacana]
categories:
  - security
  - releases
---

# v0.1.0 Security Baseline: What Barbacana Catches, What It Misses, and What Comes Next

Barbacana v0.1.0 is out. Right after the release, two independent test suites were run to measure what the WAF catches and what it misses. For a first release, the numbers are good: 99.7% on the OWASP CRS v4 conformance tests, 100% on API Security, and 90.78% of legitimate traffic allowed through. The full results are published below, without any filtering. It is more useful to know where detection fails than to publish a clean summary.

<!-- more -->

## CRS conformance

The [OWASP CRS regression suite](https://github.com/coreruleset/go-ftw) (go-ftw) checks that every detection rule triggers correctly on the attack it is designed to catch. The run against Barbacana v0.1.0 produced these results:

- **4,711** tests run
- **4,698** passed
- **13** failed
- **0** skipped

That is **99.7% conformance** with the OWASP CRS v4 test corpus. The 13 failing cases are tracked in the source repository.

## Attack simulation

[GoTestWAF](https://github.com/wallarm/gotestwaf) goes further. It sends hundreds of real attack payloads and evasion techniques across the main OWASP categories. The results for v0.1.0, by category:

| Category        | Blocked | Total | Rate |
|-----------------|---------|-------|------|
| xml-injection   | 7       | 7     | 100% |
| crlf            | 6       | 7     | 86%  |
| sql-injection   | 23      | 48    | 48%  |
| xss-scripting   | 92      | 224   | 41%  |
| shell-injection | 13      | 32    | 41%  |
| path-traversal  | 8       | 20    | 40%  |
| nosql-injection | 19      | 50    | 38%  |
| ldap-injection  | 8       | 24    | 33%  |
| sst-injection   | 6       | 24    | 25%  |
| mail-injection  | 6       | 24    | 25%  |
| rce-urlpath     | 0       | 3     | 0%   |

The overall true-positive rate across all categories is **54.8%**. That number looks low on its own. The rest of this post explains why it is misleading without context.

## The base64 encoding story

Most of the misses are caused by one specific thing: base64 encoding. **71% of the payloads that the security rules did not catch had been encoded in base64 by the test suite before being sent.** The test takes an attack payload, encodes it in base64, and sends it as the value of a parameter. The rules never see the original attack, so they cannot match any pattern against it. Automatic decoding of every parameter is not a safe solution either, because a lot of legitimate traffic is also base64: JWTs, API keys, file uploads, and session tokens are all valid base64 values.

If the base64 payloads are removed from the count, and only plain or URL-encoded ones are considered — which is how most real attacks arrive — the numbers are very different:

| Category        | Raw rate | Excluding base64 |
|-----------------|----------|------------------|
| sql-injection   | 48%      | 82%              |
| xss-scripting   | 41%      | 82%              |
| ss-include      | 50%      | 100%             |
| shell-injection | 41%      | 65%              |
| path-traversal  | 40%      | 67%              |

## The curated rule set approach

A common design in other WAFs is to offer a sensitivity setting and let each user choose a level. Barbacana does the opposite. Every detection rule was reviewed one by one. Rules from the higher detection tiers were added only when they produced few false positives on real-world traffic. The result is a rule set that catches more than the CRS baseline, without raising the false-positive rate.

The reason to avoid such a setting is simple. Raising it without enough knowledge of the traffic will start to block legitimate requests. When that happens, the common reaction is to disable whole protection categories, which leaves the application less protected than it was at the default level. It is better to make these decisions once, and to make them carefully, so that users can focus on their application and not on the WAF.

The false-positive score confirms that this approach works: **90.78% of legitimate test traffic passes through without being blocked**. The 9% that does get blocked comes from examples like "union was a great select" or "ls 300 lexus" — ordinary English sentences that contain SQL or shell keywords by coincidence. This kind of false match is a well-known limitation of pattern-based detection, not something specific to Barbacana.

## Structural limitations

A few gaps remain no matter how the rule set is tuned, because the underlying engine does not inspect some parts of the request:

- **URL path content.** Rules inspect parameters and headers, but not the segments of the URL path.
- **Template injection (SSTI).** Coverage of Jinja2, Freemarker, and ERB expression syntax is limited.
- **LDAP injection.** Affected by the same blind spot as URL path content.
- **Base64-encoded payloads.** Needs a dedicated decoding stage, not more rules.

None of these are bugs. They are the limits of pattern-based detection. Each one has a clear technical solution, and each one is a priority for future work.

### OpenAPI as a security multiplier

Routes that come with an OpenAPI spec receive much stronger protection than routes without one. Any request that does not match the declared schema — an unknown path, an unknown parameter, the wrong type, a value outside the allowed range — is rejected before any rule runs. For sensitive endpoints, adding an OpenAPI spec is by far the single most useful configuration change that can be made.

None of the numbers above account for this. The test suites ran against a deployment with no schema declared, so every request reached the rule engine. With a spec in place, many of the bypasses listed in the report would be rejected during schema validation and would never reach the rules at all. Real deployments should expect significantly better coverage than these raw numbers suggest.

Path traversal is a clear example. The category shows only 40% blocked (12 of 20 payloads got through), and most of those bypasses use payloads like `../../etc/passwd` placed inside a parameter value. If the OpenAPI spec declares that parameter as a filename made of letters and digits only, the request is rejected at schema validation because `../` does not match the allowed pattern. The rule engine never sees it. The same applies to rce-urlpath, where 0 of 3 attacks were blocked: those attacks inject shell commands into the URL path itself, but as soon as the valid paths are declared in the spec, anything that does not match is rejected as an unknown route.

## What these results mean for the roadmap

The next step is already defined. Barbacana will continue to ship a single curated rule set, but the set will be larger. Dozens of rules from the higher detection tiers will be added on top of today's baseline. Each rule is reviewed individually and adjusted so that its pattern matches only real attack indicators. This increases detection without the sudden rise in false positives that usually comes with a higher sensitivity setting.

The sub-protection catalog is also being reorganized so that its groupings match the way CRS v4.25 organizes its own rules. Several Unix-command protections will be merged into one, and the same will be done for the mail-protocol protections and for the PHP stream-wrapper protections. SSRF will be split into two separate protections. Two existing entries will be renamed to make them clearer.

Other improvements are also being explored. Parameter decoding can be made smarter so that common encodings no longer hide attacks from the rules. URL path content could be inspected directly, rather than depending on OpenAPI for that coverage. For protocols, GraphQL support is planned and will rely on schema validation to reject malformed or out-of-schema operations before they reach any rule. gRPC support is also planned, although its binary format and streaming model make it harder to inspect than HTTP and JSON.

All of these changes will be measured by the same two test suites, which run in CI on every release. The results stay transparent: every change will show whether detection is actually improving and whether the false-positive rate remains stable.

No specific timelines are attached to any of this. What ships, and in what order, will be decided by the test data.

## Closing

Honest numbers are more useful than inflated ones. A realistic 55% with full context says more than a marketing 99% without it.

---

The raw reports behind the numbers above are available for download:

- [GoTestWAF report (PDF)](assets/gotestwaf-v0.1.0-report.pdf) — full attack-simulation results.
- [go-ftw summary (text)](assets/ftw-v0.1.0-summary.txt) — CRS conformance test output.

*AI assisted with analyzing the report data and writing this post. Everything is human-reviewed.*
