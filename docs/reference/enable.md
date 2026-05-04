# Enabling protections

`enable:` turns an off-by-default protection **on** for a route. Most of the catalog is on out of the box; `enable:` is how you opt into the rest.

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
    enable:
      - response-headers-add-csp        # this route has a tuned CSP value
      - sql-injection-quotes-in-text    # API doesn't take free-form text, FP risk is low
    response_headers:
      inject:
        response-headers-add-csp: "default-src 'self'"
```

`enable:` accepts canonical names from the [WAF Protection Catalog](catalog.md) at any of the three levels (L1 family, L2 bucket, leaf). The catalog's **When to toggle** column gives the per-leaf rationale for opting in.

## What ships off by default

Two groups of leaves are off until you opt in:

- **Aggressive variants** of an on-by-default detector. They catch more attacks but fire on legitimate inputs. Examples: `sql-injection-quotes-in-text` (auth-bypass shapes that also flag `O'Brien`), `command-injection-english-words` (triggers on plain text containing `echo`, `curl`, `bash`), `cross-site-scripting-angular-templates` (only useful if the server actually renders Angular templates).
- **Response-side hardening that requires per-app tuning.** `response-headers-add-csp`, `response-headers-add-coop`, `response-headers-add-coep`, `response-headers-add-corp`, `response-headers-add-permissions-policy`, `response-headers-add-cache-control`. There's no value strict enough to matter that's safe to apply universally — see the [security headers reference](headers.md) for how to enable each one.
- **HTTP-compliance checks that flag automation more than attack.** `http-compliance-accept-header`, `http-compliance-user-agent-header`, `http-compliance-method-override-param`, `http-compliance-double-url-encoding`, `http-attacks-duplicate-parameters`. Enable when the route is for browser traffic only and you want stricter shape enforcement.

Browse the [WAF Protection Catalog](catalog.md) for the full list and each leaf's rationale. `barbacana --catalog show <leaf-name>` prints the same information for one leaf at the CLI.

## Precedence — most specific wins

When `enable:` and `disable:` reference overlapping levels, the **more specific name wins**.

```yaml
enable:
  - command-injection                # opt into the whole bucket…
disable:
  - command-injection-english-words  # …except this aggressive variant which FPs on prose
```

A leaf overrides its L2; an L2 overrides its L1. The same rule applies in reverse — see [Disabling protections](disable.md) for the symmetric example.

## Workflow for opting in

1. Find the leaf in the [WAF Protection Catalog](catalog.md). The **When to toggle** column states the extra coverage and the FP cost.
2. Add it to `enable:` on the route. Start with one route, not globally.
3. Switch the route to [`detect_only: true`](detect-only.md) for a few days so any FPs surface in the audit log without breaking traffic.
4. Once the audit log is clean, switch back to blocking mode.

For response-header leaves (`response-headers-add-*`), `enable:` causes Barbacana to inject the header with its [built-in default value](headers.md#headers-injected). Supply `response_headers.inject:` to override.

## See also

- [WAF Protection Catalog](catalog.md) — every leaf, default state, and toggle rationale.
- [Disabling protections](disable.md) — the opposite list, for silencing false positives.
- [Security headers](headers.md) — how to wire up `response-headers-add-csp` and friends with a tuned value.
