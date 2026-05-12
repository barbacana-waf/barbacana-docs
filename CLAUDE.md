# Barbacana docs — section guide

Public documentation site at https://barbacana.dev, built with MkDocs Material. Navigation lives in [mkdocs.yml](mkdocs.yml); content under [docs/](docs/). Check those for the current file layout — don't maintain a duplicate index here.

When adding or editing a page, decide which top-level section it belongs in based on **audience and intent**, not topic. The same feature can legitimately appear in two sections — each copy written for *that* section's audience.

## Sections

### `docs/getting-started/` — first-time users

Someone who just heard of Barbacana and wants it running in front of their app. Approachable, minimal jargon, copy-paste friendly. Assume Docker and a terminal — not a Kubernetes cluster, not a SIEM. The 5-minute happy path, install methods, incremental config walkthroughs, and troubleshooting for problems hit in the first hour.

### `docs/operations/` — infrastructure / SRE / platform engineers

The person deploying Barbacana into a real environment and keeping it healthy in production. Assumes familiarity with TLS/ACME, Prometheus, OpenTelemetry, log pipelines, container orchestration. Show manifests, scrape configs, OTLP endpoints, dashboards.

Rule of thumb: *"how do I run this in prod / observe it / wire it into my platform"* → here.

### `docs/security/` — security engineers and analysts

AppSec / SecOps deciding whether Barbacana is trustworthy, what it actually inspects, and how to feed its output into their detection stack. Precise about threat model and guarantees: request lifecycle, blocking decisions, log field meaning, supply-chain verification.

Rule of thumb: *"can I trust it / what does it detect / how do I investigate after the fact"* → here.

Note: logs appear in two sections on purpose — Operations covers shipping/rotation; Security covers field meaning and SIEM use.

### `docs/reference/` — configuration API

Reader already has a config file open and needs the exact field, value, or default. Dense, accurate, minimal narrative. Tables, field-by-field breakdowns, full schema. No conceptual intros — link back to Getting Started or Operations for those.

Rule of thumb: reader knows *what* they want to configure and only needs *how to spell it* → here.

## Placement decision tree

1. First encounter with Barbacana? → Getting Started
2. Requires infra context (k8s, Prometheus, OTLP, ACME)? → Operations
3. Reader is a security engineer evaluating or investigating? → Security
4. A field, value, default, or schema? → Reference

If two answers feel right, the page exists in both — but each copy is rewritten for that audience, not duplicated.

## Cross-cutting rules

- Public docs are self-contained. Do not link into the [barbacana](../barbacana) source repo. Show raw commands, never `make` targets — readers don't have the source checkout.
- Preserve "server-side" / "your server" phrasing where it appears. It disambiguates Barbacana (a server-side gateway) from client-side web app concerns.
- Update `nav:` in [mkdocs.yml](mkdocs.yml) whenever a page is added, moved, or removed.

Good, I have enough from all three. Here's an honest synthesis — only rules that appear across at least two of the three guides, with a note on the one real disagreement.

---

## Technical Documentation Language — Common Practices

*Derived from the Microsoft Writing Style Guide, Google Developer Documentation Style Guide, and Apple Style Guide.*

### Voice
- Use **active voice** by default. Passive voice is acceptable when the actor is unknown or irrelevant.
- Use the **imperative mood** for instructions and procedures: "Run the command", not "The command should be run".
- Write in **second person ("you")** when addressing the reader directly. *(All three guides recommend this — though as discussed, it can be avoided by keeping the imperative mood and making the system the subject of descriptive sentences.)*

### Language and tone
- Use **plain, everyday words**: "use" not "utilize", "start" not "initiate", "show" not "demonstrate".
- Keep sentences **short and simple**. Standard word order: subject → verb → object.
- Be **conversational but not casual** — write as if explaining to a knowledgeable colleague, not lecturing.
- Do **not minimize complexity**: avoid "easily", "simply", "just", "quick", and similar words that set false expectations.
- Do **not make unsupported claims** about what something does or can do.

### Global audience
- Write for **non-native English speakers and translators**: short sentences, no idioms, no colloquial expressions, no culture-specific references.
- Avoid **modifier stacks**: long chains of adjectives are hard to translate and parse ("extremely well thought-out migration project plan").
- Use **one word for one concept**, consistently. Do not use synonyms for the same term to add variety — it creates confusion for readers and translators.

### Terminology
- **Define acronyms and abbreviations on first use**.
- Use **consistent terminology** throughout — if you call something a "configuration file" in one place, do not call it a "config" or "settings file" elsewhere without explanation.

### Procedures
- **Number sequential steps**; use bullet points only for genuinely unordered lists.
- State the expected **outcome after a step** when it is not obvious.
- Put **qualifying conditions before the instruction**, not after: "If the server is running, stop it" not "Stop the server if it is running."

### Formatting
- Use **code formatting** (inline or block) for all commands, file paths, environment variables, code samples, and UI element names.
- Use **sentence case** for headings and titles *(Google and Microsoft; Apple varies by context)*.

### Inclusivity
- Use **gender-neutral language**: prefer "they/their" for generic references; restructure sentences to avoid gendered pronouns where possible.
- Avoid **unnecessary references to disability, age, or cultural identity** in examples.
