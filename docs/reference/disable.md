# Disable protections

Every protection is on by default. To turn one off, name it.

```yaml
routes:
  - match:
      paths: ["/search"]
    upstream: http://search:8000
    disable:
      - sql-injection-union   # false positive: search field uses UNION literally
```

## Categories vs sub-protections

- **Category** — disable the whole class. `sql-injection` turns off all SQL-injection detection on this route.
- **Sub-protection** — disable one technique. `sql-injection-union` turns off only UNION-based detection; everything else stays on.

Always prefer the most specific name that fixes your false positive.

```yaml
disable:
  - sql-injection-union   # specific technique
  - data-leakage-php      # specific category (no sub-protections)
```

## Finding the right name

- See the full [protection catalog](../security/protections.md).
- After a false-positive request, check the [audit log](../operations/audit-log.md): `matched_protections` lists exactly the names you can put under `disable`.

## Workflow for a false positive

1. Run in [`detect_only: true`](detect-only.md) so the request is logged but not blocked.
2. Reproduce the false positive.
3. Read `matched_protections` from the audit log.
4. Add the most specific name to `disable`.
5. Switch back to blocking.

!!! warning "Disable narrows your protection"
    Every name in `disable` is a class of attacks no longer detected on that route. Disable on a single route, not globally, and revisit periodically.
