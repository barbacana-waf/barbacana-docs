# Accept

Declare what a route handles. Anything else gets rejected before inspection.

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
    accept:
      methods: [GET, POST]
      content_types: [application/json]
      max_body_size: 1MB
      max_url_length: 2048
      max_header_size: 8KB
      max_header_count: 50
```

## Why this matters

If you only accept JSON, the XML parser never runs. If you only accept `GET` and `POST`, `PUT`/`DELETE` requests are rejected before any rule fires. Smaller attack surface, less CPU, fewer false positives.

## Fields

| Field | Default | Notes |
|---|---|---|
| `methods` | `[GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS]` | List of allowed HTTP methods |
| `content_types` | All | List of allowed `Content-Type` values |
| `max_body_size` | 1MB | Reject requests with larger bodies |
| `max_url_length` | 8KB | Reject requests with longer URLs |
| `max_header_size` | 8KB | Reject any single header longer than this |
| `max_header_count` | 100 | Reject requests with more headers than this |
| `require_host_header` | `true` | Reject requests without a `Host` header |

!!! tip "JSON-only API"
    Setting `content_types: [application/json]` shuts down a whole class of attacks (XML bombs, multipart smuggling) without writing a single rule.
