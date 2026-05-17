---
hide:
  - toc
---

# Ghost

[Ghost](https://ghost.org) is an open-source Node.js publishing platform focused on newsletters and subscription-based content. It exposes a REST admin API, a public Content API, and a members API for subscriber management — each with different trust levels and traffic characteristics.

Ghost routes the admin area and public blog through a single Node.js process. The admin editor saves post content as Mobiledoc JSON, which embeds raw HTML blocks — these are the primary source of false positives. The admin API starts in detect-only mode. The public Content API is read-only JSON and can run in blocking mode from the start.

Member login and signup are rate-limited to slow credential stuffing against subscriber accounts.

```yaml title="waf.yaml"
version: v1alpha1
host: example.com
data_dir: /data/barbacana

routes:
  - id: ghost-session
    match:
      paths: [/ghost/api/admin/session]
    upstream: http://ghost:2368
    accept:
      content_types: [application/json]
      methods: [POST, DELETE]
    rate_limit:
      requests: 5
      window: 60s
      source:
        type: ip

  - id: ghost-content-api
    match:
      paths: [/ghost/api/content/*]
    upstream: http://ghost:2368
    accept:
      content_types: [application/json]
      methods: [GET]

  - id: ghost-admin-api
    match:
      paths: [/ghost/api/*]
    upstream: http://ghost:2368
    accept:
      content_types: [application/json, multipart/form-data]
      methods: [GET, POST, PUT, DELETE]
    mode: detect_only

  - id: ghost-admin-ui
    match:
      paths: [/ghost/*]
    upstream: http://ghost:2368

  - id: ghost-members
    match:
      paths: [/members/*]
    upstream: http://ghost:2368
    accept:
      content_types: [application/json]
      methods: [GET, POST, PUT, DELETE]
    rate_limit:
      requests: 10
      window: 60s
      source:
        type: ip

  - id: frontend
    upstream: http://ghost:2368
```

## Tuning notes

The admin API is set to detect-only because Ghost's Mobiledoc format stores post content as a JSON document that can include raw HTML, embedded scripts, and code blocks. The `cross-site-scripting` family is the most likely to fire. After reviewing audit events from real editing sessions, add targeted `disable:` entries to the `ghost-admin-api` route.

Ghost 4.x and earlier placed the admin API at versioned paths such as `/ghost/api/v2/admin/session`. If you are running an older Ghost version, adjust the `ghost-session` path accordingly.

The `ghost-members` route rate-limits all member API calls at 10 per minute. If your site has burst activity — newsletter signups after a post goes live, for example — raise the `requests` value or narrow the `paths` match to the specific authentication endpoints (`/members/api/send-magic-link`, `/members/api/member`).
