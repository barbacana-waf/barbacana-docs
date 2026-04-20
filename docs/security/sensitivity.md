# Sensitivity

Sensitivity controls how aggressive detection is. Higher sensitivity catches more attacks — and produces more false positives. Under the hood, it maps directly to the OWASP Core Rule Set's [paranoia level](https://coreruleset.org/docs/concepts/paranoia_levels/) (PL).

```yaml
routes:
  - upstream: http://app:8000
    inspection:
      sensitivity: 1          # default
      anomaly_threshold: 5    # default — see "Pair them" below
```

## Levels

Each level is cumulative: level 3 fires everything levels 1 and 2 fire, plus more.

| Level (CRS PL) | What it adds | False-positive risk |
|---|---|---|
| **1** (default) | High-confidence patterns — the classic attack shapes. Suitable for most apps without tuning. | Low |
| **2** | Broader regex variants of the PL1 patterns. | Moderate |
| **3** | Aggressive heuristics that catch common evasion attempts. | High — expect tuning |
| **4** | Text- and structure-level anomalies. Will block borderline-legitimate input. | Very high — only with extensive tuning |

## Pair sensitivity with `anomaly_threshold`

`anomaly_threshold` is the cumulative score a request must reach to be blocked. It defaults to `5`, which is only correct at sensitivity level 1.

Each higher level fires strictly more rules. With the threshold fixed, scores accumulate faster than the threshold can absorb and benign traffic trips the block. Raising sensitivity **without** raising the threshold can collapse the true-negative rate to near zero — in our own nightly sweep, PL4 with the default threshold blocked 100% of benign requests.

When you raise sensitivity, raise the threshold to match:

| Sensitivity | Recommended `anomaly_threshold` |
|---|---|
| 1 | 5  |
| 2 | 7  |
| 3 | 9  |
| 4 | 12 |

These pairings follow established CRS tuning guidance and are the values Barbacana's nightly security sweep runs against.

## When to raise it

- Your app handles sensitive data (payments, health records, credentials).
- You've completed a tuning cycle at the current level — false positives are at zero on real traffic.
- A threat model or pen-test result indicates you need to catch more sophisticated evasion.

If you can't tolerate false positives and haven't tuned, **stay at level 1**.

## Tuning workflow when raising

1. Switch the route to [`mode: detect_only`](../reference/detect-only.md).
2. Raise `sensitivity` **and** `anomaly_threshold` together (see the pairing table above).
3. Watch the [audit log](../operations/audit-log.md) under real traffic for a representative period — a day, a week, whatever covers your usage patterns.
4. For each false-positive pattern, [`disable`](../reference/disable.md) the most specific sub-protection.
5. Switch `mode` back to blocking (the default).

Repeat for the next level if needed.

!!! tip "Per route, not global"
    Sensitivity is set per route. A login endpoint can run at level 3 while a forgiving file-upload endpoint stays at level 1.

## Known soft spots

At every sensitivity level, CRS's current corpus has documented gaps in two categories:

- **SSTI (server-side template injection)** — CRS does not yet carry broad template-engine-specific payload coverage. Raising the level does not meaningfully improve coverage.
- **XSS (reflected, in specific contexts)** — the libinjection-based rules backing XSS detection are biased toward precision. Raising the level picks up some, not all, missing payloads.

These are CRS corpus gaps, not Barbacana integration gaps. They close on CRS bumps, not on sensitivity changes. If your threat model concentrates on these categories, add [OpenAPI validation](../reference/openapi.md) and application-level escaping as complementary defenses.

## How we measure this

Every Barbacana build runs the [gotestwaf](https://github.com/wallarm/gotestwaf) attack-simulation suite across all four sensitivity levels, each paired with its recommended threshold. The suite fires hundreds of attack and benign payloads across OWASP categories (SQLi, XSS, RCE, SSTI, XXE, LDAP, NoSQL, SSRF, path traversal) and reports the tradeoff curve: attack-block rate vs. clean-pass rate. Results are published as artifacts of the nightly `security-scan` workflow on GitHub.
