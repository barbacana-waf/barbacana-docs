# Audit log

Barbacana writes one structured JSON entry per inspected request to stdout. Pick it up with any log shipper.

## Example

```json
{
  "timestamp": "2026-04-18T09:14:32.481923Z",
  "request_id": "01HV7C9GZX4Q2A1F8Y3K5MN6P0",
  "source_ip": "203.0.113.42",
  "method": "POST",
  "host": "api.example.com",
  "path": "/api/v1/search",
  "route_id": "api",
  "matched_protections": ["sql-injection", "sql-injection-union"],
  "matched_rules": [942100, 942180],
  "cwe": ["CWE-89"],
  "action": "blocked",
  "response_code": 403
}
```

## Fields

| Field | Type | Description |
|---|---|---|
| `timestamp` | string (RFC 3339, nanoseconds) | When the request was inspected |
| `request_id` | string | Unique per request; propagated as `X-Request-Id` to the upstream |
| `source_ip` | string | Remote client IP (after any configured trusted proxies) |
| `method` | string | HTTP method |
| `host` | string | `Host` header on the request |
| `path` | string | Request path before [rewrite](../reference/rewrites.md) |
| `route_id` | string | `id` of the matched route, or auto-generated if not set |
| `matched_protections` | string[] | Categories and sub-protections that fired. Names from the [protection catalog](../security/protections.md) — stable across releases. |
| `matched_rules` | integer[] | Underlying detection rule IDs. **May change between releases** — alert on `matched_protections`, not these. |
| `cwe` | string[] | CWE identifiers associated with the matched protections |
| `action` | string | `blocked`, `detected`, or `allowed` |
| `response_code` | integer | HTTP status returned to the client |

## `blocked` vs `detected`

| `action` | Meaning |
|---|---|
| `blocked` | Request matched a protection and was rejected. Upstream never saw it. `response_code` is typically `403`. |
| `detected` | Request matched a protection but the route is in [`detect_only` mode](../reference/detect-only.md). Forwarded to the upstream. |
| `allowed` | No protection matched. Forwarded normally. (Allowed entries are omitted by default unless audit verbosity is raised.) |

## One entry per request

Even when many protections match a single request, you get **one log line** with `matched_protections` and `matched_rules` as arrays. Do not expect a line per protection.

For shipping to a SIEM, see [Logs & SIEM](../security/logs.md).
