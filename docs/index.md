---
hide:
  - navigation
---

# Barbacana

**Secure by default. Simple by design.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/barbacana-waf/barbacana)](https://github.com/barbacana-waf/barbacana/releases)

Barbacana is an open-source WAF and API security gateway. It sits between the internet and your application, inspects every HTTP request for known attack patterns — SQL injection, XSS, command injection, path traversal, and hundreds more — and blocks malicious requests before they reach your code.

In independent testing, v0.1.0 blocked 82% of attacks that arrived in plain or URL-encoded form, and allowed 91% of legitimate traffic through. [See the full analysis](blog/2026/04/22/v010-security-baseline-what-barbacana-catches-what-it-misses-and-what-comes-next/).

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
  ghcr.io/barbacana-waf/barbacana:latest
```

That's it. Every protection is on by default. [Full quickstart →](getting-started/quickstart.md)

## Why Barbacana

Most WAFs need deep security expertise, a full platform, or a cloud subscription. Barbacana gives you production-grade protection with a YAML file, human-readable protection names, and a single binary.

You disable `sql-injection-union` on a noisy route — not `SecRuleRemoveById 942100`.

<div class="grid cards" markdown>

-   :material-shield-lock:{ .lg .middle } __Secure by default__

    ---

    Every protection on from the first request. No rules to download, no policies to write.

-   :material-file-code:{ .lg .middle } __Simple YAML__

    ---

    No rule syntax, no DSL. Three lines of YAML protect a route.

-   :material-lock-check:{ .lg .middle } __Auto-TLS__

    ---

    Add a hostname. Certificates provision and renew automatically.

-   :material-package-variant-closed:{ .lg .middle } __Single binary__

    ---

    One container image, one config file. No platform to operate.

-   :material-format-list-checks:{ .lg .middle } __500+ OWASP rules__

    ---

    Backed by the OWASP Core Rule Set, exposed as named protections.

-   :material-chart-line:{ .lg .middle } __Measured detection__

    ---

    Every release is tested against OWASP CRS and GoTestWAF. Results published in full.

</div>

## Built on

Barbacana wraps [Caddy](https://caddyserver.com) (HTTP, TLS, reverse proxy), [Coraza](https://coraza.io) (WAF engine), and the [OWASP CRS v4](https://coreruleset.org) (detection rules) — so you don't have to learn any of them. Two decades of community work make this project possible. Thank you to their maintainers and contributors.
