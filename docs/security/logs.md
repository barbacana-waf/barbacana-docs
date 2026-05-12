# Logs & SIEM

Barbacana writes structured JSON audit entries to stdout — one entry per inspected request. Pick them up with any standard log shipper and feed them to your Security Information and Event Management (SIEM) or detection and response (D&R) platform.

For the field reference and full document examples, see [audit log](../operations/audit-log.md).

## Log shape

- **Format**: JSON, one entry per line, one entry per inspected request — never one per matched protection
- **Schema**: OCSF v1.2.0 by default, switchable to ECS 8.x via `audit_log.format`
- **Destination**: stdout (Barbacana writes nothing to disk)
- **Compatible shippers**: Fluent Bit, Vector, Filebeat, Promtail, Fluentd, the Datadog/Splunk forwarders — no plugin required

Both schemas also emit a vendor `barbacana.*` namespace carrying `matched_protections`, `matched_rules`, and `cwe` verbatim, for ad-hoc shell pipelines that pre-date schema-aware tooling.

## Pick a schema based on where you ship logs

| Your SIEM / log platform | Recommended `audit_log.format` |
|---|---|
| Elastic stack (Elasticsearch / Kibana / Filebeat / Logstash) with existing ECS dashboards | `ecs` |
| Splunk, Sumo Logic, Datadog, Chronicle, Sentinel, OpenSearch, custom OCSF pipelines | `ocsf` (default) |
| Loki / Grafana Explore (no schema enforcement) | either — `ocsf` is the default |
| In-house / homegrown ingest | `ocsf` (modern industry standard) |

The output is already in the schema your platform expects, so no normalization layer is required. If you previously maintained Logstash or Vector mappings to translate Barbacana's flat fields into ECS, those translation rules should now be empty passthroughs.

## Severity guidance

Barbacana does not write a severity field — derive it in your SIEM from the disposition and the anomaly score. For OCSF the score lives at `risk_score`; for ECS at `risk.static_score`.

| Condition (OCSF) | Equivalent (ECS) | Suggested severity |
|---|---|---|
| `disposition_id == 2` and `risk_score >= 25` | `event.action == "block"` and `risk.static_score >= 25` | **Critical** |
| `disposition_id == 2` | `event.action == "block"` | **High** |
| disposition `Detected` and `risk_score >= 15` | `event.action == "detect"` and `risk.static_score >= 15` | **Medium** |
| disposition `Detected` | `event.action == "detect"` | **Low** |
| `disposition_id == 1` (allowed) | `event.action == "allow"` | **Info** (most platforms drop these by default) |

## Trace-aware correlation

When [distributed tracing](../operations/tracing.md) is enabled, every audit document carries the active trace and span IDs:

- **OCSF**: `metadata.trace_id` (32 hex), `metadata.span_id` (16 hex)
- **ECS**: native top-level `trace.id` and `span.id`

Use these to pivot from a SIEM detection straight to the matching trace in Jaeger, Tempo, or your OTLP backend. A single `http_request.uid` (OCSF) or `labels.request_id` (ECS) value pins to exactly one trace.

## What not to do

- **Don't parse the human-readable message** — there isn't one. Parse the JSON fields.
- **Don't rely on log line ordering** across pods or replicas. Correlate by request ID, not by sequence.
- **Don't alert on rule IDs** — `firewall_rule.match_details` (OCSF) or `rule.reference` (ECS) come from the underlying rule set and can change between Barbacana releases. Alert on the protection names (`attacks[].name` in OCSF, `rule.name` in ECS, or `barbacana.matched_protections` on either format), which are stable.
- **Don't alert on the vendor `barbacana.*` namespace as the source of truth.** It exists for shell pipelines and migration parity. SIEM detection rules should target the schema-standard fields.
- **Don't expect the previous flat field shape.** `matched_protections`, `matched_rules`, and `cwe` no longer appear at the document root — they live under `barbacana.*` and inside the schema-mapped locations.
