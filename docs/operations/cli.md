# CLI

Barbacana is a single binary with one purpose: run the WAF. Auxiliary modes are flags on the same binary.

```bash
docker run --rm -p 8080:8080 \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest
```

The container's default ENTRYPOINT runs the server — no subcommand, no `command:` override. The image reads `/etc/barbacana/waf.yaml` by default; mount your config there or pass `--config <path>`.

## Synopsis

```text
barbacana [--config <path>] [--validate | --render-config | --version] [-h]
```

| Flag | Description |
|---|---|
| `--config <path>` | Path to the YAML config. Default: `/etc/barbacana/waf.yaml`. Shared by every mode. |
| `--validate` | Validate the config and exit. |
| `--render-config` | Print the compiled low-level config and exit (read-only diagnostic). |
| `--version` | Print version, Go version, and CRS version. |
| `-h`, `--help` | Show usage. |

`--validate`, `--render-config`, and `--version` are mutually exclusive — pass at most one. Without any of them, Barbacana runs as a server.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — server exited cleanly, or the selected mode finished with no errors. |
| `1` | Operational error — config invalid, file not found, rule compilation failed, listener failed, etc. |
| `2` | Usage error — unknown flag, or more than one mode flag set. |

---

## Run the WAF

Default behavior. No mode flag.

```bash
docker run --rm -p 8080:8080 \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest
```

Listens on the ports declared in the config. Traffic defaults to `:8080` (mode 3) or `:443` (modes 1 and 2 — see [Hostnames & HTTPS](hostnames.md)). Metrics (`metrics_port`) and health (`health_port`) are **off by default** — set them explicitly to enable. Logs structured JSON to stdout. Reloads gracefully on `SIGHUP`.

```text
{"time":"2026-04-18T09:00:00Z","level":"INFO","msg":"barbacana started","port":8080,"crs_version":"4.7.0"}
{"time":"2026-04-18T09:00:00Z","level":"INFO","msg":"health endpoint disabled — set health_port to enable /healthz and /readyz"}
{"time":"2026-04-18T09:00:00Z","level":"INFO","msg":"metrics endpoint disabled — set metrics_port to enable /metrics"}
```

To point at a non-default config path:

```bash
docker run --rm -p 8080:8080 \
  -v $(pwd)/waf.yaml:/cfg/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest --config /cfg/waf.yaml
```

---

## Validate a config

Check that a config is well-formed without starting the proxy. Use it in CI before deployment.

```bash
docker run --rm \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest --config /etc/barbacana/waf.yaml --validate
```

Verifies the schema, every protection name, every referenced file (OpenAPI specs), and rule compilation.

```text
config valid
```

On error:

```text
waf.yaml:14: unknown protection "sql-inejction" (did you mean "sql-injection"?)
waf.yaml:22: openapi.spec "/etc/barbacana/api.yaml" not found
2 errors
```

Exit code `0` on success, `1` on any validation error.

---

## Render the compiled config

Dump the low-level engine config that Barbacana generates from your YAML. Read-only diagnostic for support and bug reports.

```bash
docker run --rm \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest --config /etc/barbacana/waf.yaml --render-config
```

Prints raw Caddy JSON. **Not a user-editable format** and not part of the user-facing API — it may change between versions. The supported way to configure Barbacana is the YAML schema; see the [config schema reference](../reference/schema.md).

---

## Print the version

```bash
docker run --rm ghcr.io/barbacana-waf/barbacana:latest --version
```

```text
barbacana v0.4.0
go        go1.22.3
crs       4.7.0
```
