# Installation

Barbacana ships as a single container image. The sections below walk from the simplest possible run through to a TLS-terminating Compose stack — each step builds on the previous one.

If you do not have Docker available, see [Binary install](binary.md) to run Barbacana directly from the release binary.

The image: `ghcr.io/barbacana-waf/barbacana:latest`. Multi-arch (`amd64`, `arm64`), signed with cosign, ships a CycloneDX SBOM.

`ghcr.io/barbacana-waf/barbacana` is the canonical registry. A convenience mirror at `docker.io/barbacana/barbacana` carries identical image bits.

## Step 1 — `docker run` against a local upstream

Smallest viable setup: one config file, one `docker run`. Use this to try Barbacana in front of an app already running on your host.

> **Assumes:** your app is listening on port `8000` on your machine. Adjust the port if it isn't.

Create `waf.yaml` in your working directory:

```yaml title="waf.yaml"
version: v1alpha1

routes:
  - upstream: http://localhost:8000
```

Then:

```bash
docker pull ghcr.io/barbacana-waf/barbacana:latest

docker run --rm --network host \
  -v $(pwd)/waf.yaml:/etc/barbacana/waf.yaml:ro \
  ghcr.io/barbacana-waf/barbacana:latest
```

`--network host` lets the container reach `localhost:8000` on your machine and publishes Barbacana directly on the host's `:8080` (no `-p` flag needed). Supported on Linux Docker Engine and Docker Desktop 4.34+.

The image reads `/etc/barbacana/waf.yaml` by default, so no `--config` flag is needed. Send requests to `http://localhost:8080`; they're inspected and forwarded to your upstream.

## Step 2 — Docker Compose, plain HTTP

Once the basics work, run the upstream alongside Barbacana on a private Docker network. No TLS yet — useful when something else (a load balancer, an ingress controller) terminates HTTPS in front of you.

Reuse the same `waf.yaml`, but point the upstream at the Compose service name:

```yaml title="waf.yaml"
version: v1alpha1

routes:
  - upstream: http://app:8080
```

Then:

```yaml title="compose.yaml"
services:
  barbacana:
    image: ghcr.io/barbacana-waf/barbacana:latest
    ports:
      - "8080:8080"
    volumes:
      - ./waf.yaml:/etc/barbacana/waf.yaml:ro
    depends_on:
      - app
    restart: unless-stopped

  app:
    image: nginxdemos/hello:latest
    expose:
      - "8080"
    environment:
      NGINX_PORT: "8080"
    restart: unless-stopped
```

`docker compose up` and hit `http://localhost:8080`. `app` is reachable to Barbacana over Docker's internal DNS but is not published to the host.

## Step 3 — Docker Compose with auto-TLS

For a public deployment, let Barbacana terminate TLS via Let's Encrypt. Two changes to the previous step: add `host:` and `data_dir:` to the config, and publish `:80`/`:443` instead of `:8080`.

```yaml title="waf.yaml"
version: v1alpha1
host: api.example.com
data_dir: /data/barbacana

routes:
  - upstream: http://app:8080
```

```yaml title="compose.yaml"
services:
  barbacana:
    image: ghcr.io/barbacana-waf/barbacana:latest
    ports:
      - "80:80"      # ACME HTTP-01 challenge + HTTP→HTTPS redirect
      - "443:443"    # HTTPS
    volumes:
      - ./waf.yaml:/etc/barbacana/waf.yaml:ro
      - barbacana-data:/data/barbacana
    depends_on:
      - app
    restart: unless-stopped

  app:
    image: nginxdemos/hello:latest
    expose:
      - "8080"
    environment:
      NGINX_PORT: "8080"
    restart: unless-stopped

volumes:
  barbacana-data:
```

`host:` triggers auto-TLS for one hostname. `data_dir:` is where Barbacana persists ACME state — the `barbacana-data` named volume keeps it across restarts.

**Prerequisites for auto-TLS:**

- DNS for `api.example.com` resolves publicly to the machine running Barbacana — Let's Encrypt connects to that hostname to validate the certificate, so the A/AAAA record must point at this host's public IP.
- Ports `80` and `443` are open on that machine and reachable from the internet (firewall, security group, and any upstream router/NAT must forward them). `80` is required for the ACME HTTP-01 challenge; `443` serves HTTPS traffic afterward.
- The `barbacana-data` volume is preserved across restarts. Without it, Barbacana re-requests certificates on every restart and you'll hit Let's Encrypt's [rate limits](https://letsencrypt.org/docs/rate-limits/).

For multi-host setups and the full picture of the three deployment modes, see [Hostnames & HTTPS](../operations/hostnames.md).
