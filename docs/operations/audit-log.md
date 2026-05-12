# Audit log

Barbacana writes one structured JSON entry per inspected request to stdout. Pick it up with any log shipper.

Stdout emission is **always on** — there is no off switch and no per-route override. What you choose with `audit_log.format` is the *wire schema* of the JSON document.

## Two schemas, no flat shape

Audit logs ship in one of two industry-standard schemas:

| `audit_log.format` | Wire schema |
|---|---|
| `ocsf` (default) | OCSF v1.2.0 — Open Cybersecurity Schema Framework, HTTP Activity event class (`class_uid: 4002`) |
| `ecs` | ECS 8.x — Elastic Common Schema |

The format is process-wide and decided once at startup. Switching formats requires a config reload; one running process never mixes the two.

```yaml title="waf.yaml"
version: v1alpha1

audit_log:
  format: ocsf       # default; or "ecs"

routes:
  - upstream: http://app:8000
```

Pick `ocsf` if you do not already have schema-aware dashboards — it is the default for a reason and most modern Security Information and Event Management (SIEM) systems ingest it natively. Pick `ecs` if you ship logs to an Elastic stack (Elasticsearch, Kibana, Filebeat, Logstash) with existing ECS pipelines or detection rules.

## OCSF example

Blocked SQL injection, OCSF v1.2.0:

```json
{
  "class_uid": 4002,
  "class_name": "HTTP Activity",
  "category_uid": 4,
  "category_name": "Network Activity",
  "activity_id": 6,
  "type_uid": 400206,
  "severity_id": 4,
  "time": 1768378331482,
  "disposition": "Blocked",
  "disposition_id": 2,
  "status": "Failure",
  "status_code": 403,
  "risk_score": 15,
  "http_request": {
    "http_method": "POST",
    "url": {"path": "/v1/users", "url_string": "https://api.example.com/v1/users", "hostname": "api.example.com"},
    "uid": "01HX4Y..."
  },
  "src_endpoint": {"ip": "203.0.113.7", "port": 54321},
  "metadata": {
    "version": "1.2.0",
    "product": {"name": "barbacana", "vendor_name": "barbacana"},
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "span_id": "00f067aa0ba902b7"
  },
  "attacks": [
    {
      "name": "sql-injection-auth-bypass",
      "category": "sql-injection",
      "classification": [{"taxonomy": "CWE", "category": "CWE-89", "category_id": "CWE-89"}]
    }
  ],
  "firewall_rule": {"uid": "942100", "match_details": ["942100", "942110"], "category": "sql-injection-auth-bypass"},
  "barbacana": {
    "matched_protections": ["sql-injection-auth-bypass"],
    "matched_rules": ["942100", "942110"],
    "cwe": ["CWE-89"]
  }
}
```

## ECS example

The same event in ECS 8.x:

```json
{
  "@timestamp": "2026-04-14T10:32:11.482000000Z",
  "ecs": {"version": "8.11.0"},
  "event": {
    "kind": "alert",
    "category": ["intrusion_detection"],
    "action": "block",
    "outcome": "failure",
    "dataset": "barbacana.audit",
    "module": "barbacana"
  },
  "rule": {
    "ruleset": "owasp-crs",
    "name": "sql-injection-auth-bypass",
    "category": "sql-injection-auth-bypass",
    "id": "942100",
    "reference": ["942100", "942110"]
  },
  "vulnerability": {"classification": ["CWE-89"]},
  "client": {"ip": "203.0.113.7", "address": "203.0.113.7", "port": 54321},
  "url": {"path": "/v1/users", "full": "https://api.example.com/v1/users", "domain": "api.example.com"},
  "http": {"request": {"method": "POST"}, "response": {"status_code": 403}},
  "user_agent": {"original": "..."},
  "risk": {"static_score": 15},
  "labels": {"request_id": "01HX4Y...", "route_id": "public-api"},
  "trace": {"id": "4bf92f3577b34da6a3ce929d0e0e4736"},
  "span": {"id": "00f067aa0ba902b7"},
  "barbacana": {
    "matched_protections": ["sql-injection-auth-bypass"],
    "matched_rules": ["942100", "942110"],
    "cwe": ["CWE-89"]
  }
}
```

## Where to find each piece of information

The two schemas place the same facts in different fields. The vendor namespace `barbacana.*` is identical on both formats.

| You want… | OCSF path | ECS path | Vendor (both) |
|---|---|---|---|
| Timestamp | `time` (epoch ms) | `@timestamp` (RFC 3339) | — |
| Request ID | `http_request.uid` | `labels.request_id` | — |
| Route ID | (in metadata) | `labels.route_id` | — |
| Source IP | `src_endpoint.ip` | `client.ip` | — |
| Method | `http_request.http_method` | `http.request.method` | — |
| Path | `http_request.url.path` | `url.path` | — |
| Host | `http_request.url.hostname` | `url.domain` | — |
| Response code | `status_code` | `http.response.status_code` | — |
| Disposition (block / detect / allow) | `disposition`, `disposition_id` | `event.action`, `event.outcome` | — |
| Anomaly score | `risk_score` | `risk.static_score` | — |
| Matched protections | `attacks[].name` / `attacks[].category` | `rule.name` / `rule.category` | `barbacana.matched_protections` |
| Underlying rule IDs | `firewall_rule.match_details` | `rule.reference` | `barbacana.matched_rules` |
| CWE classifications | `attacks[].classification[]` | `vulnerability.classification[]` | `barbacana.cwe` |
| Trace ID | `metadata.trace_id` | `trace.id` | — |
| Span ID | `metadata.span_id` | `span.id` | — |

The schema-standard fields are the source of truth for SIEM dashboards and detection rules. The vendor `barbacana.*` namespace mirrors `matched_protections`, `matched_rules`, and `cwe` verbatim — so the same `jq` and `grep` workflows that worked against the previous flat shape continue to work on either format.

## The vendor namespace

Both OCSF and ECS permit additional top-level attributes outside the standard schema. Barbacana uses that allowance to emit a flat `barbacana` object on every audit document:

```json
"barbacana": {
  "matched_protections": ["sql-injection-auth-bypass"],
  "matched_rules": ["942100", "942110"],
  "cwe": ["CWE-89"]
}
```

It is not a substitute for the schema-mapped fields — SIEM rules should target the standard locations. It exists so that ad-hoc shell pipelines stay readable:

```bash
docker logs barbacana | jq -r '.barbacana.matched_protections[]?' | sort | uniq -c | sort -rn
```

## `blocked` vs `detected` vs `allowed`

| Disposition | Meaning |
|---|---|
| `blocked` | Request matched a protection and was rejected. Upstream never saw it. Status code is typically `403`. |
| `detected` | Request matched a protection but the route is in [`detect_only` mode](../reference/detect-only.md). Forwarded to the upstream. |
| `allowed` | No protection matched. Forwarded normally. Allowed entries are omitted by default unless audit verbosity is raised. |

In OCSF, this maps to `disposition` / `disposition_id` (`Blocked` = `2`, `Allowed` = `1`). In ECS, the same fact is encoded as `event.action` (`block` / `detect` / `allow`) with `event.outcome` (`failure` for blocks, `success` for allows).

## Trace correlation

When [distributed tracing](tracing.md) is enabled, every audit document carries the active span's trace and span IDs:

- **OCSF**: `metadata.trace_id`, `metadata.span_id` (32-hex and 16-hex W3C trace context IDs)
- **ECS**: native top-level `trace.id` and `span.id` fields

When tracing is disabled, neither formatter emits the keys — they are absent rather than present-and-empty. This means a single `request_id` in the audit log lines up directly with the matching trace in Jaeger, Tempo, or any other OTLP-compatible backend.

## One entry per request

Even when many protections match a single request, you get **one log line** with `barbacana.matched_protections` (and the schema-standard equivalents) as arrays. There is no line-per-protection mode.

In blocking mode, the audit document is emitted at the moment a stage halts the pipeline. The fields aggregate every match accumulated up to that point. In `detect_only` mode, audit emission happens once at the end of all stages and aggregates everything matched across the request.

## Migration from the previous flat shape

Earlier Barbacana releases emitted a single flat object with `matched_protections`, `matched_rules`, and `cwe` at the document root. That shape has been removed. To migrate:

1. **Set `audit_log.format` explicitly.** OCSF is the default; if you have an existing Elastic ingest pipeline, set `format: ecs`.
2. **Update SIEM detection rules and dashboards** to read from the OCSF or ECS field names per the table above. The schema-standard locations are the recommended target.
3. **Existing `jq`/`grep` workflows** that read `.matched_protections`, `.matched_rules`, or `.cwe` should be repointed to `.barbacana.matched_protections`, `.barbacana.matched_rules`, `.barbacana.cwe`. The values are byte-for-byte the same.

There is no `legacy` format value; the previous shape is not preserved at the document root on either format.

For shipping to a SIEM, see [Logs & SIEM](../security/logs.md).
