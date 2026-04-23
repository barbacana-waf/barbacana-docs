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

## Detection model

Every request is matched against the OWASP Core Rule Set's attack patterns. A single suspicious pattern usually isn't enough on its own — multiple matches that together indicate an attack are what trigger a block (or a log entry, in [detect-only mode](../reference/detect-only.md)). This keeps false positives low without missing combined attacks.

The active rule set is **not user-configurable**. Barbacana picks it: the CRS baseline plus a hand-curated set of additional rules, each individually screened against benign-traffic corpora to keep false positives low. The reason there is no sensitivity knob is that turning one without traffic context tends to produce false positives, which leads operators to disable whole protection categories — leaving the application less protected than the default would have been. Making these decisions once, carefully, is the safer trade.

The matched patterns and the block decision appear in the [audit log](../operations/audit-log.md).

## What you can tune

Two route-level levers handle the cases where the default isn't right for your traffic:

- [`disable`](../reference/disable.md) — surgically remove a specific protection (or a whole category) on a route, by canonical name. Use this when a known false positive recurs on a known endpoint.
- [`detect_only` mode](../reference/detect-only.md) — inspect and log every request but never block. Use this when onboarding a new route, or before raising confidence enough to switch a route to blocking.


