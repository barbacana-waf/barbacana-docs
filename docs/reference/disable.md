# Disabling protections

`disable:` turns a protection **off** on a route. The typical use is silencing a false positive without weakening the rest of the WAF.

```yaml
routes:
  - match:
      paths: ["/search"]
    upstream: http://search:8000
    disable:
      - sql-injection-union-select   # search field accepts the UNION keyword literally
```

`disable:` accepts canonical names from the [WAF Protection Catalog](catalog.md) at any of the three levels:

| Level | Example | Effect when listed |
|---|---|---|
| **L1 family** | `sql` | Whole family — every SQL leaf, both injection and data leakage |
| **L2 bucket** | `sql-injection` | One bucket — every SQLi technique, but not response-side leakage |
| **Leaf** | `sql-injection-union-select` | One detection technique only |

Always prefer the most specific name that solves the problem. After a false positive, copy the leaf name straight from `matched_protections` in the [audit log](../operations/audit-log.md).

## Precedence — most specific wins

When `enable:` and `disable:` reference overlapping levels, the **more specific name wins**. A leaf in `enable:` overrides its L2 or L1 in `disable:`, and the reverse for `disable:`.

```yaml
disable:
  - sql                              # turn off the whole SQL family…
enable:
  - sql-injection-union-select       # …except this one technique stays on
```

The two lists are not adversarial — they describe one effective set per route.

## Workflow for a false positive

1. Run the affected route in [`detect_only: true`](detect-only.md) so the request is logged but not blocked.
2. Reproduce the false positive.
3. Read `matched_protections` from the audit log — those are the names you can put under `disable:`.
4. Find the leaf in the [WAF Protection Catalog](catalog.md). The **When to toggle** column shows the rationale (and warns when disabling would lose meaningful coverage).
5. Add the most specific name (leaf > L2 > L1) to `disable:`.
6. Switch back to blocking.

!!! warning "Disable narrows your protection"
    Every name in `disable:` is a class of attacks no longer detected on that route. Disable on a single route, not globally, and revisit periodically.

## See also

- [WAF Protection Catalog](catalog.md) — every leaf, default state, and toggle rationale.
- [Enabling protections](enable.md) — the opposite list, for opting into off-by-default leaves.
- `barbacana --catalog show <leaf-name>` — print the rationale for one leaf at the CLI.
