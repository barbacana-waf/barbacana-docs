# Quickstart

Protect an app in three lines of YAML.

## 1. Write a config

```yaml title="waf.yaml"
version: v1alpha1

routes:
  - upstream: http://your-app:8000
```

Barbacana listens on `:8080` and forwards safe requests to `your-app:8000`. Blocking mode is the default — SQL injection, XSS, RCE, path traversal, protocol attacks, and hundreds more are blocked automatically, and security response headers are injected.

## 2. Run it

Barbacana ships as a single container image. Pick a runtime:

=== "Docker"

    ```bash
    docker run --rm -p 8080:8080 \
      -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
      ghcr.io/barbacana-waf/barbacana:latest serve
    ```

    The image reads `/etc/barbacana/waf.yaml` by default, so mounting the file at that path is enough — no `--config` flag needed.

    !!! tip "Using Podman?"
        The same command works under Podman — just replace `docker` with `podman`.

=== "Docker Compose"

    ```yaml title="compose.yaml"
    services:
      barbacana:
        image: ghcr.io/barbacana-waf/barbacana:latest
        ports:
          - "8080:8080"
        volumes:
          - ./waf.yaml:/etc/barbacana/waf.yaml:ro
        restart: unless-stopped
    ```

    ```bash
    docker compose up
    ```

    Put your app as another service in the same file and target it by service name (e.g. `upstream: http://app:8000`).

## 3. Verify

```bash
curl http://localhost:8080/                     # forwarded to your app
curl "http://localhost:8080/?q=1' OR 1=1--"     # blocked: 403
```

The second request appears in the [audit log](../operations/audit-log.md) with `action: blocked`.

## Next

- [Installation](installation.md) — put Barbacana on public `:443` with auto-TLS
- [Routes](../reference/routes.md) — match by host, path, or both
- [Detect-only mode](../reference/detect-only.md) — log without blocking while you tune
- [Disable protections](../reference/disable.md) — handle false positives by name
