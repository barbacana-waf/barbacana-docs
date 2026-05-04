---
hide:
  - navigation
  - toc
---

# Barbacana

**Secure by default. Simple by design.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/barbacana-waf/barbacana)](https://github.com/barbacana-waf/barbacana/releases)

Barbacana is an open-source WAF and API security gateway. It sits between the internet and your application, inspects every HTTP request for known attack patterns — SQL injection, XSS, command injection, path traversal, and hundreds more — and blocks malicious requests before they reach your server.

In tests with [GoTestWAF](https://github.com/wallarm/gotestwaf), a 3rd party open-source WAF benchmark, v0.1.0 blocked 82% of attacks that arrived in plain or URL-encoded form, and allowed 91% of legitimate traffic through. [See the full analysis](blog/2026/04/22/v010-security-baseline-what-barbacana-catches-what-it-misses-and-what-comes-next/).

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

## Beyond the defaults

The defaults cover the happy path. When you need to tune a noisy route, terminate TLS, or roll out a new endpoint without blocking traffic — the config stays just as small.

<div class="feature-row" markdown>
<div class="feature-text" markdown>
:material-tune-variant:{ .feature-icon }

### Tune by name, not by rule ID

Silence a false positive on one route without weakening the rest of the WAF. Protections have human-readable names — never `SecRuleRemoveById 942270`.
</div>
<div class="feature-code" markdown>
```yaml
routes:
  - match:
      paths: ["/search"]
    upstream: http://search:8000
    disable:
      - sql-injection-union-select
```
</div>
</div>

<div class="feature-row" markdown>
<div class="feature-text" markdown>
:material-lock-check:{ .feature-icon }

### HTTPS, no certificates to manage

Add a hostname. Barbacana provisions and renews Let's Encrypt certificates automatically, redirects `:80` to `:443`, and uses a local CA for `.localhost` development.
</div>
<div class="feature-code" markdown>
```yaml
version: v1alpha1
host: api.example.com
data_dir: /data/barbacana
routes:
  - upstream: http://app:8080
```
</div>
</div>

<div class="feature-row" markdown>
<div class="feature-text" markdown>
:material-shield-search:{ .feature-icon }

### Ship safely with detect-only

Roll out a new route in observe mode first. Every request is inspected and logged, but matches are forwarded instead of blocked — read the audit log, then flip the switch.
</div>
<div class="feature-code" markdown>
```yaml
routes:
  - upstream: http://api:8000
    detect_only: true
```
</div>
</div>

<p class="trust-strip" markdown>
:material-package-variant-closed: Single image &middot;
:material-format-list-checks: 500+ OWASP CRS rules &middot;
:material-license: Apache 2.0
</p>

<div class="cta-row" markdown>
[:material-rocket-launch: &nbsp; **Full quickstart**](getting-started/quickstart.md){ .md-button .md-button--primary }
[:material-format-list-checks: &nbsp; **Protection catalog**](reference/catalog.md){ .md-button }
[:material-shield-half-full: &nbsp; **Security model**](security/overview.md){ .md-button }
</div>

## Built on

Barbacana wraps [Caddy](https://caddyserver.com) (HTTP, TLS, reverse proxy), [Coraza](https://coraza.io) (WAF engine), and the [OWASP CRS v4](https://coreruleset.org) (detection rules) — two decades of work by the security community made this project possible. Big thanks to their maintainers and contributors.

Barbacana also runs `ghcr.io/barbacana-waf/barbacana` as the main image registry, with an identical mirror at `docker.io/barbacana/barbacana`.
