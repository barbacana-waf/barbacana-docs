# Routes

A route says: *for requests matching this, forward them to this upstream — and inspect them along the way*.

## Minimal — match everything

```yaml
version: v1alpha1

routes:
  - upstream: http://app:8000
```

A route with no `match` block matches every request.

## Match by host

```yaml
routes:
  - match:
      hosts: [api.example.com]
    upstream: http://api:8000
```

!!! info "Single hostname? Use top-level `host:`"
    For a deployment with one public hostname, the simpler form is a top-level `host: api.example.com` and routes without `match.hosts`. See [Hostnames & HTTPS](../operations/hostnames.md) for the three modes.

## Match by path

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
```

Path matching supports `*` (single segment) and `**` (any depth).

## Multiple routes

```yaml
routes:
  - id: api
    match:
      paths: ["/api/*"]
    upstream: http://api:8000

  - id: uploads
    match:
      paths: ["/upload/*"]
    upstream: http://uploads:8000

  - id: everything-else
    upstream: http://app:8000
```

Routes are evaluated **most-specific first**: hosts before no-host, longer paths before shorter, last route should be the catch-all.

`id` is optional but recommended — it appears in the [audit log](../operations/audit-log.md) as `route_id` and in [metrics](../operations/metrics.md) as the `route` label.

## What goes inside a route

| Block | Purpose |
|---|---|
| `match` | What requests this route handles |
| `upstream` | Where to forward safe requests |
| [`accept`](accept.md) | What content types, methods, and sizes to allow |
| [`rewrite`](rewrites.md) | How to transform the path before forwarding |
| [`disable`](disable.md) | Which protections to turn off on this route |
| [`detect_only`](detect-only.md) | Log instead of block |
| [`openapi`](openapi.md) | Validate against an OpenAPI spec |
| [`cors`](cors.md) | Enable CORS |
| `response_headers` | Override [security headers](headers.md) |
| `multipart` | Configure [file uploads](uploads.md) |
