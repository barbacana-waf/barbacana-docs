# Hostnames & HTTPS

Barbacana picks one of three configurations based on what you put in the config — there is no `mode:` field. The choice depends on how many public hostnames you serve and whether Barbacana terminates TLS itself.

| Mode | Trigger | What you get |
|---|---|---|
| **Single-host TLS** | Top-level `host: api.example.com` (or a list of hostnames) | Auto-TLS for one or more hostnames — all serving the same routes — on `:443`, HTTP→HTTPS redirect on `:80` |
| **Multi-host TLS** | Per-route `match.hosts: [...]` (no top-level `host:`) | Auto-TLS for each hostname on `:443` |
| **Behind a load balancer** | Top-level `port: 8080` | Plain HTTP only; the LB terminates TLS |

```yaml title="Mode 1 — single host"
version: v1alpha1
host: api.example.com
data_dir: /data/barbacana
routes:
  - upstream: http://app:8080
```

`host` also accepts a list, when several hostnames are aliases for the exact same routes:

```yaml title="Mode 1 — multiple aliases, same routes"
version: v1alpha1
host: [example.com, example.io]
data_dir: /data/barbacana
routes:
  - upstream: http://app:8080
```

Every route matches requests to any listed hostname identically — there's no per-hostname routing in this form. Barbacana provisions one Let's Encrypt certificate per hostname, so each hostname's DNS must resolve to this instance before startup or certificate issuance fails for that hostname. An empty list, duplicate entries, or an invalid hostname are config errors at startup.

```yaml title="Mode 2 — multiple hosts"
version: v1alpha1
data_dir: /data/barbacana
routes:
  - match: { hosts: [api.example.com] }
    upstream: http://api:8000
  - match: { hosts: [www.example.com] }
    upstream: http://web:8000
```

```yaml title="Mode 3 — behind a load balancer"
version: v1alpha1
port: 8080
routes:
  - upstream: http://api:8000
```

In modes 1 and 2 Barbacana provisions certificates from Let's Encrypt automatically via ACME and renews them before expiry. In mode 3 the LB handles TLS and Barbacana speaks plain HTTP; configure the LB to send the original client IP via `X-Forwarded-For` so the [audit log](audit-log.md) records real source IPs.

## Choosing between a host list and per-route match.hosts

Both give you more than one public hostname with auto-TLS. The difference is whether the hostnames route to the same place:

- **Top-level `host` list (Mode 1)** — every hostname is an alias for the same set of routes. `example.com` and `example.io` hit the identical routing table. Use this when the hostnames are interchangeable, e.g. a primary domain and a regional alias.
- **Per-route `match.hosts` (Mode 2)** — different hostnames go to different routes: `api.example.com` to the API backend, `admin.example.com` to the admin backend. Use this when hostnames need distinct routing.

## Prerequisites for auto-TLS

- Each hostname resolves publicly to the Barbacana host.
- Ports `:80` and `:443` are reachable from the internet (Let's Encrypt validates over HTTP-01 by default).
- `data_dir:` points at a writable, **persistent** location. Without persistence, Barbacana re-requests certificates on every restart and you'll hit Let's Encrypt's [rate limits](https://letsencrypt.org/docs/rate-limits/). The default is `/data/barbacana` — mount a volume there in containerized deployments.

## Local development

For `.localhost` hostnames Barbacana uses a local development certificate authority — no public ACME request. Use `host: api.localhost` (or `match: { hosts: [api.localhost] }`) and trust the local CA in your browser the first time.
