# Docs analytics

Measures which pages of the docs are read and for how long, without cookies and without storing IP addresses.
It replaces nothing in Cloudflare Web Analytics (the beacon in `overrides/main.html`), which only counts page views.

```
browser (overrides/main.html) --sendBeacon--> Worker (worker.ts) --> D1 (schema.sql)
```

- The page script records the visible time, the deepest scroll position, and whether the visitor interacted
  (scroll, pointer, key or touch). It sends one cumulative beacon each time the tab is hidden or closed.
- It does nothing when the browser sends Do Not Track.
- Owner flag: opening any page with `?me=1` stores a flag in that browser's local storage, and its page views are
  sent with `owner=1`. `?me=0` removes it. Visitors never get the flag; the script only reads the key.
- The Worker validates the payload, rejects other origins, and upserts one row per page view.
- Bots are not filtered here. All rows are kept; filtering happens when the data is queried, in the private
  stats project that pulls the rows.

## Privacy

Stored: see the fields below. Not stored: IP address, cookies, local storage, any identifier shared between
page views, country. The Worker does not read the IP address and observability logs are not enabled. Cloudflare
itself receives the IP address while serving the request, as the hosting provider.

The remaining fields are low risk on their own, but they are not zero risk: an unusual user agent combined with
an exact timestamp could single out a visit, though nothing links it to a person. Review this section whenever a
field is added.

## Stored fields

`path`, owner flag, referrer (origin and path only), user agent (first 200 characters), Cloudflare bot score (only if the
plan provides it), visible milliseconds, scroll depth, interaction flag, first and last beacon time, and a random
per-page-view id. Nothing links two page views of the same visitor.

## Where each part lives and how to update it

| Part | File | How to update |
|---|---|---|
| Browser script | `overrides/main.html` | `make deploy` in the docs repo |
| Worker | `analytics/worker.ts` | `bun deploy.ts` in this folder |
| D1 schema | `analytics/schema.sql` | Run the `ALTER TABLE` by hand in the D1 console; `CREATE TABLE IF NOT EXISTS` does not add columns |
| Pull, bot filter, reports | private stats project | Edit and run; nothing to deploy |

Adding the owner flag to a database created before it existed needs this once, in the D1 console, before
deploying the new Worker (the new Worker writes the column):

```sql
ALTER TABLE events ADD COLUMN owner INTEGER NOT NULL DEFAULT 0;
```

When a field is added, deploy the Worker first (it ignores fields it does not know), then the site. Add the same
column to `docs_events` in the stats project.

## Setup

Two tokens, each with the minimum permission. Create them in the dashboard under My Profile > API Tokens >
Create Custom Token, restricted to your account. Save each one yourself in a file with `chmod 600`.

| Token | Permission | Used by | File |
|---|---|---|---|
| Deploy | Account / Workers Scripts / Edit | `bun deploy.ts` | `~/.config/barbacana/cf-deploy.json` |
| Read | Account / D1 / Read | `collect.ts docs` in the stats project | `~/.config/barbacana/cf-d1.json` |

Both files hold `account_id` and `api_token`; the read file also holds `database_id`. Give the tokens a long
expiry (6-12 months) and note the date. Neither token can create or change a D1 database.

### Create the D1 database (once, in the dashboard)

1. Storage & Databases > D1 > Create database, name `barbacana-docs-analytics`.
2. Copy its database ID (UUID).
3. Open its Console tab, paste the contents of `schema.sql`, and run it.

### Deploy the Worker

```sh
cd analytics
bun install                                  # installs wrangler locally (no global install, no Node)
cp wrangler.toml.example wrangler.toml       # paste the database ID; git-ignored
bun deploy.ts                                # prints the Worker URL
```

`deploy.ts` runs `bun --bun x wrangler deploy` with the deploy token. The `--bun` flag makes Bun run wrangler
instead of looking for Node. Run the same command to update the Worker later. Schema changes are made by hand in
the D1 console (`ALTER TABLE events ADD COLUMN ...`).

Then enable the page script. In `mkdocs.yml` add:

```yaml
extra:
  analytics_endpoint: https://barbacana-docs-analytics.<your-subdomain>.workers.dev
```

Without this setting the script is not rendered, so deploying the docs before the Worker exists is safe.
Then run `make deploy` in the docs repo. The Worker is deployed separately with `bun deploy.ts`;
`make deploy` publishes only the MkDocs site.

The site does not use MkDocs Material instant navigation, so every page load is a full load. If you enable
`navigation.instant`, the script must also send a beacon on each `document$` event.

## Pulling the data

The private stats project reads D1 through the HTTP API. Create an API token limited to
**Account > D1 > Read**, and store it in `~/.config/barbacana/cf-d1.json`:

```json
{ "account_id": "...", "database_id": "...", "api_token": "..." }
```

Do not commit this file. Retention is unlimited by default; the volume is small.
