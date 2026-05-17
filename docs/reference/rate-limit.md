# Rate limiting

Disabled by default. Add a `rate_limit:` block to a route — or to `global:` as for all the routes — to cap the request rate per client.

```yaml
routes:
  - match:
      paths: [/login]
    upstream: http://app:8000
    rate_limit:
      requests: 2
      window: 1s
      source:
        type: ip
```

A request that exceeds the budget is rejected with `429 Too Many Requests` and a `Retry-After` header matching the configured `window`. Allowed requests pass through with no measurable overhead.

## How it works

Each client is allowed `requests` over a sliding `window`. Requests beyond that limit are blocked until older ones fall out of the window. The `window` is a parsed duration — `1s`, `30s`, `5m`, and so on. The "client" is whatever `source` is set to — usually an IP address, but it can also be the value of a header (an API key, a user ID, a forwarded IP).

### A worked example: protecting a login page

A common use is throttling `/login` to stop credential-stuffing attacks — an attacker trying thousands of username/password combinations in a tight loop. A real user submits the form once or twice; an attacker submits hundreds of times per second.

```yaml
routes:
  - match:
      paths: [/login]
    upstream: http://app:8000
    rate_limit:
      requests: 2
      window: 1s
      source:
        type: ip
```

Two login attempts per 1-second window, keyed by client IP. Now suppose an attacker hammers `/login` from a single IP:

| Attempt | Time           | Attempts from this IP in the last second | Result                  |
| ------- | -------------- | ---------------------------------------- | ----------------------- |
| 1       | `12:00:00.000` | none                                     | `200 OK` (reaches app)  |
| 2       | `12:00:00.300` | 1                                        | `200 OK` (reaches app)  |
| 3       | `12:00:00.600` | 2                                        | `429 Too Many Requests` |
| 4       | `12:00:00.900` | 2                                        | `429 Too Many Requests` |

Attempts 3 and 4 never reach your application — Barbacana rejects them before the login form is ever processed. The attacker is capped at 2 attempts per second per IP, which makes a brute-force run impractical.

Meanwhile, a legitimate user logging in from a different IP gets the full budget — each IP has its own independent counter. And a real user who mistypes their password and tries again twice is well within the limit; they never see a `429`.

Rate limiting runs as the **first stage** of the pipeline, before request validation and rule evaluation. A blocked request never reaches the upstream.

## What happens when a rate is hit

Response:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 1
Content-Type: application/json

{"error":"blocked","request_id":"01HXYZ..."}
```

`Retry-After` is required by [RFC 6585 §4](https://datatracker.ietf.org/doc/html/rfc6585#section-4) for `429` responses. The value (in seconds) matches the configured `window` — by the time the client retries, the oldest slot in the window will have freed up. The example above uses `window: 1s`, so the response carries `Retry-After: 1`.

The block is recorded in the audit log with `protection: rate-limit` and CWE references `CWE-400` (uncontrolled resource consumption) and `CWE-770` (allocation of resources without limits). See [Logs & SIEM](../security/logs.md).

## Identifying the client

`source.type` selects how the rate-limit key is derived from the request.

### `ip` — client IP from the connection

```yaml
rate_limit:
  requests: 100
  window: 1s
  source:
    type: ip
```

The key is `r.RemoteAddr` with the port stripped. **Correct only when Barbacana terminates TLS directly** (edge deployment). Behind a load balancer or reverse proxy, every request appears to come from the proxy and the limiter degrades to a single shared bucket — use `header` source instead.

### `header` — value of a named header

Use this when Barbacana sits behind a proxy or load balancer: the connection IP is the proxy's, so to throttle the real client you have to read the header the proxy injects (typically `X-Forwarded-For`) instead.

```yaml
rate_limit:
  requests: 100
  window: 1s
  source:
    type: header
    key: X-Forwarded-For
```

The key is the value of the named header. Typical uses:

- **`X-Forwarded-For` (or `X-Real-IP`)** behind a trusted reverse proxy that injects the client IP.
- **`Authorization`** to rate-limit per API token.
- **`X-Api-Key`** to rate-limit per tenant key.

If the configured header is **absent** on the request, the limiter falls back to the connection IP and emits a warning log line. The proxy in front of Barbacana is responsible for ensuring the header is present and trustworthy — Barbacana does not strip a client-supplied header, so an upstream-trusted header must be sanitised by the proxy before it reaches Barbacana.

!!! warning "Trust the source you're identifying"
    A client that controls the header value can rotate it to bypass the limit. Use `header` source only when the value is set by infrastructure you control (a load balancer, an authenticating proxy, an API gateway).

## Field reference

```yaml
rate_limit:
  requests: 100                 # required
  window: 1s                    # required; parsed duration, e.g. "1s", "30s", "5m"
  source:
    type: ip                    # required: "ip" or "header"
    key: X-Forwarded-For        # required when type == "header"
  backend:                      # optional; defaults below
    type: memory
    max_keys: 100000
    ttl: 10m
```

| Path                          | Type     | Default      | Validation                                       |
| ----------------------------- | -------- | ------------ | ------------------------------------------------ |
| `rate_limit.requests`         | int      | — (required) | `>= 1`                                           |
| `rate_limit.window`           | duration | — (required) | `>= 1s`; e.g. `1s`, `30s`, `5m`                  |
| `rate_limit.source.type`      | enum     | — (required) | one of `ip`, `header`                            |
| `rate_limit.source.key`       | string   | —            | required when `source.type` is `header`          |
| `rate_limit.backend.type`     | enum     | `memory`     | currently must be `memory`                       |
| `rate_limit.backend.max_keys` | int      | `100000`     | `>= 1`; LRU eviction once the cap is reached     |
| `rate_limit.backend.ttl`      | duration | `10m`        | `>= 1s`; idle keys are evicted after this period |

## State, restarts, and horizontal scaling

The `memory` backend — the only backend available today — keeps all counters in process memory. Two consequences worth knowing before you size a deployment:

**Counters reset on restart.** A new deploy, a crash, or a `restart` empties the cache. A client that was at its limit when the process went down starts the next window with a full budget. This is rarely a problem for the use case Barbacana is built for (slowing down attackers) — even an attacker who manages to time a restart only buys a single `window` before the new process starts counting them again.

**Each instance counts independently.** With N replicas behind a load balancer, a single client can use up to `N × requests` per `window` in the worst case. Usually fine for slowing attackers, not a true shared budget. A Redis backend is on the roadmap — the `backend:` block already accepts the type, so the YAML won't change when it lands.

All this means that **rate limiting is not a hard quota system**. Don't use it for billing or to enforce contractual API limits.

## Global default and per-route override

A `rate_limit:` block is accepted at both `global:` and `routes[]:`. The route-level block **replaces the global block entirely** — there is no field-level merging. A route with no `rate_limit:` block inherits the global one; there is no syntax to opt a single route out of a global default, so attach `rate_limit:` to the routes that need it rather than to `global:` if some routes should stay unlimited.

```yaml
global:
  rate_limit:
    requests: 50                # fleet-wide default
    window: 1s
    source:
      type: ip

routes:
  - id: app
    match: { paths: [/*] }
    upstream: http://app:8000
    # inherits the global rate_limit (50 per second)

  - id: login
    match: { paths: [/login] }
    upstream: http://app:8000
    rate_limit:                 # replaces the global block — not merged
      requests: 2
      window: 1s
      source:
        type: ip
```

## Detect-only mode

When the route is in `detect_only` mode (or the whole instance via `global.mode: detect_only`), a request that would have been blocked is **forwarded to the upstream** and an audit entry is emitted with `action: detected`. Use this when you need to measure traffic against a candidate rate before turning blocking on. See [Detect-only mode](detect-only.md).


## Examples

### Login throttle at the edge

Barbacana terminates TLS, so `r.RemoteAddr` is the real client IP. Two login attempts per second per IP — enough for a real user who mistypes, far too few to brute-force a password.

```yaml
version: v1alpha1
host: app.example.com

routes:
  - match: { paths: [/login] }
    upstream: http://login:8000
    rate_limit:
      requests: 2
      window: 1s
      source:
        type: ip
```

### Login throttle behind a load balancer

Barbacana runs behind a reverse proxy. Using `source.type: ip` would key on the load balancer's address (a single bucket for every login attempt from every user), so read the forwarded header instead.

```yaml
version: v1alpha1
port: 8080

routes:
  - match: { paths: [/login] }
    upstream: http://login:8000
    rate_limit:
      requests: 2
      window: 1s
      source:
        type: header
        key: X-Forwarded-For
```

The proxy must strip any client-supplied `X-Forwarded-For` before appending its own — otherwise an attacker can forge the header and rotate the value to bypass the limit.

### Stricter limit on `/login`, looser default everywhere else

A fleet-wide default protects every route from runaway clients; `/login` gets a much tighter cap because credential stuffing is the threat there.

```yaml
global:
  rate_limit:
    requests: 50                # plenty of headroom for normal browsing
    window: 1s
    source:
      type: ip

routes:
  - id: app
    match: { paths: [/*] }
    upstream: http://app:8000
    # inherits the 50-per-second global default

  - id: login
    match: { paths: [/login] }
    upstream: http://login:8000
    rate_limit:                 # overrides the global block — not merged
      requests: 2
      window: 1s
      source:
        type: ip
```

### Per-API-key limit

A different shape: rate-limit each authenticated tenant regardless of which IP they call from. Useful for an API where you publish per-customer quotas.

```yaml
version: v1alpha1
port: 8080

routes:
  - id: api
    match: { paths: ["/v1/*"] }
    upstream: http://api:8000
    rate_limit:
      requests: 20
      window: 1s
      source:
        type: header
        key: X-Api-Key
```

