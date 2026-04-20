# Security headers

Barbacana injects 11 security response headers and strips 11 leaky ones. By default, every response is hardened.

```yaml
routes:
  - upstream: http://app:8000
    response_headers:
      preset: moderate     # default
```

To customize:

```yaml
response_headers:
  preset: custom
  inject:
    header-csp: "default-src 'self'; img-src 'self' data:"
  strip_extra:
    - X-My-Backend-Header
```

## Presets

| Preset | When to use |
|---|---|
| `strict` | Locked-down internal apps. CSP `default-src 'self'`, HSTS 2 years, `Cache-Control: no-store`. |
| `moderate` (default) | General web apps. Balanced defaults. |
| `api-only` | JSON APIs. Drops `Cache-Control: no-store`, tailored CSP. |
| `custom` | You set every override via `inject`. |

## 11 headers injected

| Header | Default value (moderate preset) |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | `off` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `unsafe-none` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Permissions-Policy` | broad deny list |
| `Cache-Control` | `no-store, no-cache, must-revalidate, max-age=0` |

## 11 headers stripped

| Header | Why |
|---|---|
| `Server` | Reveals server software |
| `X-Powered-By` | Reveals stack |
| `X-AspNet-Version` | Reveals ASP.NET version |
| `X-Generator` | Reveals CMS |
| `X-Drupal-Cache` | Reveals Drupal |
| `X-Varnish` | Reveals caching layer |
| `Via` | Reveals proxy chain |
| `X-Runtime` | Reveals app framework |
| `X-Debug-Token` | Symfony debug data |
| `X-Backend-Server` | Reveals backend pool |
| `X-Version` | Reveals app version |

## Custom override

```yaml
response_headers:
  preset: moderate
  inject:
    header-csp: "default-src 'self'; img-src https:; script-src 'self' 'nonce-XXX'"
    header-permissions-policy: "camera=(), microphone=(), geolocation=()"
  strip_extra:
    - X-Internal-Trace-Id
```

Keys in `inject` use the canonical `header-*` name from the [protection catalog](../security/protections.md). `strip_extra` takes raw header names.
