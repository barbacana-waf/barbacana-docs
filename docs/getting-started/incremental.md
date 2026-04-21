# Incremental configuration

Barbacana's config grows with your needs. Start with three lines, then add routes, limits, and policies one step at a time. Each step below is a runnable config — copy it, check it with [`barbacana --validate`](../operations/cli.md#validate-a-config), and move on.

By the end you'll have the full multi-route deployment from the [project README](https://github.com/barbacana-waf/barbacana).

---

## Step 1 — The minimum viable WAF

```yaml title="waf.yaml"
version: v1alpha1

routes:
  - upstream: http://app:8000
```

Three lines. Barbacana:

- Listens on **`:8080`** — the default when neither `host` nor `port` is set (Mode 3: plain HTTP behind a load balancer — see [Hostnames & HTTPS](../operations/hostnames.md)).
- Forwards every inspected request to `http://app:8000`.
- Runs in **blocking mode** by default. SQL injection, XSS, RCE, path traversal, protocol smuggling, and hundreds more are stopped; malicious requests never reach your upstream.
- Injects the `moderate` [security-headers](../reference/headers.md) preset into every response and strips backend-leaking headers (`Server`, `X-Powered-By`, …).

Good for local testing and for deployments where TLS terminates at a load balancer in front of Barbacana.

---

## Step 2 — Split traffic into routes

A real app has several backends. Add one route per backend, matched by path:

```yaml title="waf.yaml"
version: v1alpha1

routes:
  - id: api
    match:
      paths: ["/api/*"]
    upstream: http://api:8000

  - id: uploads
    match:
      paths: ["/upload/*"]
    upstream: http://uploads:8000

  - id: everything-else
    upstream: http://app:8000
```

How matching works:

- Routes are matched by **specificity**: literal path > longer prefix > shorter prefix. A request to `/api/users` hits `api`, not `everything-else`.
- A route with no `match` block matches everything — it's the catch-all.
- If no route matches, Barbacana returns `404 Not Found`. There is no implicit default.

See [Routes](../reference/routes.md) for the full matching rules.

---

## Step 3 — Constrain what the API accepts

The API only speaks JSON and only uses `GET` and `POST`. Reject everything else before it touches your backend:

```yaml hl_lines="5-7"
- id: api
  match:
    paths: ["/api/*"]
  upstream: http://api:8000
  accept:
    content_types: [application/json]
    methods: [GET, POST]
```

What changes:

- A `PUT`, `DELETE`, or `PATCH` to `/api/*` → rejected with `405 Method Not Allowed`.
- A `POST` with `Content-Type: application/xml` → rejected with `415 Unsupported Media Type`.
- `content_types` also **gates which parsers run**. The XML, form, and multipart parsers are skipped entirely for this route — tighter security and less work per request.

See [Accept](../reference/accept.md).

---

## Step 4 — Rewrite the request path

The API service expects URLs without the `/api` prefix. Strip it before forwarding:

```yaml hl_lines="8-9"
- id: api
  match:
    paths: ["/api/*"]
  upstream: http://api:8000
  accept:
    content_types: [application/json]
    methods: [GET, POST]
  rewrite:
    strip_prefix: /api
```

A public request to `/api/users/42` reaches the upstream as `/users/42`. Matching runs on the public path (with `/api`); the rewrite happens after matching. See [Rewrites](../reference/rewrites.md).

---

## Step 5 — Enforce the OpenAPI contract

If you already describe your API with an OpenAPI spec, Barbacana can validate every request against it — path, method, parameters, body shape — and reject anything off-contract:

```yaml hl_lines="10-11"
- id: api
  match:
    paths: ["/api/*"]
  upstream: http://api:8000
  accept:
    content_types: [application/json]
    methods: [GET, POST]
  rewrite:
    strip_prefix: /api
  openapi:
    spec: /specs/api.yaml
```

Undeclared endpoints, wrong parameter types, and invalid bodies are all blocked at the edge. OpenAPI validation runs **before** the CRS rule engine, so contract violations short-circuit early — see the [request lifecycle](../security/request-lifecycle.md). See [OpenAPI](../reference/openapi.md).

---

## Step 6 — Silence a specific false positive

One of your endpoints accepts search input that looks like a SQL `UNION` to the CRS. The [audit log](../operations/audit-log.md) tells you exactly which sub-protection is firing:

```json
{ "action": "blocked", "matched_protections": ["sql-injection", "sql-injection-union"], "route": "api" }
```

Turn off just that sub-protection — only on this route:

```yaml hl_lines="12-13"
- id: api
  match:
    paths: ["/api/*"]
  upstream: http://api:8000
  accept:
    content_types: [application/json]
    methods: [GET, POST]
  rewrite:
    strip_prefix: /api
  openapi:
    spec: /specs/api.yaml
  disable:
    - sql-injection-union
```

All other SQL-injection detections (`sql-injection-auth`, `sql-injection-boolean`, …) stay active. Always disable the **most specific** name in the log, never the whole category. See [Disable protections](../reference/disable.md) and the [protection catalog](../security/protections.md).

---

## Step 7 — Constrain the uploads route

File uploads are their own problem. Accept only multipart, cap count and size, and restrict MIME types:

```yaml hl_lines="5-11"
- id: uploads
  match:
    paths: ["/upload/*"]
  upstream: http://uploads:8000
  accept:
    content_types: [multipart/form-data]
  multipart:
    file_limit: 20
    file_size: 2MB
    allowed_types: [image/png, image/jpeg, application/pdf]
```

The `multipart` block is only active when `content_types` includes `multipart/form-data`. Barbacana validates each part of the multipart body against `allowed_types` and rejects double-extension tricks (`evil.php.pdf`) by default. See [Uploads](../reference/uploads.md).

---

## Step 8 — Put it on the public internet with auto-TLS

When you're ready for production, add a hostname at the top level:

```yaml title="waf.yaml" hl_lines="2"
version: v1alpha1
host: example.com

routes:
  - id: api
    match:
      paths: ["/api/*"]
    upstream: http://api:8000
    accept:
      content_types: [application/json]
      methods: [GET, POST]
    rewrite:
      strip_prefix: /api
    openapi:
      spec: /specs/api.yaml
    disable:
      - sql-injection-union

  - id: uploads
    match:
      paths: ["/upload/*"]
    upstream: http://uploads:8000
    accept:
      content_types: [multipart/form-data]
    multipart:
      file_limit: 20
      file_size: 2MB
      allowed_types: [image/png, image/jpeg, application/pdf]

  - id: everything-else
    upstream: http://app:8000
```

`host: example.com` switches Barbacana into **Mode 1**: HTTPS on `:443`, HTTP on `:80`, automatic HTTP→HTTPS redirect, and a Let's Encrypt certificate provisioned on first request. Certificate renewal is automatic.

!!! warning "Persist `data_dir` in containers"
    ACME state (certificates, keys, account) lives in `/data/barbacana` by default. Mount it as a persistent volume — without it you re-request certificates on every restart and will hit [Let's Encrypt's rate limits](https://letsencrypt.org/docs/rate-limits/).

This is the full example from the [project README](https://github.com/barbacana-waf/barbacana).

---

## Optional variations

### Onboard in detect-only, then switch to blocking

When retrofitting Barbacana in front of an existing app, log potential blocks for a day or two before enforcing them:

```yaml
global:
  mode: detect_only
```

In `detect_only`, Barbacana acts as a transparent reverse proxy — every request is forwarded regardless of what *would* have been blocked. Study the [audit log](../operations/audit-log.md), add targeted `disable` entries, then remove the `global.mode` override (blocking is the default). See [Detect-only mode](../reference/detect-only.md).

### Multi-host

If you serve several hostnames from one Barbacana, omit top-level `host` and give every route its own `match.hosts`:

```yaml
version: v1alpha1

routes:
  - id: api
    match:
      hosts: [api.example.com]
    upstream: http://api:8000

  - id: web
    match:
      hosts: [www.example.com]
    upstream: http://web:8000
```

Barbacana provisions one certificate per hostname (Mode 2).

### Public API with CORS

CORS is opt-in per route. Allow a known SPA origin, credentials, and a short preflight cache:

```yaml
- id: api
  # ...
  cors:
    allow_origins: ["https://app.example.com"]
    allow_methods: [GET, POST]
    allow_headers: [Authorization, Content-Type]
    allow_credentials: true
    max_age: 600
```

See [CORS](../reference/cors.md).

### Stricter headers on a sensitive route

Override the default `moderate` preset with `strict` and a custom CSP for an admin route:

```yaml
- id: admin
  match:
    paths: ["/admin/*"]
  upstream: http://admin:8000
  response_headers:
    preset: strict
    inject:
      header-csp: "default-src 'self'; frame-ancestors 'none'"
```

See [Security headers](../reference/headers.md).

---

## Where to go from here

- [Config schema](../reference/schema.md) — every field, every default, every validation rule
- [Request lifecycle](../security/request-lifecycle.md) — every stage a request passes through, and why they're ordered that way
- [Troubleshooting](troubleshooting.md) — what to do when the WAF blocks something it shouldn't
