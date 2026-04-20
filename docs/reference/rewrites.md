# Rewrites

Translate the request path before forwarding to the upstream.

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
    rewrite:
      strip_prefix: /api
```

Three options. They can be combined; `path` overrides the others.

## strip_prefix

Removes a leading prefix.

| Incoming | After `strip_prefix: /api` |
|---|---|
| `/api/users` | `/users` |
| `/api/v1/orders` | `/v1/orders` |

## add_prefix

Prepends a prefix.

| Incoming | After `add_prefix: /v1` |
|---|---|
| `/users` | `/v1/users` |

Combine with `strip_prefix` to swap prefixes:

```yaml
rewrite:
  strip_prefix: /api
  add_prefix: /v1
```

| Incoming | Forwarded |
|---|---|
| `/api/users` | `/v1/users` |

## path

Replaces the entire path. Wins over `strip_prefix` and `add_prefix`.

```yaml
rewrite:
  path: /healthcheck
```

| Incoming | Forwarded |
|---|---|
| anything | `/healthcheck` |

!!! info "OpenAPI runs after rewrite"
    [OpenAPI validation](openapi.md) checks the **rewritten** path, so your spec should describe the upstream's URL space, not the public one.
