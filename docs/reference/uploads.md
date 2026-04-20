# Uploads

Configure multipart uploads. Active only when a route accepts `multipart/form-data`.

```yaml
routes:
  - id: uploads
    match:
      paths: ["/upload/*"]
    upstream: http://uploads:8000
    accept:
      content_types: [multipart/form-data]
    multipart:
      file_limit: 10
      file_size: 5MB
      allowed_types: [image/png, image/jpeg, application/pdf]
      double_extension: true
```

## Fields

| Field | Default | Notes |
|---|---|---|
| `file_limit` | `10` | Max number of files per request |
| `file_size` | `10MB` | Max size per individual file |
| `allowed_types` | `[]` (any) | MIME types the route accepts |
| `double_extension` | `true` | Reject filenames like `shell.php.jpg` |

## Why `double_extension` matters

A filename like `report.pdf.php` is a classic attempt to bypass naïve extension checks while landing executable code on the server. Barbacana rejects it by default.

!!! tip "Be specific with `allowed_types`"
    An empty `allowed_types` accepts any MIME type. For an image-upload endpoint, list the formats you actually serve — anything else is almost certainly an attack or a misconfiguration.
