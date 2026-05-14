---
date: 2026-05-14
authors: [barbacana]
categories:
  - performance
---

# First performance benchmark

Barbacana is an HTTP reverse proxy that runs the OWASP CRS v4 ruleset on every request. This blog entry explains how it was benchmarked on two Google Cloud instance types — c3-standard-4 (4 vCPU) and e2-standard-8 (8 vCPU) — across six load tiers from 100 to 1500 requests per second (RPS), using a mixed workload of GET, POST, file uploads, and simulated attack traffic. 

Per-vCPU throughput was consistent across both machines at approximately 125 RPS per vCPU. p99 latency stayed between 35 and 65 ms across the operating range, and memory remained between 119 and 137 MB until saturation. All simulated attack requests were blocked at every load level. 

CPU profiling confirmed the epxected outcome: the dominant cost is CRS rule evaluation; the proxy layer itself adds no measurable overhead. This post describes the methodology, results, and operational implications.

<!-- more -->

## Setup

The benchmark ran on two GCP instance types. Three binaries ran on the same
machine in each run: **Barbacana** (the WAF), [**k6**](https://k6.io/) (the load generator), and
**Caddy** (a mock backend returning `200 OK` for every route).

| Machine | vCPU | RAM | Instance class |
|---|---|---|---|
| `c3-standard-4` | 4 | 16 GB | compute-optimised |
| `e2-standard-8` | 8 | 32 GB | general-purpose |

Barbacana ran with its default configuration — the same setup any user gets out
of the box, with most protections automatically enabled.

Measuring on a single machine is appropriate because the primary metric —
`waf_request_duration_overhead_seconds` — is a histogram recorded inside
Barbacana, covering only the WAF's own processing time. Network topology
between the load generator and the WAF does not affect it. The mock backend
adds no meaningful latency (same host, loopback), so end-to-end latency in
this test approximates WAF overhead directly.

## Mixed workload

Each k6 iteration picks one request type at random:

| Type | Weight | Details |
|---|---|---|
| GET page | 79.5% | Random path from a slug list; optional query string |
| GET static asset | 10% | Random path under `/assets/` — css, js, images |
| POST JSON | 5% | `Content-Type: application/json`, random 1–5 KB body |
| POST form | 4% | `Content-Type: application/x-www-form-urlencoded`, login fields |
| File upload | 1% | `Content-Type: multipart/form-data`, random 100 KB–1 MB payload |
| Attack traffic | 0.5% | SQL injection, XSS, path traversal, command injection |

The mix reflects the request shapes a Barbacana instance would see in a typical
production deployment: mostly page and asset fetches, some API and form traffic,
occasional large uploads, and a small fraction of attack attempts. Inspection
work varies by content type — the workload exercises Barbacana across the full
range of request shapes it would encounter in practice.

## Methodology

Each tier ran at a constant target rate for the full measurement window — not a
ramp, not a burst, but a steady sustained load held at exactly the specified RPS
for 10 minutes. 60 seconds of warmup traffic preceded each measurement window
and was discarded. Prometheus metrics were scraped from Barbacana's `/metrics`
endpoint every 5 seconds. CPU and memory were read directly from Linux metrics 
at `/proc` folder during the same window.

## Results

### c3-standard-4 (4 vCPU, compute-optimised)

| RPS | p99 | RAM (Barbacana) | CPU (Barbacana) |
|---|---|---|---|
| 100 | 36.6 ms | 120 MB | 335 m |
| 500 | 59.1 ms | 125 MB | 2060 m |
| 1000 | > 500 ms (collapsed) | 350 MB | 3500 m |

### e2-standard-8 (8 vCPU, general-purpose)

| RPS | p99 | RAM (Barbacana) | CPU (Barbacana) |
|---|---|---|---|
| 100 | 40.0 ms | 123 MB | 534 m |
| 250 | 38.9 ms | 119 MB | 880 m |
| 500 | 41.8 ms | 125 MB | 1872 m |
| 750 | 48.4 ms | 133 MB | 3427 m |
| 1000 | 64.9 ms | 137 MB | 4508 m |
| 1500 | 1976 ms (collapsed) | 360 MB | 6931 m |

The p99 (99th percentile) is the latency threshold that 99% of requests fell
below. It measures tail behaviour rather than the average — if p99 is
acceptable, almost every user sees acceptable latency, including during brief
traffic spikes that push the tail higher. Latency is computed from the
`waf_request_duration_overhead_seconds` histogram. CPU is in Kubernetes
millicores (1000m = one full core-second per second).

### Per-vCPU scaling

Both runs converge on the same throughput per core:

- c3-standard-4: 500 RPS sustained on 4 vCPU → **125 RPS per vCPU**
- e2-standard-8: 1000 RPS sustained on 8 vCPU → **125 RPS per vCPU**

Different CPU families, different clock speeds, different instance classes —
the same per-vCPU result. This is the number that transfers across hardware:
divide your target RPS by 125 to get the vCPU count you need.

The e2 data shows p99 degrading smoothly from 40.0 ms at 100 RPS to 64.9 ms
at 1000 RPS, then collapsing at 1500 RPS. There is no sudden cliff in the
operating range — headroom above your target RPS translates directly into
lower p99.

## Saturation

Every system has a load point where it can no longer keep up with incoming
requests. Requests start queuing faster than they complete, latency climbs, and
throughput falls below the target rate. Knowing where this threshold sits lets
you size instances with enough margin to stay clear of it in production.

On the e2-standard-8, 1500 RPS caused saturation: the load generator could not
initialise virtual users fast enough to sustain the target rate, average latency
climbed above 1.9 seconds, and Barbacana consumed nearly all 8 vCPU (6931m out
of 8000m). The c3-standard-4 hit the same per-vCPU wall at 1000 RPS — 3500m
of 4000m consumed, ~33% of iterations dropped.

This is per-instance saturation under sustained load, not a machine ceiling.
For traffic that sustains above the ~125 RPS per vCPU threshold, add instances
behind a load balancer. The data plane is stateless — no coordination between
instances is required. The per-instance ceiling stays the same; total
throughput scales linearly.

## Memory

Memory across the full operating range (100–1000 RPS) stayed between 119 MB
and 137 MB on both machines. This is validated across two hardware types: the
baseline footprint is dominated by CRS rule loading, and per-request allocations
are small. Memory only grows under saturation — 350 MB on the c3 and 360 MB on
the e2 — where requests queue faster than they complete.

## Attack blocking

All ~3,900 simulated attack requests returned `403` across all tiers on both
machines, including tiers where Barbacana was running at the edge of its
capacity. A WAF that slows under load but never stops protecting is exactly
the right behaviour for DDoS scenarios: sustained high traffic may push latency
higher, but attack requests are still identified and blocked throughout. This
protection guarantee held without exception across every tier in the benchmark.

k6 reports an `http_req_failed` rate of approximately 1.2%. This is a k6
measurement artifact: k6 counts any non-2xx response as a failure by default,
which includes the `403` responses for blocked attacks. Separate check metrics
in k6 confirmed that every request — including blocked attacks — behaved as
expected.

## Profiling

CPU profiling records which functions consume processor time during a live run.
It shows where the process actually spends its cycles, rather than where
developers assumed it would. Go's built-in
[pprof tool](https://pkg.go.dev/net/http/pprof) was used to capture a 60-second
profile at steady state on the e2-standard-8 at 250 RPS. Three findings:

**CRS rule evaluation accounts for 75% of cumulative CPU.**
`corazawaf.(*Rule).doEvaluate` sits at 4.10% flat but 75.14% cumulative — it
is the call that drives all downstream work. That work is regex matching,
distributed across `regexp.(*machine).add` (12.90% flat), `.step` (5.03%),
`.tryBacktrack` (4.90%), and `regexp/syntax.(*Inst).MatchRunePos` (2.57%).
No single rule or rule group dominates; the load is spread proportionally
across the CRS ruleset.

**No Barbacana-specific application function exceeds 5% of flat CPU.**
The entire Caddy/Barbacana proxy stack — connection handling, routing,
middleware, instrumented response writing — appears at 0.00–0.06% flat while
accounting for 84–88% cumulative, meaning it orchestrates work but does none
of its own. The proxy layer adds no measurable overhead beyond CRS rule
evaluation.

For the full CPU profile breakdown, see the
[detailed profile analysis](assets/v060-profile_analysis.txt).
To inspect the profile yourself, download the [raw pprof file](assets/v060-cpu_250.pprof)
and run `go tool pprof v060-cpu_250.pprof`.

## Limitations

**Two machine types tested, both Google Cloud.** Results may differ on other
cloud providers, bare-metal servers, or ARM instances. The per-vCPU finding
is consistent across both tested types but has not been validated more broadly.

**Workload mix.** The mix reflects typical web traffic patterns. Workloads with
unusually high upload ratios, large POST bodies, or heavy API traffic will shift
the per-vCPU ceiling.

**p99 variation.** Measured on quiet, dedicated instances. On shared or noisy
infrastructure, expect run-to-run variation, particularly at p99.

**k6 `http_req_failed` rate.** The ~1.2% figure counts `403` responses as
failures. All requests completed with the expected status codes, confirmed by
the separate k6 check metrics.

## Conclusion

Barbacana delivers ~125 RPS per vCPU with full CRS protection, p99 latency
between 35 and 65 ms across the operating range, a stable ~130 MB memory
footprint, and uninterrupted attack blocking under sustained load. Scale by
adding vCPUs to a single instance or by adding replicas behind a load balancer
— both behave linearly. For resource planning and Kubernetes manifests, see the
[operations sizing guide](../../operations/sizing.md).

---

*AI assistance was used to structure and draft this post; the data and final
text were reviewed by a human.*

The benchmark relied on [k6](https://k6.io/) to generate load and validate
blocking rates. k6 is an open-source load testing tool that made it
straightforward to build a realistic mixed workload and collect per-request
outcome data. Thanks to the k6 team and contributors.
