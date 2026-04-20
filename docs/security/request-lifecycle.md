# Request lifecycle

Every request flows through a strict sequence of stages. In `blocking` mode, any stage can short-circuit with a 403 response — later stages are skipped. In `detect_only` mode, detections are recorded but the request continues to the upstream.

```
 1.  TLS termination                          (Caddy)
 2.  HTTP/2/3 frame limits                    (Caddy)
 3.  Slow request / read timeouts             (Caddy)
 4.  Request size, URL, and header limits
 5.  Protocol hardening
       smuggling, CRLF, null byte, method override
 6.  Input normalization
       double-encoding, unicode NFC, path resolution
 7.  Body parsing limits
       JSON depth/keys, XML depth/entities
 8.  Resource protection
       decompression ratio, body spooling to disk
 9.  File upload validation
       file count, file size, MIME types, double extensions
10.  CORS preflight handling
11.  OpenAPI request validation
12.  CRS evaluation (request phases 1–2)
13.  Reverse proxy to upstream
14.  CRS evaluation (response phases 3–4)
15.  Security header stripping
16.  Security header injection
17.  Response to client
```

Key ordering decisions:

- **Protocol hardening before normalization** — smuggling and CRLF detection need the raw representation.
- **Normalization before CRS** — CRS sees a single canonical form, preventing evasion via double-encoding.
- **Body parsing limits before resource protection, OpenAPI, and CRS** — unbounded payloads never reach a parser.
- **OpenAPI before CRS** — contract violations are cheaper to evaluate and provide a strong early signal.
- **CRS immediately before the proxy** — no request reaches the upstream without passing the rule engine.
- **Header stripping before injection** — injected values are never removed by overlapping strip rules.
