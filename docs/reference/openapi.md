# OpenAPI

Validate requests against your OpenAPI 3.x spec. Reject anything not declared.

```yaml
routes:
  - match:
      paths: ["/api/*"]
    upstream: http://api:8000
    openapi:
      spec: /etc/barbacana/api.yaml
      strict: true
```

## What gets validated

- Path exists in the spec
- HTTP method declared for that path
- Path and query parameters match declared types
- `Content-Type` matches the operation
- Request body matches the JSON schema

A failing request returns `403` with `action: blocked` and the failure reason in the [audit log](../operations/audit-log.md).

## Strict vs detect-only

```yaml
openapi:
  spec: /etc/barbacana/api.yaml
  strict: false        # log violations, forward request
```

`strict: false` is the OpenAPI-level equivalent of [`detect_only`](detect-only.md): violations are logged but the request is forwarded. Use it while onboarding a spec.

## Shadow API discovery

Even with `strict: false`, undeclared paths are logged. This surfaces *shadow APIs* — endpoints in production that no one wrote down.

Search the audit log for OpenAPI entries with `matched_protections` containing `openapi-path` to find them.

## Disabling individual checks

```yaml
openapi:
  spec: /etc/barbacana/api.yaml
  strict: true
  disable:
    - openapi-body       # don't validate request body schemas
```

See the [protection catalog](../security/protections.md) for the full `openapi-*` list.
