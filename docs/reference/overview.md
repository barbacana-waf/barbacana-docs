# Overview

Barbacana is configured with a single YAML file. The schema has three levels: server-wide settings at the top, a `global` block of defaults for every route, and a `routes` list where each route can override those defaults.

```yaml title="waf.yaml"
version: v1alpha1            # required, always v1alpha1

# ── Server-wide ─────────────────────────────────────────
host: api.example.com        # or port: 8080 — see Hostnames & HTTPS
data_dir: /data/barbacana    # persistent storage for TLS certs
metrics_port: 9090           # opt-in (default: 0 = disabled)
health_port: 8081            # opt-in (default: 0 = disabled)

# ── Defaults applied to every route ─────────────────────
global:
  mode: blocking             # or detect_only
  disable: []                # protections disabled everywhere
  accept: { ... }            # methods, content types, sizes
  inspection: { ... }        # sensitivity, timeouts, limits
  multipart: { ... }         # file upload limits
  response_headers: { ... }  # injected/stripped response headers

# ── Per-route configuration ─────────────────────────────
routes:
  - id: api
    match: { paths: ["/api/*"] }
    upstream: http://app:8000
    # any global.* block can be overridden here
    accept: { content_types: [application/json] }
    disable: [xss-ie-filter]
```

## How the three levels fit together

- **Server-wide** keys decide *how* Barbacana listens: one host with auto-TLS, multiple hosts, or plain HTTP behind a load balancer. They also control opt-in observability ports. See [Hostnames & HTTPS](../operations/hostnames.md).
- **Global defaults** are the baseline every route inherits. Everything here is already secure out of the box — you only add entries when you want to tighten a default (smaller `max_body_size`) or disable a protection fleet-wide.
- **Routes** are the unit of ownership. Each route matches requests by host and/or path, sends them to an upstream, and can override any `global.*` block for that route alone. `route.disable` is **additive** to `global.disable`.

## The four kinds of configuration

The rest of this section is grouped around the four things a route actually does:

| Group | What it controls | Pages |
|---|---|---|
| **Routing** | How requests reach an upstream | [Routes](routes.md), [Rewrites](rewrites.md) |
| **Request filtering** | What the route accepts and how it's inspected | [Accept](accept.md), [Uploads](uploads.md), [OpenAPI](openapi.md) |
| **Tuning protections** | Turning off false positives, onboarding gradually | [Disable protections](disable.md), [Detect-only mode](detect-only.md) |
| **Response** | What headers go back to the client | [CORS](cors.md), [Security headers](headers.md) |

For the exhaustive list of every key, default, and validation rule, see the [config schema reference](schema.md). For end-to-end YAML you can copy, see the [configuration walkthrough](../getting-started/incremental.md).
