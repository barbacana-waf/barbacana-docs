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

## Large uploads and the inspection window

`inspection.max_inspect_size` (default 128KB) is how much of a request body the rules read. For a multipart upload it does not count the contents of uploaded files: the rules never read them. A 100MB upload with a small form around it is inspected in full, as long as it is within `accept.max_body_size` and `multipart.file_size`. Every part header and every non-file field is still inspected, wherever in the body it sits.

If the non-file part of a request is larger than the window (a huge text field, or any body that is not multipart), the request is blocked with `413`, under `resource-limits-max-inspection-size`.

Routes that must accept large bodies that are not multipart, such as raw `PUT` uploads, can disable that leaf. The first `max_inspect_size` bytes are then inspected and the request is forwarded. That trades coverage for availability: anything past the window is not inspected, so an attacker who can pad a request can place a payload there. Prefer raising `max_inspect_size` (up to 10MB) where that is enough.

```yaml
routes:
  - id: files
    match:
      paths: ["/files/*"]
    upstream: http://files:8000
    accept:
      max_body_size: 1GB
    disable: [resource-limits-max-inspection-size]
```
