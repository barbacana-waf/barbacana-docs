# Troubleshooting Barbacana WAF

Some applications may stop working after Barbacana WAF is enabled. Common causes include misconfigured routing, false positives from protection rules, and security headers that conflict with the application's frontend code.

Work through the steps below in order. Each step narrows the problem before you make any configuration changes.

---

## Step 1 — Confirm the application works without the WAF

Remove Barbacana from the request path and access the application directly.

- If the application **works** without the WAF, continue to Step 2.
- If the application **does not work** without the WAF, the problem is in the application itself — fix it there first.

---

## Step 2 — Check the logs for configuration errors

Before debugging traffic, make sure Barbacana started successfully. Barbacana writes all output — startup messages, configuration errors, and audit entries — to **stdout** as structured JSON. Where you read it depends on how you run Barbacana:

| Deployment | How to read logs |
|---|---|
| `docker run` (foreground) | Logs print directly in your terminal. |
| Docker Compose | `docker compose logs barbacana` (or whatever the service name is). |
| Kubernetes | `kubectl logs <pod>` or your cluster's log shipper. |

On startup, look for error-level entries. A malformed `waf.yaml` — missing required fields, wrong types, invalid YAML syntax — will produce clear error messages in the log and Barbacana will refuse to start or start in a degraded state.

---

## Step 3 — Verify traffic reaches the WAF

If Barbacana starts but you see **no log entries at all when you send requests**, traffic is not reaching the WAF. Bypass DNS and any intermediaries by hitting the machine's IP directly:

```bash
curl -v http://<barbacana-ip>
```

Replace `<barbacana-ip>` with the IP address and port of the machine running Barbacana. If this request shows up in the logs, the WAF is reachable and the problem is upstream of it. If not, common causes include:

- The client is connecting to the wrong host or port.
- A load balancer or firewall sits between the client and Barbacana and is dropping or redirecting traffic.
- DNS does not resolve to the machine running Barbacana.

Fix connectivity before investigating WAF rules.

---

## Step 4 — Verify TLS and DNS configuration

If you configured a [hostname with auto-TLS](../operations/hostnames.md), certificate provisioning requires the hostname's DNS to resolve to the machine running Barbacana. If DNS points elsewhere (or the record doesn't exist yet), the ACME challenge will fail and Barbacana will log errors indicating the certificate could not be obtained.

Common symptoms:

- The browser shows a TLS/certificate error or refuses to connect on HTTPS.
- Barbacana logs contain messages about failed ACME challenges, DNS resolution failures, or certificate errors.

To fix:

1. Confirm the DNS A/AAAA (or CNAME) record for your hostname points to the public IP of the machine running Barbacana.
2. Ensure port 443 (and port 80 for HTTP-01 challenges) is open and reachable from the internet.
3. Restart or reload Barbacana so it retries certificate provisioning.

If you are not using auto-TLS (e.g. TLS terminates at a load balancer in front of Barbacana), skip this step.

---

## Step 5 — Identify what is being blocked

Now that you know traffic reaches Barbacana and the upstream, enable [mode: detect_only](../reference/detect-only.md) so Barbacana inspects but never blocks:

```yaml
global:
  mode: detect_only
```

Move this configuration to the `global` section — this is the baseline every route inherits. Make sure inner routes don't override it.

Navigate through the application. In this mode Barbacana acts as a transparent reverse proxy — every request is forwarded regardless of its content. If the application still does not work, the routing may be wrong. Check the `upstream` value: is the IP address (or hostname) and port correct? Can Barbacana reach that address from its network?

Exercise the application thoroughly: navigate every page, submit forms, upload files, and call all API endpoints. The more interactions, the more data the [audit log](../operations/audit-log.md) will capture.

### Read the audit log

Barbacana writes one JSON entry per inspected request to stdout. Look for entries with `"action": "detected"` — these are the requests that *would* be blocked in normal mode:

```json
{
  "action": "detected",
  "matched_protections": ["sql-injection", "sql-injection-union"],
  "anomaly_score": 8,
  "path": "/search",
  "method": "POST"
}
```

### Add targeted exceptions

Follow the **least-privilege principle**: disable the most specific sub-protection, not the whole category.

| Log shows | Add to `disable` | Why |
|---|---|---|
| `["sql-injection", "sql-injection-union"]` | `sql-injection-union` | Only disables UNION-based detection; all other SQL-injection rules stay active. |
| `["sql-injection"]` | *(do not disable the entire category unless absolutely necessary)* | Disabling `sql-injection` removes **all** SQL-injection detection on that route. |

See [Disable protections](../reference/disable.md) and the [protection catalog](../security/protections.md) for the full list of names.

### Scope exceptions to specific routes

If different paths trigger different false positives (e.g. the UI and the API), split them into separate routes and add exceptions only where needed:

```yaml
routes:
  - id: api
    match:
      paths: ["/api/*"]
    upstream: http://app:8000
    disable:
      - sql-injection-union

  - id: frontend
    upstream: http://app:8000
```

### Switch back to blocking mode

Once the false positives are resolved, remove `mode: detect_only` (blocking is the default), reload and verify the application works end-to-end.

---

## Step 6 — Fix 403s from request validation

If a request returns 403 but the audit log entry has **no `matched_protections`**, the block is likely coming from request validation rather than a protection rule. Check the following configuration areas:

### Common causes

| Symptom | Config to check | What to look for |
|---|---|---|
| File uploads rejected | [`accept.max_body_size`](../reference/accept.md) | The request body exceeds the configured limit (default varies — check your config). Increase it for routes that handle uploads. |
| POST/PUT with unexpected content type rejected | [`accept.content_types`](../reference/accept.md) | The `Content-Type` header is not in the allowed list. Add the required type. |
| HTTP method rejected | [`accept.methods`](../reference/accept.md) | Methods like `PATCH` or `DELETE` may not be allowed by default. Add them explicitly. |
| API request rejected despite valid payload | [`openapi`](../reference/openapi.md) | If an OpenAPI spec is configured, requests that don't match the schema are rejected. Check the log for validation details and update the spec or the request. |

### Example: allow large uploads on one route

```yaml
routes:
  - id: uploads
    match:
      paths: ["/upload/*"]
    upstream: http://app:8000
    accept:
      max_body_size: 50MB

  - id: default
    upstream: http://app:8000
```

Always scope permissive limits to the specific route that needs them.

---

## Step 7 — Check for security-header conflicts

Barbacana [injects a few security response headers](../reference/headers.md) by default (`Content-Security-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and others). These can break frontend JavaScript even though no entries appear in the WAF audit log.

### Symptoms

- Pages load and images display, but JavaScript features are partially or completely broken.
- The browser console shows errors such as `Refused to execute inline script`, `Blocked a frame with origin`, or `Cross-Origin-Opener-Policy` violations.

### Diagnose

1. Open the browser Developer Tools — **Console**.
2. Look for errors referencing CSP, CORS, COOP, COEP, or `X-Frame-Options`.
3. Map each error to the canonical `header-*` protection name:

| Browser error mentions | Barbacana header key |
|---|---|
| Content-Security-Policy | `header-csp` |
| X-Frame-Options | `header-x-frame-options` |
| Cross-Origin-Opener-Policy | `header-coop` |
| Cross-Origin-Embedder-Policy | `header-coep` |
| Cross-Origin-Resource-Policy | `header-corp` |
| Permissions-Policy | `header-permissions-policy` |

### Fix

**Option A — Override specific headers** using a custom preset:

```yaml
routes:
  - upstream: http://app:8000
    response_headers:
      preset: moderate
      inject:
        header-csp: "default-src 'self'; script-src 'self' 'unsafe-inline'"
```

**Option B — Disable the offending header** on that route:

```yaml
routes:
  - upstream: http://app:8000
    disable:
      - header-coop
```

After each change, reload the page and confirm the console errors are gone.

---

## Further reading

- [Hostnames & HTTPS](../operations/hostnames.md)
- [CLI](../operations/cli.md)
- [Detect-only mode](../reference/detect-only.md)
- [Disable protections](../reference/disable.md)
- [Security headers](../reference/headers.md)
- [Routes](../reference/routes.md)
- [Logs & SIEM](../security/logs.md)
- [Audit log](../operations/audit-log.md)
- [Protection catalog](../security/protections.md)
