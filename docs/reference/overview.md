# Reference

This section provides the complete field-by-field configuration reference. If you need conceptual background, see [Getting Started](../getting-started/overview.md) or [Operations](../operations/overview.md).

## Key concepts

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
  disable: []                # protections turned off everywhere
  enable: []                 # off-by-default protections turned on everywhere
  accept: { ... }            # methods, content types, sizes
  inspection: { ... }        # timeouts, limits
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

**Server-wide settings** decide how Barbacana listens: one host with auto-TLS, multiple hosts, or plain HTTP behind a load balancer. They also control opt-in observability ports. See [Hostnames & HTTPS](../operations/hostnames.md).

**Global defaults** are the baseline every route inherits. Everything here is already secure out of the box — you only add entries when you want to tighten a default (smaller `max_body_size`) or disable a protection fleet-wide.

**Routes** are the unit of ownership. Each route matches requests by host and/or path, sends them to an upstream, and can override any `global.*` block for that route alone. `route.disable` is **additive** to `global.disable`.

**Protection tuning** uses `disable:` and `enable:` lists at global or route level. Each entry is a canonical name from the [protection catalog](catalog.md) — at any of the three levels: an L1 family (`sql`), an L2 bucket (`sql-injection`), or a single leaf (`sql-injection-union-select`). More specific wins: a leaf in `enable:` overrides its family in `disable:`. See [Disable protections](disable.md) for worked examples.

## In this section

| Group | What it controls | Pages |
|---|---|---|
| **Routing** | How requests reach an upstream | [Routes](routes.md), [Rewrites](rewrites.md) |
| **Request filtering** | What the route accepts and how it's inspected | [Accept](accept.md), [Uploads](uploads.md), [OpenAPI](openapi.md) |
| **Tuning protections** | Turning off false positives, turning on extra rules, onboarding gradually | [Disable](disable.md), [Enable](enable.md), [Detect-only mode](detect-only.md) |
| **Response** | What headers go back to the client | [CORS](cors.md), [Security headers](headers.md) |
| **Catalog & schema** | Every protection name you can reference; every field and its default | [Protection catalog](catalog.md), [Full schema](schema.md) |

## Where to start

Need end-to-end YAML you can copy → [configuration walkthrough](../getting-started/incremental.md).

Looking up a specific field → use the table above to find the right page.

Full schema dump → [Full schema](schema.md).
