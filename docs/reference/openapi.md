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

Even with `strict: false`, undeclared paths are logged. This surfaces *shadow APIs* — endpoints in production that are not declared in the spec.

Search the audit log for OpenAPI entries with `matched_protections` containing `openapi-path-not-in-spec` to find them.

## Disabling individual checks

```yaml
openapi:
  spec: /etc/barbacana/api.yaml
  strict: true
  disable:
    - openapi-body-mismatch    # don't validate request body schemas
```

See the [protection catalog](catalog.md) for the full `openapi-*` list.

## Authoring an OpenAPI spec

If you don't already have a spec for your API, these are the canonical starting points:

- [OpenAPI Specification 3.1](https://spec.openapis.org/oas/v3.1.0) — the source-of-truth document; Barbacana also accepts 3.0.
- [Swagger "Getting Started"](https://swagger.io/docs/specification/v3_0/about/) — practical walkthrough of the spec with examples.
- [Swagger Editor](https://editor.swagger.io/) — browser-based editor with live validation; good for hand-writing or iterating on a spec.
- [Generating specs from code](https://openapi.tools/#converters) — list of generators for Go, Python, Node, Java, etc., if you'd rather derive the spec from your handlers than maintain it separately.

Whichever route you take, point `openapi.spec` at the resulting `.yaml` or `.json` file. Barbacana parses both.
