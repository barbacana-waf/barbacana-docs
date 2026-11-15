// Cloudflare Worker that receives page view beacons from the docs site and stores them in D1.
// It stores no IP address and sets no cookie.

interface D1Statement { bind(...v: unknown[]): { run(): Promise<unknown> } }
interface Env {
  DB: { prepare(sql: string): D1Statement };
  ALLOWED_ORIGINS: string; // comma-separated
}

const MAX_BODY = 2048;
const MAX_VISIBLE_MS = 2 * 60 * 60 * 1000;

const UPSERT = `
INSERT INTO events (id, path, referrer, ua, bot_score, visible_ms, scroll_pct, interacted, owner, created_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
ON CONFLICT(id) DO UPDATE SET
  visible_ms = MAX(visible_ms, excluded.visible_ms),
  scroll_pct = MAX(scroll_pct, excluded.scroll_pct),
  interacted = MAX(interacted, excluded.interacted),
  owner = MAX(owner, excluded.owner),
  updated_at = excluded.updated_at`;

const int = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), max) : null;

/** Origin + path of the referrer, without query string or fragment. */
function cleanReferrer(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  try {
    const u = new URL(raw);
    return (u.origin + u.pathname).slice(0, 200);
  } catch { return ""; }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    const origin = req.headers.get("Origin") ?? "";
    if (!allowed.includes(origin)) return new Response(null, { status: 403 });
    const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });

    const text = await req.text();
    if (text.length > MAX_BODY) return new Response(null, { status: 413, headers: cors });
    let b: Record<string, unknown>;
    try { b = JSON.parse(text); } catch { return new Response(null, { status: 400, headers: cors }); }

    const id = typeof b.id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(b.id) ? b.id : null;
    const path = typeof b.path === "string" && b.path.startsWith("/") && b.path.length <= 200 ? b.path : null;
    const visible = int(b.v, MAX_VISIBLE_MS);
    const scroll = int(b.s, 100);
    if (!id || !path || visible === null || scroll === null) return new Response(null, { status: 400, headers: cors });

    const cf = (req as unknown as { cf?: { botManagement?: { score?: number } } }).cf;
    await env.DB.prepare(UPSERT).bind(
      id, path, cleanReferrer(b.ref), (req.headers.get("User-Agent") ?? "").slice(0, 200),
      cf?.botManagement?.score ?? null, visible, scroll, b.i ? 1 : 0, b.m ? 1 : 0, Date.now(),
    ).run();
    return new Response(null, { status: 204, headers: cors });
  },
};
