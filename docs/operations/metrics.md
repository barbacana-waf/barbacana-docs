# Metrics

Metrics are numeric time-series that describe what Barbacana is doing in production: how many requests arrive, how many get blocked, which protections fire, how long inspection takes. Scrape them with Prometheus, chart them in Grafana, and alert on them in your monitoring system.

Barbacana exposes them on a separate HTTP server (default `:9090`, path `/metrics`) in the standard Prometheus text format.

!!! warning "Off by default"
    `metrics_port` defaults to `0`, which disables the metrics server entirely. Set it to a real port to opt in. This keeps the network surface minimal for deployments that don't need metrics endpoint.


## Counters

| Name | Labels | Description |
|---|---|---|
| `waf_requests_total` | `route`, `action` | All requests by action (`blocked`, `detected`, `allowed`) |
| `waf_requests_blocked_total` | `route`, `protection` | Requests blocked or detected, broken down by sub-protection |
| `waf_openapi_validation_total` | `route`, `result` | OpenAPI validation outcomes (`pass`, `fail`) |
| `waf_evaluation_timeout_total` | `route` | Inspection that exceeded the per-request timeout |
| `waf_body_spooled_total` | `route` | Requests whose body had to spool to disk (large bodies) |
| `waf_decompression_rejected_total` | `route` | Requests rejected for excessive decompression ratio |
| `waf_security_headers_injected_total` | `route`, `header` | Security response headers injected |
| `waf_config_reload_total` | `result` | Config reload attempts (`success`, `error`) |

## Gauges

| Name | Labels | Description |
|---|---|---|
| `waf_build_info` | `version`, `go_version`, `crs_version` | Always `1`. Use for build-info joins. |
| `waf_config_reload_timestamp_seconds` | — | Unix timestamp of last successful reload |
| `waf_crs_rules_loaded_total` | — | Number of detection rules loaded |

## Histograms

| Name | Labels | Description |
|---|---|---|
| `waf_anomaly_score_histogram` | `route` | Anomaly score per request. Buckets: 1, 2, 3, 5, 10, 15, 25, 50 |
| `waf_request_duration_overhead_seconds` | `route` | Time spent in WAF inspection per request |

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

