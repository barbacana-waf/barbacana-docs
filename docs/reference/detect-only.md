# Detect-only mode

Log attacks without blocking them. For onboarding and tuning.

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
    detect_only: true
```

## What it does

Every request is inspected normally. When a protection matches, the request is **forwarded to the upstream** instead of returning `403`, and an audit log entry is emitted with `action: detected`.

```json title="audit log entry"
{
  "action": "detected",
  "matched_protections": ["sql-injection", "sql-injection-union"],
  "anomaly_score": 8,
  "...": "..."
}
```

In normal (blocking) mode the same request would log `action: blocked` and return `403`.

## When to use it

- **First deployment** — turn it on, watch for a week, see what real traffic trips. Disable false positives, then switch off.
- **A new route** — start in detect-only until you've seen production traffic.
- **Raising sensitivity** — every time you change [sensitivity](../security/sensitivity.md), retune in detect-only.

## Per route

`detect_only` is a per-route field. You can run sensitive routes in blocking mode while a noisy legacy route stays in detect-only.

```yaml
routes:
  - id: api
    upstream: http://api:8000          # blocks (default)

  - id: legacy
    match:
      paths: ["/legacy/*"]
    upstream: http://legacy:8000
    detect_only: true                   # logs only
```
