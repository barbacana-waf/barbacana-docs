// Deploys the Worker with a token limited to "Workers Scripts: Edit". Usage (from this folder): bun deploy.ts
// Reads ~/.config/barbacana/cf-deploy.json: {"account_id": "...", "api_token": "..."}. The D1 database is created
// once in the dashboard (see README), so no D1 permission is needed here.
import { existsSync, readFileSync } from "node:fs";

const cfgPath = `${process.env.HOME}/.config/barbacana/cf-deploy.json`;
const fail = (msg: string): never => { console.error(msg); process.exit(1); };

if (!existsSync(cfgPath)) fail(`missing ${cfgPath} (see README, "Deploy token")`);
const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as { account_id?: string; api_token?: string };
if (!cfg.account_id || !cfg.api_token) fail(`${cfgPath} needs account_id and api_token`);

if (!existsSync("wrangler.toml")) fail("missing wrangler.toml: copy wrangler.toml.example and set database_id");
if (readFileSync("wrangler.toml", "utf8").includes("<your D1 database id>")) fail("wrangler.toml still has the database_id placeholder");

const p = Bun.spawnSync(["bun", "--bun", "x", "wrangler", "deploy"], {
  stdio: ["inherit", "inherit", "inherit"],
  env: { ...process.env, CLOUDFLARE_API_TOKEN: cfg.api_token, CLOUDFLARE_ACCOUNT_ID: cfg.account_id },
});
process.exit(p.exitCode ?? 1);
