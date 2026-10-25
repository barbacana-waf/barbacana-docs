# Metrics

Metrics are numeric time-series that describe what Barbacana is doing in production: how many requests arrive, how many get blocked, which protections fire, how long inspection takes. Scrape them with Prometheus, chart them in Grafana, and alert on them in your monitoring system.

Barbacana exposes them on a separate HTTP server (default `:9090`, path `/metrics`) in the standard Prometheus text format.

!!! warning "Off by default"
    `metrics_port` defaults to `0`, which disables the metrics server entirely. Set it to a real port to opt in. This keeps the network surface minimal for deployments that don't need metrics endpoint.

!!! tip "Ready-made dashboard"
    These metrics are designed around the [Barbacana Grafana dashboard](dashboard.md) — one JSON, one import, one URL to bookmark. The catalog below is the underlying surface; the dashboard is the recommended way to consume it.


## Counters

| Name | Labels | Description |
|---|---|---|
| `waf_requests_total` | `route`, `action` | All requests by action (`blocked`, `detected`, `allowed`) |
| `waf_requests_blocked_total` | `route`, `protection` | Requests blocked or detected, broken down by leaf name (e.g. `sql-injection-union-select`, `command-injection-unix-commands`) |
| `waf_openapi_validation_total` | `route`, `result` | OpenAPI validation outcomes (`pass`, `fail`) |
| `waf_evaluation_timeout_total` | `route` | Inspection that exceeded the per-request timeout |
| `waf_detected_threats_total` | `route`, `protection` | Threats observed in both modes, once per matched leaf. A request that matches several protections counts several times |
| `waf_body_inspection_skipped_total` | `route` | Requests forwarded without body inspection because the body could not be read. Expected to stay at `0`; alert on any sustained rate |
| `waf_body_spooled_total` | `route` | Not incremented in this version: request bodies are held in memory, not spooled to disk. See [Request lifecycle](../security/request-lifecycle.md#memory) |
| `waf_decompression_rejected_total` | `route` | Requests rejected for excessive decompression ratio |
| `waf_security_headers_injected_total` | `route`, `header` | Security response headers injected |
| `waf_config_reload_total` | `result` | Config reload attempts (`success`, `error`) |
| `waf_upstream_errors_total` | `route`, `kind` | Proxy-side failures: `timeout`, `connection_refused`, `5xx` (upstream returned a status of 500 or above), `other`. Tells an upstream failure apart from a WAF block |

## Gauges

| Name | Labels | Description |
|---|---|---|
| `waf_build_info` | `version`, `go_version`, `crs_version` | Always `1`. Use for build-info joins. |
| `waf_config_reload_timestamp_seconds` | — | Unix timestamp of last successful reload |
| `waf_crs_rules_loaded_total` | — | Number of detection rules loaded |
| `waf_mode_info` | `route`, `mode` | Always `1`. The `mode` label is `blocking` or `detect_only`. Use it to show the active mode or to alert when a route runs in `detect_only` |
| `waf_requests_in_flight` | — | Requests being evaluated right now. Rising while the `waf_requests_total` rate stays flat points to a stuck pipeline |

## Histograms

| Name | Labels | Description |
|---|---|---|
| `waf_request_duration_overhead_seconds` | `route` | Time spent in WAF inspection per request |
| `waf_anomaly_score_histogram` | `route` | Distribution of CRS anomaly scores per request |

## Example queries

**Top blocked protections (5-minute rate):**

```promql
topk(10, sum by (protection) (rate(waf_requests_blocked_total[5m])))
```

**Block rate as percentage of total traffic, per route:**

```promql
sum by (route) (rate(waf_requests_total{action="blocked"}[5m]))
  /
sum by (route) (rate(waf_requests_total[5m]))
```

**WAF p99 overhead per route:**

```promql
histogram_quantile(0.99, sum by (route, le) (rate(waf_request_duration_overhead_seconds_bucket[5m])))
```

**Reload failures in the last hour:**

```promql
increase(waf_config_reload_total{result="error"}[1h])
```

