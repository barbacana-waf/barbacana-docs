---
date: 2026-05-07
authors: [barbacana]
categories:
  - releases
  - detection
---

# v0.5.0: Base64 decoding and a new XSS detector

v0.5.0 closes the largest detection gap in the v0.1.0 baseline — base64-encoded payloads — and adds three native rules for an XSS evasion shape no upstream CRS rule covers. [GoTestWAF](https://github.com/wallarm/gotestwaf) moves from **86.16% to 93.65% overall**, with the false-positive rate unchanged at 90.78%. CRS conformance under [go-ftw](https://github.com/coreruleset/go-ftw) holds at **99.75%** (4,726 of 4,738 tests pass).

<!-- more -->

GoTestWAF is an open-source WAF benchmark maintained by Wallarm. It sends a fixed set of attack payloads — grouped by OWASP category, with an additional community-contributed test set — plus a corpus of legitimate-traffic requests, and reports both the share of attacks the WAF blocked and the share of legitimate requests it allowed through. The headline overall score combines the two.

## Base64 decoding

The [v0.1.0 baseline post](v010-security-baseline.md) named the single biggest miss: 71% of bypassed payloads had been base64-encoded by the test suite, so the rules never saw the actual attack. v0.5.0 adds the missing stage. The pipeline scans the URL path, query parameters, and the request body for runs of base64-alphabet characters, decodes the printable ones, and feeds them to CRS as synthetic ARGS. The original request bytes are never modified — the upstream still receives what the client sent.

Each surface can be disabled independently for routes that carry base64 that could be flagged by the WAF (JWT-bearing endpoints, signed-payload APIs, inline-image uploads):

- `base64-decoding-path` — segments of the URL path
- `base64-decoding-parameters` — query-parameter values
- `base64-decoding-body` — runs found in the buffered body

A fourth leaf, `base64-decoding-flood`, blocks requests with more than 50 successful decodes — bounding worst-case work and catching obvious DoS attempts.

## XSS function-call evasion

A new leaf — `cross-site-scripting-function-call-evasion` — covers a shape no upstream CRS rule catches at any paranoia level: function-call wrappers around dangerous JavaScript globals.

```
alert.call(null, 1)   // Function.prototype.call
(alert)(1)            // grouping-paren wrap
alert?.(1)            // optional-chaining call
```

Three Barbacana-owned Coraza rules in the 210000 ID range catch all three shapes. They scan the same surfaces as the CRS PL1 XSS baseline (cookies, User-Agent, ARGS, REQUEST_FILENAME, XML) and contribute to the same anomaly score, so they compose with the rest of the engine without any extra wiring.

## The GoTestWAF numbers

| Metric | v0.4.0 | v0.5.0 | Δ |
|---|---:|---:|---:|
| Overall score | 86.16% | 93.65% | +7.49pp |
| Application security (attacks blocked) | 53.86% | 83.81% | +29.95pp |
| API security (attacks blocked) | 100% | 100% | — |
| Legitimate traffic allowed through | 90.78% | 90.78% | — |

OWASP categories with significant movement:

| Category | v0.4.0 | v0.5.0 | Δ |
|---|---:|---:|---:|
| xss-scripting | 40.18% | 97.77% | +57.59pp |
| ss-include | 50.00% | 100% | +50.00pp |
| sql-injection | 47.92% | 81.25% | +33.33pp |
| mail-injection | 33.33% | 66.67% | +33.33pp |
| sst-injection | 25.00% | 58.33% | +33.33pp |
| nosql-injection | 38.00% | 62.00% | +24.00pp |
| path-traversal | 40.00% | 60.00% | +20.00pp |
| shell-injection | 40.63% | 59.38% | +18.75pp |

Splitting the lift between the two changes: base64 decoding alone reaches 92.06% overall, and `xss-scripting` lands at 79.91%. Adding the function-call evasion rules pushes `xss-scripting` from 79.91% to 97.77% and the overall score to 93.65%. Base64 decoding drives most of every other category's movement — the rules were already there; they finally see the payloads.

## What did not move

`ldap-injection` (33.33%), `rce-urlparam` (33.33%), and `rce-urlpath` (0/3) are unchanged. All three hit the same structural limitation called out in the baseline post: the engine does not inspect the segments of the URL path. An OpenAPI spec closes that gap on a per-route basis — schema validation rejects unknown paths and parameter shapes before the rule engine runs.

## False positives stayed flat

The base64 stage decodes opportunistically — it scans for runs of base64-alphabet characters, accepts only printable UTF-8 decodes, and emits synthetic ARGS instead of rewriting the request. The legitimate-traffic corpus is unchanged from v0.4.0: still 13 of 141 false-positive matches (90.78%), all from the same English-keyword overlap pattern documented in the baseline post.

## CRS conformance still 99.7%

The OWASP CRS regression suite ([go-ftw](https://github.com/coreruleset/go-ftw)) checks every detection rule against the attack it is designed to catch. Run against v0.5.0:

- **4,738** tests run (corpus grew by 27 since v0.1.0)
- **4,726** passed
- **12** failed (one fewer than v0.1.0)
- **0** skipped

That is **99.75% conformance**. The remaining failures are the same set documented in the v0.1.0 baseline — none of the new rules in v0.5.0 introduce a regression, and the base64 stage does not affect any of the upstream CRS test cases (it operates before the rule engine and only emits synthetic ARGS that did not previously exist).

## Conclusions

Two changes, two clean wins. Base64 decoding fixed the biggest miss from the v0.1.0 baseline — application-layer coverage went from 53.86% to 83.81%, the overall score from 86.16% to 93.65% — and the XSS function-call evasion rules took `xss-scripting` from 40.18% to 97.77%. The most important number is the one that did *not* move: the false-positive rate stayed flat at 90.78%. Catching more real attacks without blocking real requests is the goal of every release.

This is what Barbacana is built for: strong defaults that work without requiring security expertise. The numbers above show the approach works — at least against the GoTestWAF corpus. The numbers above show the approach works — at least against the GoTestWAF corpus.

GoTestWAF has been a good way to find gaps and measure each change. Adding more WAF benchmarks is on the roadmap, both to double-check the results and to surface new ideas. Bug reports, feedback, and feature requests are very welcome — open an issue or start a discussion on [GitHub](https://github.com/barbacana-waf/barbacana).

---

The raw reports behind the numbers above are available for download:

- [GoTestWAF report (PDF)](assets/gotestwaf-v0.5.0-report.pdf) — full attack-simulation results for v0.5.0.
- [go-ftw report (text)](assets/ftw-v0.5.0-summary.txt) — full per-test CRS conformance output for v0.5.0.

*AI assistance was used to analyze the GoTestWAF report data and co-wrote this post; the final text was fully reviewed by a human.*
