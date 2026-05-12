# Security headers

Barbacana injects security response headers and strips leaky ones before responses reach the client. Defaults are tuned to be safe for any app; stricter values are opt-in because they break common patterns when applied blindly.

## Quickstart

No configuration needed for the safe defaults — just route traffic through Barbacana:

```yaml
routes:
  - upstream: http://app:8000
```

You get five injected headers (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`) and eleven stripped headers (`Server`, `X-Powered-By`, …) out of the box. To enable CSP, override values, or strip extra headers, see [Customizing](#customizing) below.

## How it works

Two independent knobs decide what gets injected:

1. **Which injectors run.** Each header is a catalog leaf with its own default state. Five are on by default; six are opt-in. Toggle any of them with `enable:` / `disable:`.
2. **What value each running injector emits.** Each leaf has a built-in default value (in the table below). Override per-route with `response_headers.inject:`.

So enabling a header without supplying an `inject:` value uses the built-in default. Add `inject:` only when the default doesn't fit your app.

## Headers injected

The five marked **on** are emitted out of the box. The six marked *off* are opt-in — add them to `enable:` to activate, then the built-in default (or your `inject:` override) is used.

| Header | Catalog leaf | Default | Built-in value |
|---|---|---|---|
| `Strict-Transport-Security` | `response-headers-add-hsts` | **on** | `max-age=63072000; includeSubDomains` |
| `X-Frame-Options` | `response-headers-add-frame-options` | **on** | `DENY` |
| `X-Content-Type-Options` | `response-headers-add-nosniff` | **on** | `nosniff` |
| `Referrer-Policy` | `response-headers-add-referrer-policy` | **on** | `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | `response-headers-add-dns-prefetch` | **on** | `off` |
| `Content-Security-Policy` | `response-headers-add-csp` | off | `default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` |
| `Cross-Origin-Opener-Policy` | `response-headers-add-coop` | off | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `response-headers-add-coep` | off | `unsafe-none` |
| `Cross-Origin-Resource-Policy` | `response-headers-add-corp` | off | `same-origin` |
| `Permissions-Policy` | `response-headers-add-permissions-policy` | off | broad deny list |
| `Cache-Control` | `response-headers-add-cache-control` | off | `no-store, no-cache, must-revalidate, max-age=0` |

### Why six are off by default

Each default-off header shares the same property: any value strict enough to protect users breaks at least one common app pattern, and no value loose enough to be universally safe is worth injecting.

- **CSP** — every app's safe policy differs (inline scripts, third-party origins, frame ancestors). A weak default CSP is worse than none. Pair the leaf with a route-level `csp.policy` value before enabling.
- **COOP / COEP / CORP** — strict cross-origin isolation breaks OAuth popups, cross-origin embedding, `window.opener` integrations, and any cross-origin asset that hasn't opted in via CORP/CORS.
- **Permissions-Policy** — any policy strict enough to matter blocks legitimate features (camera, microphone, geolocation, USB, payment).
- **Cache-Control** — cache policy is route-specific. A static asset, a personalized page, and a sensitive API need three different policies; inject from your app or CDN, not the WAF.

If you'd rather observe what your upstream is sending without modifying it, the catalog's response-inspection family flags missing or misconfigured headers without injecting.

## Headers stripped

All eleven are on by default — removing identifying server headers is rarely controversial. Disable per-header via `disable:` (e.g. `disable: [response-headers-remove-server]` keeps the upstream's `Server` value).

| Header | Catalog leaf | Why |
|---|---|---|
| `Server` | `response-headers-remove-server` | Reveals server software |
| `X-Powered-By` | `response-headers-remove-powered-by` | Reveals stack |
| `X-AspNet-Version` | `response-headers-remove-aspnet-version` | Reveals ASP.NET version |
| `X-Generator` | `response-headers-remove-generator` | Reveals CMS |
| `X-Drupal-Cache` | `response-headers-remove-drupal` | Reveals Drupal |
| `X-Varnish` | `response-headers-remove-varnish` | Reveals caching layer |
| `Via` | `response-headers-remove-via` | Reveals proxy chain |
| `X-Runtime` | `response-headers-remove-runtime` | Reveals app framework |
| `X-Debug-Token` | `response-headers-remove-debug` | Symfony debug data |
| `X-Backend-Server` | `response-headers-remove-backend-server` | Reveals backend pool |
| `X-Version` | `response-headers-remove-version` | Reveals app version |

## Customizing

Override values, enable opt-in headers, and strip extra app-specific headers:

```yaml
response_headers:
  inject:
    response-headers-add-csp: "default-src 'self'; script-src 'self' 'nonce-XXX'"
    response-headers-add-permissions-policy: "camera=(), microphone=(), geolocation=()"
  strip_extra:
    - X-Internal-Trace-Id
enable:
  - response-headers-add-csp
  - response-headers-add-permissions-policy
```

- `inject:` keys are canonical leaf names from the [protection catalog](catalog.md). The value replaces the built-in default.
- `strip_extra:` takes raw header names — anything beyond the eleven stripped by default.
- `enable:` / `disable:` flip individual leaves regardless of their default state.

### Locking down for internal apps

For locked-down CSP and cross-origin isolation:

```yaml
response_headers:
  inject:
    response-headers-add-csp: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests"
    response-headers-add-coep: "require-corp"
enable:
  - response-headers-add-csp
  - response-headers-add-coep
```

### Tightening for JSON APIs

For a minimal CSP and a soft `Cache-Control` (response is non-cacheable but the browser may still revalidate):

```yaml
response_headers:
  inject:
    response-headers-add-csp: "default-src 'none'"
    response-headers-add-cache-control: "no-store"
enable:
  - response-headers-add-csp
  - response-headers-add-cache-control
```

## Further reading

MDN reference docs for each header:

- [`Strict-Transport-Security`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
- [`X-Content-Type-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options)
- [`Referrer-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy)
- [`X-DNS-Prefetch-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-DNS-Prefetch-Control)
- [`Content-Security-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
- [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy)
- [`Cross-Origin-Embedder-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy)
- [`Cross-Origin-Resource-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy)
- [`Permissions-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy)
- [`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [`Server`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server) and [`Via`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Via) (the standardised members of the stripped set)

Cross-cutting guides:

- [MDN: HTTP headers index](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) — companion to COOP/COEP/CORP
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/) — recommended values and rationale
