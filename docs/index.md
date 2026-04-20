---
hide:
  - navigation
---

# Barbacana

**Secure by default. Simple by design.**

Barbacana is an open-source WAF and API security gateway. It sits between the internet and your application, inspects every HTTP request for known attack patterns — SQL injection, XSS, command injection, path traversal, and hundreds more — and blocks malicious requests before they reach your code.

![How a WAF works](assets/architecture-layout.jpg)

## Quickstart

```yaml title="waf.yaml"
version: v1alpha1

routes:
  - upstream: http://your-app:8000
```

```bash
docker run --rm -p 8080:8080 \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest serve
```

That's it. Every protection is on by default. [Full quickstart →](getting-started/quickstart.md)

## Why Barbacana

Most WAFs need deep security expertise, a full platform, or a cloud subscription. Barbacana gives you production-grade protection with a YAML file, human-readable protection names, and a single binary.

You disable `sql-injection-union` on a noisy route — not `SecRuleRemoveById 942100`.

<div class="grid cards" markdown>

-   :material-shield-lock:{ .lg .middle } __Secure by default__

    ---

    Every protection on at install. You disable what you don't need.

-   :material-file-code:{ .lg .middle } __Simple YAML__

    ---

    No rule syntax, no DSL. Three lines of YAML protect a route.

-   :material-lock-check:{ .lg .middle } __Auto-TLS__

    ---

    Add a hostname; certificates provision and renew automatically.

-   :material-package-variant-closed:{ .lg .middle } __Single binary__

    ---

    No platform to operate. One container image, one config file.

-   :material-format-list-checks:{ .lg .middle } __500+ OWASP rules__

    ---

    Backed by the OWASP Core Rule Set, exposed as named protections.

</div>

## Built on

- [Caddy](https://caddyserver.com) — HTTP server, TLS, HTTP/2, HTTP/3, reverse proxy
- [Coraza](https://coraza.io) — WAF engine (pure Go, no CGO)
- [OWASP CRS v4](https://coreruleset.org) — attack detection rules

Barbacana wraps all three so you don't have to learn any of them.

## Thanks

Barbacana stands on the shoulders of the **Caddy**, **Coraza**, and **OWASP CRS** communities. Two decades of work by their maintainers, contributors, and researchers make this project possible — a handful of YAML lines can deliver production-grade protection only because that groundwork already exists. Thank you.
