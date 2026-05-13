# Binary install

Barbacana releases a native binary for Linux, macOS, and Windows (amd64 and arm64). Use this installation method when you do not have Docker available — for example, on a bare-metal server, a VM, or an environment where you manage Barbacana as a system service.

For a container-based setup, see [Installation](installation.md).

## Prerequisites

- Linux, macOS, or Windows on amd64 or arm64
- A `waf.yaml` configuration file (see [Quickstart](quickstart.md) for the minimal three-line config)

## Step 1 — Download the binary

Go to the [Releases page](https://github.com/barbacana-waf/barbacana/releases/latest) and find the latest version. Download the archive for your platform, extract it, and place the binary on your `PATH`.

Replace `0.6.0` in the commands below with the version you are installing.

=== "Linux (amd64)"

    ```bash
    curl -LO https://github.com/barbacana-waf/barbacana/releases/download/v0.6.0/barbacana_0.6.0_linux_amd64.tar.gz
    tar -xzf barbacana_0.6.0_linux_amd64.tar.gz
    sudo install -m 0755 barbacana /usr/local/bin/barbacana
    ```

=== "Linux (arm64)"

    ```bash
    curl -LO https://github.com/barbacana-waf/barbacana/releases/download/v0.6.0/barbacana_0.6.0_linux_arm64.tar.gz
    tar -xzf barbacana_0.6.0_linux_arm64.tar.gz
    sudo install -m 0755 barbacana /usr/local/bin/barbacana
    ```

=== "macOS (Apple Silicon)"

    ```bash
    curl -LO https://github.com/barbacana-waf/barbacana/releases/download/v0.6.0/barbacana_0.6.0_darwin_arm64.tar.gz
    tar -xzf barbacana_0.6.0_darwin_arm64.tar.gz
    sudo install -m 0755 barbacana /usr/local/bin/barbacana
    ```

=== "macOS (Intel)"

    ```bash
    curl -LO https://github.com/barbacana-waf/barbacana/releases/download/v0.6.0/barbacana_0.6.0_darwin_amd64.tar.gz
    tar -xzf barbacana_0.6.0_darwin_amd64.tar.gz
    sudo install -m 0755 barbacana /usr/local/bin/barbacana
    ```

Confirm the binary is on your `PATH`:

<!-- termynal -->

```console
$ barbacana --version
barbacana v0.6.0 (973a47b)
go        go1.26.3
crs       v4.26.0
```

!!! tip "Verify before you run"
    Each release attaches a signed `checksums.txt.bundle` and a SLSA3 provenance file. See [Verifying releases](../security/verifying.md#6-verify-the-binaries-optional) to authenticate the archive before extracting it.

## Step 2 — Write a config

Create `/etc/barbacana/waf.yaml`. The directory must exist before starting the binary.

```bash
sudo mkdir -p /etc/barbacana
```

```yaml title="/etc/barbacana/waf.yaml"
version: v1alpha1

routes:
  - upstream: http://localhost:8000
```

This forwards all traffic to your app on port `8000`. Adjust the port to match your application. Point `upstream` at a hostname and port your server can reach — `localhost` works when Barbacana and your app run on the same host.

## Step 3 — Validate the config

Check the config before starting the server. `--validate` reads and compiles the full rule set; it catches schema errors, unknown protection names, missing OpenAPI specs, and rule compilation failures.

<!-- termynal -->

```console
$ barbacana --config /etc/barbacana/waf.yaml --validate
config valid
```

Exit code `0` means everything is valid. If the config contains errors, each one is printed and the exit code is `1`:

```text
barbacana: load config: validate config /etc/barbacana/waf.yaml: routes[0]: unknown protection "sql-inejction" in disable list (did you mean "sql-injection"?)
routes[0]: unknown protection "xss-bodX" in disable list
```

Fix each reported error and re-run `--validate` until the output is `config valid`.

## Step 4 — Run

Start Barbacana:

<!-- termynal -->

```console
$ barbacana --config /etc/barbacana/waf.yaml
{"time":"2026-05-13T09:00:00Z","level":"INFO","msg":"health endpoint disabled — set health_port to enable /healthz and /readyz"}
{"time":"2026-05-13T09:00:00Z","level":"INFO","msg":"metrics endpoint disabled — set metrics_port to enable /metrics"}
{"time":"2026-05-13T09:00:00Z","level":"INFO","msg":"barbacana started","mode":"plain-http","host":"","port":8080,"health_port":0,"metrics_port":0,"routes":1}
```

Barbacana listens on `:8080` by default and logs structured JSON to stdout. Press `Ctrl+C` to stop — it shuts down gracefully.

## Step 5 — Verify it works

With Barbacana running, open a second terminal and send two requests:

```bash
curl http://localhost:8080/                     # forwarded to your app
curl "http://localhost:8080/?q=1' OR 1=1--"     # blocked: 403
```

The second request is blocked and recorded in the [audit log](../operations/audit-log.md) with `action: blocked`.

---

## Running as a Linux service

On a Linux server, run Barbacana under systemd so it starts on boot and restarts automatically after a failure.

**Create a dedicated system user:**

```bash
sudo useradd --system --no-create-home --shell /sbin/nologin barbacana
sudo chown -R barbacana:barbacana /etc/barbacana
```

**Create the unit file:**

```ini title="/etc/systemd/system/barbacana.service"
[Unit]
Description=Barbacana WAF
Documentation=https://barbacana.dev
After=network.target

[Service]
Type=simple
User=barbacana
ExecStart=/usr/local/bin/barbacana --config /etc/barbacana/waf.yaml
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=barbacana

[Install]
WantedBy=multi-user.target
```

`ExecReload` sends `SIGHUP` to the process, which triggers a graceful config reload without dropping existing connections.

**Enable and start the service:**

<!-- termynal -->

```console
$ sudo systemctl daemon-reload
$ sudo systemctl enable barbacana
Created symlink /etc/systemd/system/multi-user.target.wants/barbacana.service → /etc/systemd/system/barbacana.service.
$ sudo systemctl start barbacana
$ sudo systemctl status barbacana
● barbacana.service - Barbacana WAF
     Loaded: loaded (/etc/systemd/system/barbacana.service; enabled; preset: enabled)
     Active: active (running) since Tue 2026-05-13 09:00:00 UTC; 3s ago
   Main PID: 1234 (barbacana)
      Tasks: 8 (limit: 4636)
     Memory: 28.4M
        CPU: 41ms
     CGroup: /system.slice/barbacana.service
             └─1234 /usr/local/bin/barbacana --config /etc/barbacana/waf.yaml
```

**View live logs:**

```bash
journalctl -u barbacana -f
```

**Apply a config change** without downtime:

```bash
sudo systemctl reload barbacana
```

This sends `SIGHUP`, which triggers a graceful reload. In-flight requests complete normally; new requests use the updated config.

---

## Next

- [Installation](installation.md) — run Barbacana as a container with Docker or Docker Compose, including auto-TLS
- [Configuration](incremental.md) — build from a minimal config to a full production setup, step by step
- [Routes](../reference/routes.md) — match traffic by host, path, or both
- [Detect-only mode](../reference/detect-only.md) — log without blocking while you tune
