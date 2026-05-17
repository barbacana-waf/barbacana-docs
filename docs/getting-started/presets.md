# Application presets

This section shares starting-point configurations for common self-hosted applications.

In case application stops working, switch to `detect_only` mode, it will work again, add normal traffic flow and read the [audit log](../operations/audit-log.md) for `action: detected` entries. Each entry is a false positive, add them into the `disable:` entries, then switch back the detect mode to enable blocking. See [Detect-only mode](../reference/detect-only.md).

!!! info "Rate limiting behind a proxy"
    Each preset rate-limits login endpoints with `source.type: ip`, which is correct when the client connects directly to Barbacana. If Barbacana runs behind a load balancer or reverse proxy, every connection appears to come from the proxy — switch to `source.type: header` and name the forwarded header your proxy injects (typically `X-Forwarded-For` or `X-Real-IP`). See [Rate limiting — Identifying the client](../reference/rate-limit.md#identifying-the-client).

---

| Preset                            | Description                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [WordPress](presets-wordpress.md) | Standard WordPress and WordPress + WooCommerce, with login protection, REST API routing, and admin isolation. |
| [Nextcloud](presets-nextcloud.md) | WebDAV file sync, CalDAV and CardDAV, and OCS API.                                                            |
| [Ghost](presets-ghost.md)         | Node.js blog with admin editor isolation and member rate limiting.                                            |

!!! warning "Feedback is welcomed"
    Each preset has been assembled from public documentation and known OWASP CRS compatibility notes — treat them as a first draft, not a verified, production-ready config. They need feedback and more validation against multiple real installations.
