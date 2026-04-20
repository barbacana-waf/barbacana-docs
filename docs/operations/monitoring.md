# Monitoring

Barbacana exposes two HTTP endpoints for liveness and readiness checks.

!!! warning "Off by default"
    `health_port` defaults to `0`, which disables the health server entirely. Set it to a real port to opt in. This keeps the network surface minimal for deployments that don't need health probes.

## Enabling

```yaml title="waf.yaml"
version: v1alpha1
port: 8080
health_port: 8081    # /healthz, /readyz

routes:
  - upstream: http://app:8000
```

The health port serves a separate HTTP server, isolated from request traffic.

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /healthz` | `200 ok` if the process is running |
| `GET /readyz` | `200 ok` if Barbacana has loaded its config and is ready to accept traffic |

Use `/readyz` for Kubernetes readiness probes and load balancer health checks. Use `/healthz` for liveness.
