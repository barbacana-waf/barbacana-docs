# Installation

Barbacana ships as a single container image. Pick the runtime that matches your environment.

The image: `ghcr.io/barbacana-waf/barbacana:latest`. Multi-arch (`amd64`, `arm64`), signed with cosign, ships a CycloneDX SBOM.

## Container (standalone)

```bash
docker pull ghcr.io/barbacana-waf/barbacana:latest

docker run --rm -p 8080:8080 \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest
```

The image reads `/etc/barbacana/waf.yaml` by default, so you don't need to pass `--config` when you mount the file there.

For trying Barbacana in front of a local upstream.

## Docker Compose

Barbacana ships a `compose.yaml` at the root of the source repo. It runs Barbacana with auto-TLS in front of a demo app, both on the same Docker network. Only Barbacana is published.

```yaml title="compose.yaml"
services:
  barbacana:
    image: ghcr.io/barbacana-waf/barbacana:latest
    ports:
      - "80:80"      # ACME HTTP-01 challenge + HTTP→HTTPS redirect
      - "443:443"    # HTTPS
    volumes:
      - ./configs/example-tls.yaml:/etc/barbacana/waf.yaml:ro
      - barbacana-data:/data/barbacana
    depends_on:
      - app
    restart: unless-stopped

  app:
    # Replace with your own application image.
    image: nginxdemos/hello:latest
    expose:
      - "8080"
    environment:
      NGINX_PORT: "8080"
    restart: unless-stopped

volumes:
  barbacana-data:
```

The mounted config (`configs/example-tls.yaml`) is the canonical single-host auto-TLS example:

```yaml title="example-tls.yaml"
version: v1alpha1
host: api.example.com
data_dir: /data/barbacana

routes:
  - upstream: http://app:8080
```

`host:` triggers auto-TLS for one hostname. `data_dir:` is where Barbacana persists ACME state — the `barbacana-data` named volume keeps it across restarts. The `app` service is reachable from Barbacana over Docker's internal DNS (`http://app:8080`).

**Prerequisites for auto-TLS:**

- `api.example.com` resolves publicly to the Compose host.
- Ports `80` and `443` are reachable from the internet (Let's Encrypt validates over HTTP-01).
- The `barbacana-data` volume is preserved across restarts. Without it, Barbacana re-requests certificates on every restart and you'll hit Let's Encrypt's [rate limits](https://letsencrypt.org/docs/rate-limits/).

!!! tip "Behind a load balancer instead?"
    Use `configs/example.yaml` (top-level `port: 8080`, no TLS) and publish `8080:8080` instead of `80:80` / `443:443`. See [Hostnames & HTTPS](../operations/hostnames.md) for all three modes.
