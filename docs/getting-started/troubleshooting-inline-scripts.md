# Fixing inline-script CSP errors

!!! info "CSP is opt-in"
    As of v0.4.0 Barbacana **no longer injects a CSP by default.** A fresh install will not produce the errors below unless you've explicitly enabled `response-headers-add-csp`. This page is for teams who have opted in (`enable: [response-headers-add-csp]`) — or whose upstream sends its own CSP — and need to reconcile the policy with inline scripts.

If you choose to enable CSP, Barbacana injects a strict policy:

```
default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

`default-src 'self'` blocks every inline `<script>` block, every inline event handler (`onclick="…"`), every `<style>` block, every `javascript:` URL, and every external script not served from the page's own origin. That is intentional — inline scripts are the primary vector for stored XSS, and CSP is the most effective mitigation.

If your app relies on inline scripts (server-rendered templates, legacy code, third-party widgets), the CSP must be loosened — but **not by adding `'unsafe-inline'` everywhere.** Try the options below in order.

## Recommended on-ramp: report-only

Before enabling enforcing CSP in production, send the policy in **`Content-Security-Policy-Report-Only`** mode from your application for a week or two. The browser logs every violation but doesn't block execution. You'll see exactly which inline blocks, third-party origins, and `data:` URLs need allow-listing before turning enforcement on. Barbacana doesn't synthesize a report-only policy itself — emit it from your app, then graduate to `enable: [response-headers-add-csp]` once the violation log is clean.

## Symptoms

The page renders but JavaScript doesn't run, or specific widgets stay blank. The browser **Console** shows:

```
Refused to execute inline script because it violates the following
Content Security Policy directive: "default-src 'self'".
Either the 'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce
('nonce-...') is required to enable inline execution.
```

Other variants you may see:

- `Refused to apply inline style …` — same issue, `style-src` directive.
- `Refused to load the script 'https://cdn.example.com/foo.js' …` — external script not in `script-src`.
- `Refused to load the image 'data:image/png;base64,…' …` — `data:` URL not in `img-src`.

The audit log shows nothing — CSP is enforced by the browser, not by Barbacana's request inspection.

## Diagnose

1. Open **Developer Tools → Console** and read the full CSP error. It tells you:
    - which directive blocked it (`script-src`, `style-src`, `img-src`, …),
    - the source it tried to load (`inline`, an external URL, a `data:` URL, …),
    - and the exact CSP value Barbacana sent.
2. Decide the source category:
    - **Inline `<script>` or inline event handler** → option 1, 2, or 3 below.
    - **External script from another origin** → add the origin to `script-src`.
    - **Inline style** (`<style>` block, `style="…"` attribute) → same options applied to `style-src`.
    - **Image from `data:` URL** → add `data:` to `img-src`.

## Option 1 — Move scripts to external files (best)

If you control the application, this is the most secure outcome — no CSP changes needed at all.

1. Move every `<script>…</script>` block to a separate `.js` file served from the same origin.
2. Replace inline event handlers (`onclick="doThing()"`) with `addEventListener` in those files.
3. Move inline styles to external CSS files.

Modern build tools (Vite, webpack, esbuild) emit external bundles by default — most refactoring is a question of stripping inline blocks from server-rendered HTML templates.

## Option 2 — Allow specific inline scripts via nonce or hash

If you can modify the HTML but can't avoid inline scripts (server-rendered apps), allow them by **nonce** or **hash** instead of opening the entire `'unsafe-inline'` door.

**Nonce approach.** The application generates a random per-response nonce, adds it to every inline script tag (`<script nonce="abc123">…</script>`), and reflects it in the CSP it sends. Barbacana doesn't generate the nonce — your application does. Don't enable Barbacana's CSP injection at all in this case; just let the upstream's CSP through:

```yaml
routes:
  - upstream: http://app:8000
    # response-headers-add-csp is off by default — no extra config needed
```

If you have CSP injection enabled globally and want to opt this route out:

```yaml
routes:
  - upstream: http://app:8000
    disable:
      - response-headers-add-csp
```

Your application is now responsible for sending a correct CSP on every response from that route.

**Hash approach.** For static inline blocks, compute the SHA-256 of the script body (the browser usually prints the expected hash directly in the console error) and inject a custom CSP:

```yaml
routes:
  - upstream: http://app:8000
    enable:
      - response-headers-add-csp
    response_headers:
      inject:
        response-headers-add-csp: "default-src 'self'; script-src 'self' 'sha256-AbC...='"
```

## Option 3 — Allow `'unsafe-inline'` (last resort)

Only do this if the app is internal, the threat model accepts the trade-off, or you're in a temporary unblock-and-fix-later situation:

```yaml
routes:
  - upstream: http://app:8000
    enable:
      - response-headers-add-csp
    response_headers:
      inject:
        response-headers-add-csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
```

This **disables CSP-based XSS protection** for inline scripts on that route. Scope it to the specific route that needs it; never apply it globally.

## Allowing an external script source

If the error names an external URL rather than `inline`, list that origin in `script-src`:

```yaml
inject:
  response-headers-add-csp: "default-src 'self'; script-src 'self' https://cdn.example.com"
```

The same pattern works for `style-src`, `img-src`, `connect-src`, `font-src`, etc.

## Verify

After every CSP change:

1. **Hard-refresh** the page (DevTools open → right-click reload → *Empty Cache and Hard Reload*). CSPs are aggressively cached.
2. Confirm the **Console** is clear of CSP errors.
3. In the **Network** tab, click the document request and check that the response carries your custom `Content-Security-Policy` header — not the default.

## Related

- [Security headers reference](../reference/headers.md) — full list of headers Barbacana injects and how to override values.
- [Protection catalog](../reference/catalog.md) — every `response-headers-add-*` key you can `inject`, `enable`, or `disable`.
