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
| `methods` | `[GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS]` | List of allowed HTTP methods. Besides the common ones, `TRACE`, `CONNECT` and the WebDAV methods `PROPFIND`, `PROPPATCH`, `MKCOL`, `COPY`, `MOVE`, `LOCK`, `UNLOCK` and `REPORT` are accepted. |
| `content_types` | All | List of allowed `Content-Type` values |
| `max_body_size` | `10MB` | Reject requests with larger bodies with `413`. Maximum `1GB`. See [how the request body is handled](../security/request-lifecycle.md#request-body) |
| `max_url_length` | `8192` | Reject requests with longer URLs, in characters |
| `max_header_size` | `16KB` | Reject any single header longer than this |
| `max_header_count` | 100 | Reject requests with more headers than this |
| `require_host_header` | `true` | Reject requests without a `Host` header |

!!! tip "JSON-only API"
    Setting `content_types: [application/json]` shuts down a whole class of attacks (XML bombs, multipart smuggling) without writing a single rule.

## WebDAV and locking

A route that lists `LOCK` or `UNLOCK` in `methods` also lets the `If` and `Lock-Token` request headers through, because WebDAV locking cannot work without them. Every other restricted header stays blocked, and routes without `LOCK`/`UNLOCK` keep blocking both. `Expect` is never blocked: clients send `Expect: 100-continue` ahead of larger uploads.
