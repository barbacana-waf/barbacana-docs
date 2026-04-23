# Request lifecycle

Every request flows through a strict sequence of stages. In `blocking` mode, any stage can short-circuit with a 403 response — later stages are skipped. In `detect_only` mode, detections are recorded but the request continues to the upstream.

```
 1.  TLS termination                          (Caddy)
 2.  HTTP/2/3 frame limits                    (Caddy)
 3.  Slow request / read timeouts             (Caddy)
 4.  Request size, URL, and header limits
 5.  Input normalization double-encoding, path resolution, unicode NFC
 6.  Protocol hardening smuggling, CRLF, null byte, method override
 7.  Resource protection decompression ratio (gzip/deflate)
 8.  Body parsing limits JSON depth/keys, XML depth/entities
 9.  File upload validation file count, file size, MIME types, double extensions
10.  CORS preflight handling
11.  OpenAPI request validation
12.  CRS evaluation (request phases 1–2)
13.  Reverse proxy to upstream
14.  Security header stripping
15.  Security header injection
16.  Response to client
```

Key ordering decisions:

- **Normalization before protocol hardening and CRS** — double-encoding detection reads the raw path; after canonicalisation, smuggling and CRLF detection (which operate on headers) still work, and CRS sees a single canonical form so attackers cannot evade rules via double-encoding.
- **Resource protection before body parsing** — decompression ratio is checked first, so a decompression bomb never reaches the parser.
- **OpenAPI before CRS** — contract violations are cheaper to evaluate and provide a strong early signal.
- **CRS immediately before the proxy** — no request reaches the upstream without passing the rule engine.
- **Header stripping before injection** — injected values are never removed by overlapping strip rules.
