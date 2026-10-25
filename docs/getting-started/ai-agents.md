# AI coding agents

Barbacana skills let an AI coding agent install, configure, tune, and operate Barbacana for you. They work with Claude Code, Codex, Cursor, OpenCode, and the other agents supported by the [`skills`](https://github.com/vercel-labs/skills) CLI. The skills are published at [barbacana-waf/skills](https://github.com/barbacana-waf/skills) and listed on [skills.sh](https://www.skills.sh/).

## Skills

| Skill | What the agent can do with it |
|---|---|
| `barbacana-waf-install` | Put Barbacana in front of your app (Docker Compose, Kubernetes, or a binary with systemd), pick the TLS mode, pin and verify a release, and smoke-test it |
| `barbacana-waf-configure` | Add and change routes, headers, CORS, uploads, and limits, validating every change |
| `barbacana-waf-tune` | Find which protection blocked a legitimate request in the audit log and relax the narrowest thing that fixes it, never a whole protection family |
| `barbacana-waf-operate` | Metrics, alert rules, Grafana, audit logs and forwarding to a SIEM (security information and event management system), tracing, config reloads, and troubleshooting a failing instance |

## Install

Install all four skills and pick your agent interactively:

```bash
npx skills add barbacana-waf/skills
```

To install one skill for one agent:

```bash
npx skills add barbacana-waf/skills --skill barbacana-waf-install --agent claude-code --global
```

The `skills` CLI is made by [vercel-labs](https://github.com/vercel-labs/skills), not by Barbacana. It sends anonymous install telemetry. Set `DISABLE_TELEMETRY=1` to opt out.

To install without the CLI, clone the repository and copy the folders under `skills/` into your agent's skills directory:

```bash
git clone https://github.com/barbacana-waf/skills.git
```

## Use

Ask your agent in plain language. For example:

- "Put a WAF in front of the Flask service in this directory. TLS is handled by our load balancer."
- "Deploy Barbacana on my VPS so https://shop.example.com is protected."
- "Set up Barbacana in front of the `orders` service and make sure Prometheus can scrape it."

The agent proposes each step, checks the configuration with `barbacana --validate` before it runs anything, pins a release version, and finishes with a smoke test. Protection names come from `barbacana --catalog`, so the agent uses the same names as your version of Barbacana.

## Next

- [Quickstart](quickstart.md) — the same first deployment, by hand
- [Disable protections](../reference/disable.md) — what the tune skill changes in your config
