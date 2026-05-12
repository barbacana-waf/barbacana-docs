# Operations

This section covers deployment, observability, and day-to-day operation of Barbacana in production. Topics span TLS provisioning, health endpoints, metrics, distributed tracing, and the structured audit log.

## Key concepts

**TLS is provisioned automatically.** Set a public hostname and Barbacana requests a Let's Encrypt certificate via ACME, renews it before expiry, and handles the HTTP→HTTPS redirect. No certificate management, no reload on renewal. For `.localhost` hostnames a local CA is used instead — no public ACME requests needed in development. See [Hostnames & HTTPS](hostnames.md).

**Observability is opt-in.** Metrics (`metrics_port`), health endpoints (`health_port`), and distributed tracing (`tracing.enabled`) are all off by default. Each is a one-field change to enable. The off-by-default stance keeps the network surface minimal for deployments that don't need them.

**The audit log is always on.** One structured JSON entry per inspected request, written to stdout, no off switch. Schema: OCSF v1.2.0 by default, ECS 8.x available. Pick it up with any standard log shipper — Fluent Bit, Vector, Filebeat — and no normalization layer is required. See [Audit log](audit-log.md).

**Traces carry context end to end.** When tracing is enabled, Barbacana propagates W3C `traceparent` to your upstream. The same trace ID appears in the audit log entry, the WAF span, and your application's spans — one pivot from alert to trace. See [Distributed tracing](tracing.md).

## In this section

| Page | What it covers |
|---|---|
| [Hostnames & HTTPS](hostnames.md) | Auto-TLS via ACME, single-host, multi-host, and behind-load-balancer modes |
| [CLI](cli.md) | The `barbacana` command, config validation, reload |
| [Monitoring](monitoring.md) | `/healthz` and `/readyz` health endpoints for Kubernetes and load balancers |
| [Metrics](metrics.md) | Prometheus scrape endpoint on `metrics_port`, full metric catalogue |
| [Grafana dashboard](dashboard.md) | Pre-built dashboard JSON for request rate, block rate, and WAF latency |
| [Audit log](audit-log.md) | OCSF and ECS document schemas, field reference, disposition semantics |
| [Tracing](tracing.md) | OTLP export, W3C trace propagation, authenticated collector endpoints, sampling |

## Where to start

Starting a new deployment → [Hostnames & HTTPS](hostnames.md).

Adding metrics or health checks → [Metrics](metrics.md) and [Monitoring](monitoring.md).

Setting up distributed tracing → [Tracing](tracing.md).
