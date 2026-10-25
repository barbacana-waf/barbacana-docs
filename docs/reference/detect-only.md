# Detect-only mode

Log attacks without blocking them. For onboarding and tuning.

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
    mode: detect_only
```

## What it does

Every request is inspected normally. When a protection matches, the request is **forwarded to the upstream** instead of returning `403`, and an audit log entry lists the matched protections.

```json title="audit log entry (OCSF)"
{
  "disposition": "Allowed",
  "status_code": 200,
  "barbacana": {"matched_protections": ["sql-injection-union-select"]},
  "...": "..."
}
```

The request was forwarded, so the entry is marked allowed (`disposition: Allowed` in OCSF, `event.action: allow` in ECS). The matched protections show what blocking mode would have blocked. In blocking mode the same request would log `disposition: Blocked` and return `403`.

### Exception: oversized chunked bodies

A request body sent without a `Content-Length` header (chunked transfer encoding) that is larger than [`accept.max_body_size`](accept.md) is refused with `413`, also in detect-only mode. Barbacana reads such a body only up to that limit, so it can neither inspect it nor forward it whole. The audit log entry is marked blocked. To accept larger chunked bodies, raise `accept.max_body_size`.

## When to use it

- **First deployment** — turn it on, watch for a week, see what real traffic trips. Disable false positives, then switch off.
- **A new route** — start in detect-only until you've seen production traffic.

## Per route

`mode` is also a per-route field. You can run sensitive routes in blocking mode while a noisy legacy route stays in detect-only.

```yaml
routes:
  - id: api
    upstream: http://api:8000          # blocks (default)

  - id: legacy
    match:
      paths: ["/legacy/*"]
    upstream: http://legacy:8000
    mode: detect_only                   # logs only
```
