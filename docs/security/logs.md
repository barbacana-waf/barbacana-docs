# Logs & SIEM

Barbacana writes structured JSON audit entries to stdout — one entry per inspected request. Pick them up with any standard log shipper and feed them to your SIEM or D&R platform.

For the field reference, see [audit log](../operations/audit-log.md).

## Log shape

- **Format**: JSON, one entry per line
- **Destination**: stdout (Barbacana writes nothing to disk)
- **Granularity**: one entry per request, never per matched protection
- **Compatible shippers**: Fluent Bit, Vector, Filebeat, Promtail, Fluentd, the Datadog/Splunk forwarders — no plugin required

## Field mapping (ECS / OCSF)

If you normalize logs into Elastic Common Schema or OCSF, here's how Barbacana fields map:

| Barbacana field | ECS field | OCSF field |
|---|---|---|
| `timestamp` | `@timestamp` | `time` |
| `request_id` | `event.id` | `metadata.uid` |
| `source_ip` | `source.ip` | `src_endpoint.ip` |
| `host` | `url.domain` | `http_request.url.hostname` |
| `path` | `url.path` | `http_request.url.path` |
| `method` | `http.request.method` | `http_request.http_method` |
| `response_code` | `http.response.status_code` | `http_response.code` |
| `route_id` | `service.name` | `metadata.product.feature.name` |
| `matched_protections` | `rule.category` | `rule.category` |
| `matched_rules` | `rule.id` | `rule.uid` |
| `cwe` | `vulnerability.classification` | `vulnerabilities.cwe.uid` |
| `anomaly_score` | `event.risk_score` | `risk_score` |
| `action` | `event.outcome` | `disposition` |

## Severity guidance

Barbacana doesn't write a severity field — derive it in your SIEM:

| Condition | Suggested severity |
|---|---|
| `action: blocked` and `anomaly_score >= 25` | **Critical** |
| `action: blocked` | **High** |
| `action: detected` and `anomaly_score >= 15` | **Medium** |
| `action: detected` | **Low** |
| `action: allowed` | **Info** (most platforms drop these by default) |

## What not to do

- **Don't parse the human-readable message** — there isn't one. Parse the JSON fields.
- **Don't rely on log line ordering** across pods or replicas. Correlate by `request_id`.
- **Don't alert on `matched_rules` IDs** — these come from the underlying rule set and can change between Barbacana releases. Alert on `matched_protections` names, which are stable.
