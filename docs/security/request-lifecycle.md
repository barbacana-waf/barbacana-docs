# Request lifecycle

Every request flows through a strict sequence of stages. In `blocking` mode, any stage can stop the request with an error response, and later stages are skipped. The status is `403` for most protections; size limits return `413`, an unaccepted `Content-Type` returns `415`, an OpenAPI body mismatch returns `422`, and rate limiting returns `429`. In `detect_only` mode, detections are recorded but the request continues to the upstream, with one exception described in [Size limits](#size-limits).

```
 1.  TLS termination                          (Caddy)
 2.  HTTP/2 frame limits                      (Caddy)
 3.  Slow request / read timeouts             (Caddy)
 4.  Rate limiting                            only when configured
 5.  Request limits                           size, URL, headers, method, Content-Type
 6.  Input normalization                      double-encoding, path resolution, unicode NFC
 7.  Protocol hardening                       smuggling, CRLF, null byte, method override
     ── the request body is read here, once ──
 8.  Decompression ratio                      gzip/deflate bodies
 9.  Body parsing limits                      JSON depth/keys, XML depth/entities/external entities
10.  File upload validation                   file count, file size, MIME types, double extensions
11.  CORS preflight handling
12.  OpenAPI request validation
13.  Base64 decoding                          decoded values are handed to the rules
14.  CRS evaluation (request phases 1–2)
15.  Reverse proxy to upstream
16.  CRS evaluation (response phases 3–4)     responses up to max_inspect_size
17.  Security header stripping
18.  Security header injection
19.  Response to client
```

Key ordering decisions:

- **Normalization before protocol hardening and CRS** — double-encoding detection reads the raw path; after canonicalisation, smuggling and CRLF detection (which operate on headers) still work, and CRS sees a single canonical form so attackers cannot evade rules via double-encoding.
- **Resource protection before body parsing** — decompression ratio is checked first, so a decompression bomb never reaches the parser.
- **OpenAPI before CRS** — contract violations are cheaper to evaluate and provide a strong early signal.
- **CRS immediately before the proxy** — no request reaches the upstream without passing the rule engine.
- **Header stripping before injection** — injected values are never removed by overlapping strip rules.

## Request body

Barbacana reads the request body once, right before the first stage that needs it (stage 8), and every body stage works on that same copy. The upstream receives the body exactly as the client sent it. Decoding, normalization and parsing only produce copies for inspection.

### Size limits

`accept.max_body_size` (default `10MB`, maximum `1GB`) is the largest body a route accepts. How it is enforced depends on whether the client declares the length:

| Request | What happens to a body over `max_body_size` |
|---|---|
| `Content-Length` declared | Rejected with `413` at stage 5, before the body is read (`request-validation-max-body-size`). |
| No `Content-Length` (`Transfer-Encoding: chunked`) | Read up to `max_body_size`, then rejected with `413`. This happens in every mode, even with `request-validation-max-body-size` disabled, because Barbacana can neither inspect nor forward the body without reading all of it. |

In `detect_only` mode, or with `request-validation-max-body-size` disabled, a body with a declared length is read in full, whatever its size.

### Memory

Barbacana holds the whole request body in memory while it inspects the request. Each request in flight can use up to `accept.max_body_size` (10MB by default), so size instance memory for the number of large bodies you expect at the same time.

`inspection.max_memory_buffer` applies only to the copy of the body inside the rule engine. Above that size, the rule engine writes its copy to a temporary file. It does not limit Barbacana's own copy.

### The inspection window

`inspection.max_inspect_size` (default `128KB`, maximum `10MB`) is how much of the body the rules read. For a `multipart/form-data` body, the contents of uploaded files do not count: no rule reads them. The rules still read every part header, every field name and every non-file field, wherever it sits in the body. A 100MB upload with a small form around it is inspected in full.

A body whose inspected content is larger than the window is handled by `resource-limits-max-inspection-size`:

| Configuration | What happens |
|---|---|
| Default | Rejected with `413`, because the rules cannot read all of it. |
| `detect_only` mode | Recorded in the audit log. The first `max_inspect_size` bytes are inspected and the request is forwarded. |
| `resource-limits-max-inspection-size` disabled | The first `max_inspect_size` bytes are inspected and the request is forwarded. Nothing is recorded, and anything past the window is not inspected. |

### How the body is parsed

The rules see the body as structured data, chosen from the request's `Content-Type`:

| `Content-Type` | Parsed as |
|---|---|
| `application/json` and `+json` types | JSON. Every key and value is a separate argument. |
| `application/xml`, `text/xml` and `+xml` types | XML. Element text and attribute values are inspected. |
| `multipart/form-data` | Form fields and uploaded files. |
| Anything else | URL-encoded form data. |

A JSON or XML body that does not parse as its declared type is rejected with `403` (`http-compliance-malformed-body`). A body that was cut at the inspection window is exempt, because the cut is what breaks it.

Before the rules run, native checks look at the same body:

- JSON: nesting depth (`inspection.json_depth`) and key count (`inspection.json_keys`).
- XML: nesting depth (`inspection.xml_depth`), entity count (`inspection.xml_entities`), and external entities (XXE).
- Multipart: file count, file size, allowed MIME types and double extensions (see [Uploads](../reference/uploads.md)), plus the part-header and empty-file-control caps.
- Base64: values that look like base64 are decoded and given to the rules as extra arguments. In a JSON body, the strings are decoded first, so a value written with `\uXXXX` escapes is found too. URL-encoded JSON strings are decoded the same way.

### Compressed bodies

A request with a `Content-Encoding` header is rejected with `403` by `http-compliance-restricted-headers`. Before that, a `gzip` or `deflate` body is checked against `inspection.decompression_ratio_limit` (default `100`), so a decompression bomb is refused without being expanded in memory.

If a route allows compressed bodies by disabling `http-compliance-restricted-headers`, the rules inspect the compressed bytes, not the decompressed content. In practice, the body of such a request is not inspected.

### When the body cannot be read

If reading the body fails, for example because the client disconnects, Barbacana forwards the request without inspecting the body. It logs a warning and increments `waf_body_inspection_skipped_total`. This counter should stay at zero; alert on any sustained rate.

## Response body

Barbacana holds back the upstream's response, up to `inspection.max_inspect_size`, and runs the CRS response rules on it (stage 16) before any byte reaches the client. These rules look for data leaking out, such as database error messages and source code. In `blocking` mode a match replaces the response with an error response; in `detect_only` mode it is recorded and the response is sent unchanged.

What is inspected, for a response whose body fits in `max_inspect_size`:

- The status and the headers.
- The body, when its `Content-Type` is `text/plain`, `text/html`, `text/css`, `text/javascript`, `application/json`, `application/xml` or `application/javascript`.

What is not inspected:

- A response whose body is larger than `max_inspect_size`, headers included. Barbacana sends what it has buffered and streams the rest straight through, so large downloads and server-sent events keep working.
- A compressed response body. Barbacana passes the client's `Accept-Encoding` to the upstream unchanged, so a `gzip` response reaches the rules in compressed form.
- `101 Switching Protocols` and the WebSocket or `h2c` traffic after it.
