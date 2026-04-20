# Security overview

What Barbacana protects against, what it doesn't, and how it decides.

## What Barbacana protects against

| Class | Examples |
|---|---|
| Injection | SQL injection, command injection, code injection, LDAP injection |
| Cross-site scripting | Reflected, stored, and DOM XSS patterns in request data |
| File inclusion | Local and remote file inclusion (LFI / RFI) |
| Remote code execution | Shell metacharacters, deserialization payloads, web shells |
| Path traversal | `../`, encoded variants, normalization tricks |
| Protocol attacks | Request smuggling, CRLF injection, HTTP/2 floods, slow requests |
| Data leakage | Stack traces, debug pages, database error messages in responses |
| Contract violations | Requests that don't conform to your [OpenAPI spec](../reference/openapi.md) |

For the exhaustive list with names you can [`disable`](../reference/disable.md), see the [protection catalog](protections.md).

## What Barbacana does NOT protect against

Barbacana focuses on application-layer attack detection where it can give high-confidence results. It does **not** do:

- **DDoS protection** — use a CDN or scrubbing service
- **Rate limiting** — use an API gateway or load balancer
- **Authentication / identity** — your app or your IdP
- **Bot detection** — use a dedicated bot-management product
- **IP reputation / threat intel** — enrich audit logs in your SIEM

Barbacana also does **not** parse SOAP, gRPC, or GraphQL semantics.

## How detection works

Barbacana uses two complementary mechanisms:

1. **Signature matching** — every request is checked against a curated set of attack patterns from the OWASP Core Rule Set. A match contributes a score.
2. **Anomaly scoring** — scores accumulate across patterns. When the total crosses the [sensitivity](sensitivity.md) threshold, the request is blocked (or logged, in [detect-only mode](../reference/detect-only.md)).

A single suspicious pattern usually isn't enough to block. Multiple matches that together cross the threshold are. This keeps false positives low without missing combined attacks.

The matched patterns, the score, and the threshold decision all appear in the [audit log](../operations/audit-log.md).
