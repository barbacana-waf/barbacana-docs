# CORS

Disabled by default. Enable per route when a browser origin needs to call the route directly.

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
    cors:
      allow_origins: [https://app.example.com]
      allow_methods: [GET, POST, PUT, DELETE]
      allow_headers: [Content-Type, Authorization]
      allow_credentials: true
      max_age: 600
```

Preflight (`OPTIONS`) requests are answered automatically. Non-preflight requests are rejected if the `Origin` header isn't in `allow_origins`.

## Fields

| Field | Default | Notes |
|---|---|---|
| `allow_origins` | required | Exact origins or `*` (never combine `*` with credentials) |
| `allow_methods` | `[GET]` | Methods the browser may use |
| `allow_headers` | `[]` | Custom request headers the browser may send |
| `expose_headers` | `[]` | Response headers the browser may read |
| `allow_credentials` | `false` | Allow cookies / `Authorization` from the browser |
| `max_age` | `600` (seconds) | How long the browser may cache the preflight |

## Typical SPA setup

```yaml
cors:
  allow_origins: [https://app.example.com]
  allow_methods: [GET, POST, PUT, PATCH, DELETE]
  allow_headers: [Content-Type, Authorization, X-Request-Id]
  allow_credentials: true
  max_age: 3600
```

!!! danger "Never use `*` with credentials"
    `allow_origins: ["*"]` combined with `allow_credentials: true` is rejected by every modern browser and is a security mistake. List origins explicitly.
