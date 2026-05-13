# Getting Started

This section takes you from zero to a working Barbacana deployment in front of your application. No prior WAF knowledge required.

## Key concepts

**Defaults are on.** The minimal config is three lines of YAML — one route, one upstream. Every protection activates immediately: SQL injection, XSS, command injection, path traversal, and hundreds more. Nothing to enable.

**Config grows with you.** Add a hostname for auto-TLS, an OpenAPI spec for schema validation, `accept` rules to restrict methods and content types, or per-route `disable` entries to silence false positives. Each piece is independent — add the ones you need, in any order.

**False positives are fixable without weakening the WAF.** Every protection has a human-readable name. Disabling `sql-injection-union-select` on `/search` leaves every other rule on every other route untouched.

## In this section

| Page | What it covers |
|---|---|
| [Why Barbacana?](why-barbacana.md) | What a WAF is, what Barbacana specifically does and doesn't protect, the limits of the approach |
| [Quickstart](quickstart.md) | A working deployment in three lines of YAML |
| [Installation](installation.md) | Docker and Docker Compose, including auto-TLS |
| [Binary install](binary.md) | Download and run the native binary; run as a Linux systemd service |
| [Configuration](incremental.md) | Building from a single upstream to a full production config, step by step |
| [Troubleshooting](troubleshooting.md) | Common problems in the first hour: unexpected blocks, CORS errors, config rejections |

## Where to start

New to WAFs or Barbacana → read [Why Barbacana?](why-barbacana.md) first.

Want it running now → go straight to the [Quickstart](quickstart.md).
