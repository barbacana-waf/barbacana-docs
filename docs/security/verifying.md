# Verifying a release

Every Barbacana release ships three artifacts in `ghcr.io`, all bound to the same image digest:

- A multi-arch image at `ghcr.io/barbacana-waf/barbacana:vX.Y.Z` (and `:latest`).
- A cosign keyless signature over the image digest.
- A CycloneDX SBOM attested to the same digest, stored as an OCI 1.1 referrer alongside the image.

Edge builds at `ghcr.io/barbacana-waf/barbacana-edge` are **not** signed and **not** attested. Do not run them in production; do not apply the procedures below to them — they will fail.

## Prerequisites

| Tool | Used for | Install |
|---|---|---|
| cosign ≥ 3.0 | Signature + attestation verification, SBOM download | [Installation](https://docs.sigstore.dev/cosign/system_config/installation/) |
| jq | SBOM extraction | [Download](https://jqlang.org/download/) |
| trivy ≥ 0.50 | CVE scanning | [Installation](https://trivy.dev/latest/getting-started/installation/) |
| grype (optional) | Alternative CVE scanner | [Installation](https://github.com/anchore/grype#installation) |

## 1. Verify the image signature

The signature proves the image at the given reference was produced by the Barbacana release workflow on a tagged commit. It does not say anything about what is *inside* the image — that is what the SBOM attestation in step 2 is for.

```
cosign verify \
  --certificate-identity-regexp='https://github.com/barbacana-waf/barbacana/\.github/workflows/.+@refs/tags/v.*' \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/barbacana-waf/barbacana:vX.Y.Z
```

Example run against `latest`:

<!-- termynal -->

```console
$ cosign verify \
  --certificate-identity-regexp='https://github.com/barbacana-waf/barbacana/\.github/workflows/.+@refs/tags/v.*' \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/barbacana-waf/barbacana:latest

Verification for ghcr.io/barbacana-waf/barbacana:latest --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - Existence of the claims in the transparency log was verified offline
  - The code-signing certificate was verified using trusted certificate authority certificates

[{"critical":{"identity":{"docker-reference":"ghcr.io/barbacana-waf/barbacana:latest"},
  "image":{"docker-manifest-digest":"sha256:a4bad9626dffeeae0709fc50cffad6aff37ff4fd9b34c31998a49631b1da7c51"},
  "type":"https://sigstore.dev/cosign/sign/v1"},"optional":{...}}]
```

The certificate identity regex pins the signature to a workflow file in the `barbacana-waf/barbacana` repository, fired on a `v*` tag push. The OIDC issuer pins it to GitHub Actions' token endpoint. Together they prevent a signature produced by any other repo, workflow, or trigger from passing.

A successful run prints a JSON array of verified signatures and exits 0.

A failure means one of the following:

- The image at that reference is unsigned, or signed by an identity that does not match the regex (i.e. not produced by this repo's release workflow).
- The transparency log entry for the signature has been tampered with or removed.
- The image reference points to a different digest than the one that was signed (e.g. a tag was force-pushed).

In all three cases, treat the image as untrusted.

## 2. Verify the SBOM attestation

The attestation is a cosign-signed in-toto statement carrying a CycloneDX SBOM as its predicate. Verifying it proves the SBOM came from the same release workflow that signed the image and is bound to that image's digest.

```
cosign verify-attestation \
  --type cyclonedx \
  --certificate-identity-regexp='https://github.com/barbacana-waf/barbacana/\.github/workflows/.+@refs/tags/v.*' \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/barbacana-waf/barbacana:vX.Y.Z
```

Example run against `latest`:

<!-- termynal -->

```console
$ cosign verify-attestation \
  --type cyclonedx \
  --certificate-identity-regexp='https://github.com/barbacana-waf/barbacana/\.github/workflows/.+@refs/tags/v.*' \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/barbacana-waf/barbacana:latest

Verification for ghcr.io/barbacana-waf/barbacana:latest --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - Existence of the claims in the transparency log was verified offline
  - The code-signing certificate was verified using trusted certificate authority certificates

{"payload":"eyJfdHlwZSI6Imh0dHBz[...]","payloadType":"application/vnd.in-toto+json","signatures":[{"sig":"..."}]}
```

A success prints the verified in-toto envelope to stdout and exits 0. Pipe it through `jq` to inspect the predicate type and the bound subject:

```
cosign verify-attestation --type cyclonedx \
  --certificate-identity-regexp='https://github.com/barbacana-waf/barbacana/\.github/workflows/.+@refs/tags/v.*' \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/barbacana-waf/barbacana:vX.Y.Z 2>/dev/null \
  | jq -r '.payload' | base64 -d | jq '.predicateType,.subject'
```

Example run against `latest`:

<!-- termynal -->

```console
$ cosign verify-attestation --type cyclonedx \
  --certificate-identity-regexp='https://github.com/barbacana-waf/barbacana/\.github/workflows/.+@refs/tags/v.*' \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/barbacana-waf/barbacana:latest 2>/dev/null \
  | jq -r '.payload' | base64 -d | jq '.predicateType,.subject'
"https://cyclonedx.org/bom"
[
  {
    "name": "ghcr.io/barbacana-waf/barbacana",
    "digest": {
      "sha256": "a4bad9626dffeeae0709fc50cffad6aff37ff4fd9b34c31998a49631b1da7c51"
    }
  }
]
```

Failure modes:

- `none of the attestations matched the predicate type: cyclonedx` — the image has no CycloneDX SBOM attached. Either the reference is wrong, the image was not produced by a release tag, or the attestation has been stripped from the registry.
- The certificate-identity check fails — same meaning as in step 1: the SBOM was attested by something other than the release workflow.

Both verification steps should pass before trusting the SBOM in step 4.

## 3. Enforce verification at admission (Kubernetes)

Steps 1 and 2 can be enforced automatically by a Kubernetes admission controller, so unsigned or unattested images are rejected at deploy time without any manual step. Two common options:

- [Sigstore Policy Controller](https://docs.sigstore.dev/policy-controller/overview/) — purpose-built admission webhook from the Sigstore project. Configure a `ClusterImagePolicy` with the same identity regex and OIDC issuer used in steps 1–2.
- [Kyverno](https://kyverno.io/docs/policy-types/verify-images/sigstore/) — general-purpose policy engine with a built-in `verifyImages` rule that calls cosign internally.

Either lets the cluster reject any pod whose image fails the same checks performed manually above.

## 4. Retrieve the SBOM

For tooling that consumes the SBOM file directly (Dependency-Track, GUAC, custom scanners), download and extract the CycloneDX predicate:

```
cosign download attestation \
  --predicate-type https://cyclonedx.org/bom \
  ghcr.io/barbacana-waf/barbacana:vX.Y.Z \
  | jq -r '.dsseEnvelope.payload' | base64 -d | jq '.predicate' \
  > barbacana.cdx.json
```

Example run against `latest` (download, then inspect the resulting file):

<!-- termynal -->

```console
$ cosign download attestation \
  --predicate-type https://cyclonedx.org/bom \
  ghcr.io/barbacana-waf/barbacana:latest \
  | jq -r '.dsseEnvelope.payload' | base64 -d | jq '.predicate' \
  > barbacana.cdx.json
$ jq -r '.bomFormat, .specVersion, (.components | length)' barbacana.cdx.json
CycloneDX
1.6
185
```

What each stage does:

- `cosign download attestation` fetches the signed in-toto bundle for the CycloneDX predicate type from the registry. No network call to Rekor is made — this is a registry read.
- `jq -r '.dsseEnvelope.payload'` extracts the base64-encoded DSSE payload (the in-toto statement).
- `base64 -d | jq '.predicate'` decodes the statement and unwraps the CycloneDX document.

The result is a standalone CycloneDX 1.x JSON document at `barbacana.cdx.json`.

`cosign download attestation` does **not** verify the signature — it only fetches. Always run step 2 first; only trust an SBOM whose attestation has already been verified.

## 5. Scan for CVEs

Two equivalent paths.

**Direct (no manual download)** — trivy fetches the attestation from the registry itself:

```
trivy image \
  --sbom-sources oci \
  --scanners vuln \
  ghcr.io/barbacana-waf/barbacana:vX.Y.Z
```

Example run against `latest`:

<!-- termynal -->

```console
$ trivy image \
  --sbom-sources oci \
  --scanners vuln \
  ghcr.io/barbacana-waf/barbacana:latest
Report Summary

┌──────────────────────────────────────────────────────┬──────────┬─────────────────┐
│                        Target                        │   Type   │ Vulnerabilities │
├──────────────────────────────────────────────────────┼──────────┼─────────────────┤
│ ghcr.io/barbacana-waf/barbacana:latest (debian 13.4) │  debian  │        0        │
├──────────────────────────────────────────────────────┼──────────┼─────────────────┤
│ ko-app/barbacana                                     │ gobinary │        0        │
└──────────────────────────────────────────────────────┴──────────┴─────────────────┘
```

!!! warning "The vulnerability count will change over time"
    The `0` reported in the example outputs below is the result at the time the scan was captured. CVEs are disclosed against existing components continuously, so the same image will start reporting findings without anything in the image changing. 

Best for operators who just want a vuln report against a deployed image. `--sbom-sources oci` tells trivy to prefer the registry-attached SBOM over re-deriving one from the image layers, which is faster and produces results that match exactly what was attested.

**From a downloaded SBOM** — useful for air-gapped scanning or when the same SBOM is fed into multiple tools:

```
trivy sbom barbacana.cdx.json
```

Example run against the SBOM extracted from `latest`:

<!-- termynal -->

```console
$ trivy sbom barbacana.cdx.json
Report Summary

┌────────┬──────────┬─────────────────┐
│ Target │   Type   │ Vulnerabilities │
├────────┼──────────┼─────────────────┤
│        │ gobinary │        0        │
└────────┴──────────┴─────────────────┘
```

Or with grype:

```
grype sbom:./barbacana.cdx.json
```

Both scanners auto-detect CycloneDX format. Severity, output format, and ignore-policy flags are scanner-specific — see the respective documentation.

A clean scan today does not mean the image is clean tomorrow; new CVEs are disclosed against existing components continuously. See the next section.

## Reference

- [Sigstore documentation](https://docs.sigstore.dev/) — background on cosign, Fulcio, Rekor, and the in-toto attestation format.
- [CycloneDX specification](https://cyclonedx.org/specification/overview/) — the SBOM format used in the attestation.
