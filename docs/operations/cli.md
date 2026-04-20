# CLI

Barbacana has five commands, all shipped inside the container image. Invoke them with `docker run … ghcr.io/barbacana-waf/barbacana:latest <command>`.

| Command | Purpose |
|---|---|
| [`serve`](#serve) | Run the WAF |
| [`validate`](#validate) | Check a config without starting |
| [`defaults`](#defaults) | Print all available protections |
| [`debug render-config`](#debug-render-config) | Show the generated low-level config |
| [`version`](#version) | Print version info |

The container reads its config from `/etc/barbacana/waf.yaml` by default — mount your file there and you can omit `--config` on most commands.

---

## serve

Run Barbacana as a WAF proxy.

```bash
docker run --rm -p 8080:8080 \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest serve
```

| Flag | Required | Description |
|---|---|---|
| `--config` | no | Path to the YAML config file inside the container (default `/etc/barbacana/waf.yaml`) |

Listens on the ports declared in the config. Traffic defaults to `:8080` (mode 3) or `:443` (modes 1 and 2 — see [Hostnames & HTTPS](hostnames.md)). Metrics (`metrics_port`) and health (`health_port`) are **off by default** — set them explicitly to enable. Logs structured JSON to stdout. Reloads gracefully on `SIGHUP`.

```text
{"time":"2026-04-18T09:00:00Z","level":"INFO","msg":"barbacana started","port":8080,"crs_version":"4.7.0"}
{"time":"2026-04-18T09:00:00Z","level":"INFO","msg":"health endpoint disabled — set health_port to enable /healthz and /readyz"}
{"time":"2026-04-18T09:00:00Z","level":"INFO","msg":"metrics endpoint disabled — set metrics_port to enable /metrics"}
```

---

## validate

Check that a config is well-formed without starting the proxy.

```bash
docker run --rm \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest validate /etc/barbacana/waf.yaml
```

Verifies the schema, every protection name, every referenced file (OpenAPI specs), and rule compilation. Use it in CI before deployment.

```text
config valid
```

On error:

```text
waf.yaml:14: unknown protection "sql-inejction" (did you mean "sql-injection"?)
waf.yaml:22: openapi.spec "/etc/barbacana/api.yaml" not found
2 errors
```

Exit code is `0` on success, non-zero on any error.

---

## defaults

Print every protection Barbacana ships with, its status, and its CWE mapping.

```bash
docker run --rm ghcr.io/barbacana-waf/barbacana:latest defaults
```

```text
PROTECTION                    STATUS    CWE
sql-injection                 enabled   CWE-89
  sql-injection-union         enabled   CWE-89
  sql-injection-boolean       enabled   CWE-89
  ...
xss                           enabled   CWE-79
  ...
```

Useful when picking names for [`disable`](../reference/disable.md).

---

## debug render-config

Dump the low-level engine config that Barbacana generates from your YAML. Read-only diagnostic.

```bash
docker run --rm \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest debug render-config /etc/barbacana/waf.yaml
```

Prints a JSON document. Used for support and bug reports — not part of the user-facing API and may change between versions.

---

## version

Print Barbacana, Go, and CRS versions.

```bash
docker run --rm ghcr.io/barbacana-waf/barbacana:latest version
```

```text
barbacana v0.4.0
go        go1.22.3
crs       4.7.0
```
