# Sizing guide

Resource requirements and scaling rules for Barbacana deployments running the
full OWASP CRS v4 ruleset at paranoia level 1.

## At a glance

| Metric | Value |
|---|---|
| Throughput per vCPU | ~125 RPS |
| p99 latency (operating range) | 35–65 ms, increases with load |
| Memory per instance | 120–140 MB (stable across load) |
| Memory under saturation | up to 360 MB |
| Validated on | c3-standard-4, e2-standard-8 (Google Cloud) |

CPU scales linearly with vCPU count. Memory is dominated by CRS rule loading
and stays flat across the operating range — it only grows when the instance is
saturated. CPU in the table below is in Kubernetes millicores
(1000m = one full core-second per second).

## Kubernetes resource recommendations

Size CPU requests from your target sustained RPS:

```
requests.cpu  = (RPS ÷ 125) × 1000m
limits.cpu    = requests.cpu × 1.3
```

The 30% headroom in limits covers traffic spikes without triggering throttling.
Memory limits act as a safety rail — memory only grows above the baseline under
saturation.

| Target RPS | requests.cpu | limits.cpu | requests.memory | limits.memory |
|---|---|---|---|---|
| 100 | 800m | 1000m | 150Mi | 300Mi |
| 250 | 2000m | 2500m | 150Mi | 300Mi |
| 500 | 4000m | 5000m | 150Mi | 300Mi |
| 1000 | 8000m | 10000m | 200Mi | 400Mi |

Beyond ~1000 RPS per instance, prefer adding replicas over scaling a single
instance vertically. 

## Scaling guidance

- Each vCPU handles ~125 RPS with full CRS protection.
- Scale vertically by adding vCPUs to a single instance — verified up to 8 vCPU.
- Scale horizontally by adding replicas behind a load balancer.
- Both approaches behave linearly; the choice is operational, not technical.

## Sizing for traffic volume

| Sustained RPS | Single instance (vCPU) | 
|---|---|
| up to 125 | 1 vCPU |
| up to 250 | 2 vCPU |
| up to 500 | 4 vCPU |
| up to 1,000 | 8 vCPU |
| up to 5,000 | use replicas |


These are conservative recommendations that leave headroom for traffic spikes.
Measure your actual traffic patterns before reducing below these values.

## Factors that affect the per-vCPU ceiling

- **CRS rule coverage.** More rules or higher paranoia levels increase per-request
  CPU cost. The figures above use paranoia level 1 (the default).
- **Request payload size.** Larger bodies cost more to inspect. Workloads with
  frequent large POST bodies or multi-megabyte file uploads will lower the
  ceiling.
- **Traffic mix.** The benchmark used 79.5% GET pages, 10% static assets,
  5% POST JSON, 4% POST form, 1% file uploads, and 0.5% attack traffic.
  A higher ratio of POST and upload requests than this mix increases inspection
  work and will lower the per-vCPU ceiling.
- **Host CPU type.** Both tested instance types (compute-optimised and
  general-purpose) produced the same per-vCPU throughput. The factor that
  matters is per-vCPU clock speed and cache size, not instance class. Verify
  on your specific hardware if precision matters.


---

A blog entry explains the methodology on how these numbers were derived, and provides more context on the performance characteristics of Barbacana, see the [performance benchmark post](../blog/posts/v060-performance-benchmark.md).
