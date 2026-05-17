# Nextcloud

[Nextcloud](https://nextcloud.com) is an open-source platform for self-hosted file sync, calendar, contacts, and collaboration. It speaks WebDAV for file access and CalDAV/CardDAV for calendar and contacts, which means its traffic mix is significantly different from a standard web application — the WAF must allow additional HTTP methods and handle XML request bodies from desktop and mobile sync clients.

Nextcloud traffic includes standard web requests, WebDAV file sync, and CalDAV and CardDAV for calendar and contacts. The WebDAV routes require additional HTTP methods beyond the default set and accept XML request bodies.

```yaml title="waf.yaml"
version: v1alpha1
host: example.com
data_dir: /data/barbacana

routes:
  - id: nc-login
    match:
      paths: [/login]
    upstream: http://nextcloud:80
    rate_limit:
      requests: 5
      window: 60s
      source:
        type: ip

  - id: nc-webdav
    match:
      paths: [/remote.php/dav/*, /remote.php/webdav/*]
    upstream: http://nextcloud:80
    accept:
      methods: [GET, POST, PUT, DELETE, HEAD, OPTIONS, PROPFIND, MKCOL, COPY, MOVE, LOCK, UNLOCK, PROPPATCH, REPORT]
      max_body_size: 1GB
    mode: detect_only

  - id: nc-ocs
    match:
      paths: [/ocs/v1.php/*, /ocs/v2.php/*]
    upstream: http://nextcloud:80
    accept:
      content_types: [application/json, application/xml, text/xml]
      methods: [GET, POST, PUT, DELETE]

  - id: frontend
    upstream: http://nextcloud:80
```

## Tuning notes

The WebDAV route is set to detect-only because CalDAV and CardDAV payloads contain free-text fields — DESCRIPTION and SUMMARY in iCalendar, NOTE and ADR in vCard — whose content can match SQL injection and XSS rules. After collecting audit events from real sync traffic, disable specific leaves on the `nc-webdav` route.

The `max_body_size` cap of 1 GB is the maximum the schema allows. Nextcloud supports files larger than 1 GB — uploads beyond that limit will be blocked. For deployments that sync large files, consider terminating those requests at a load balancer that proxies the WebDAV path directly to Nextcloud, bypassing Barbacana for file content only.

If Nextcloud authenticates through LDAP, SAML, or an external SSO provider, the login redirect path may differ from `/login`. Adjust the `nc-login` match to cover the actual authentication endpoint.
