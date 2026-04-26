# Fixing CORS errors

CORS — Cross-Origin Resource Sharing — is a browser-side check. When JavaScript loaded from `https://app.example.com` calls `https://api.example.com`, the browser refuses to expose the response unless the API returns the right `Access-Control-Allow-*` headers. **Barbacana's CORS support is disabled by default**, so until you enable it the browser will block every cross-origin call.

## Symptoms

The browser **Console** shows one of:

```
Access to fetch at 'https://api.example.com/users' from origin
'https://app.example.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

```
Response to preflight request doesn't pass access control check
```

```
Request header field X-Request-Id is not allowed by Access-Control-Allow-Headers
```

The Network tab usually shows the request as **(failed)** or a `200`/`204` `OPTIONS` whose response is missing `Access-Control-Allow-Origin`. The audit log shows nothing wrong — Barbacana isn't blocking the request, the browser is.

## When you need CORS

Enable CORS on a route when:

- A browser SPA hosted at one origin calls an API at a **different** origin (different host **or** different port **or** different scheme).
- A `<script type="module">` from one origin imports from another.
- The `OPTIONS` preflight is failing — that is also CORS.

You do **not** need CORS when:

- The browser and the API are served from the same origin (e.g. both behind the same Barbacana hostname). Same-origin traffic doesn't trigger CORS at all.
- The caller is a server, CLI, mobile app, or `curl` — only browsers enforce CORS.

## Diagnose

Reproduce the preflight from the terminal so you see Barbacana's actual response:

```bash
curl -i -X OPTIONS https://api.example.com/users \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, authorization"
```

A correctly configured route returns `Access-Control-Allow-Origin: https://app.example.com` and a list of allowed methods and headers. If those are missing, CORS isn't configured on the route the browser is hitting.

## Fix — enable CORS on the route

Add a `cors` block to every route the browser calls directly:

```yaml
routes:
  - id: api
    match:
      paths: ["/api/*"]
    upstream: http://api:8000
    cors:
      allow_origins: [https://app.example.com]
      allow_methods: [GET, POST, PUT, PATCH, DELETE]
      allow_headers: [Content-Type, Authorization]
      allow_credentials: true
      max_age: 3600
```

Reload Barbacana, hard-refresh the SPA, and the console errors should disappear. Barbacana answers the `OPTIONS` preflight automatically — the upstream doesn't need to handle it.

See [CORS reference](../reference/cors.md) for every field.

## Common mistakes

| Mistake | What you'll see | Fix |
|---|---|---|
| `allow_origins: ["*"]` with `allow_credentials: true` | *"The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '\*' when the request's credentials mode is 'include'"* | List origins explicitly. Never combine `*` with credentials. |
| Custom request header missing from `allow_headers` | `Request header field X-Request-Id is not allowed by Access-Control-Allow-Headers in preflight response` | Add every custom header the SPA sends — `Authorization`, `X-Request-Id`, etc. |
| Restricted `accept.methods` and dropped `OPTIONS` | Preflight returns 405; browser console shows a CORS error | Keep `OPTIONS` in [`accept.methods`](../reference/accept.md) (it's there by default — only an issue if you set the list explicitly). |
| Trailing slash or scheme mismatch in `allow_origins` | Browser console shows the exact `Origin` it sent — it doesn't match the entry in your config | Use the exact origin: `https://app.example.com`. No path, no trailing slash. `http://` and `https://` are different origins. |
| Multiple frontends, single `cors` block | Some origins work, others fail | List every browser origin in `allow_origins`, or split frontends into separate routes. |

## Quick reference for SPAs

```yaml
cors:
  allow_origins: [https://app.example.com]
  allow_methods: [GET, POST, PUT, PATCH, DELETE]
  allow_headers: [Content-Type, Authorization, X-Request-Id]
  allow_credentials: true
  max_age: 3600
```
