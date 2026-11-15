-- D1 schema for the docs analytics Worker. One row per page view.
-- The client sends cumulative values, so the Worker upserts by id and keeps the maximum.
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,   -- random per page view, generated in the browser
  path        TEXT NOT NULL,      -- location.pathname
  referrer    TEXT NOT NULL,      -- origin + path of document.referrer, no query string
  ua          TEXT NOT NULL,      -- User-Agent, truncated to 200 characters
  bot_score   INTEGER,            -- Cloudflare bot score when the plan provides it, else NULL
  visible_ms  INTEGER NOT NULL,   -- time the tab was visible
  scroll_pct  INTEGER NOT NULL,   -- deepest scroll position, 0-100, only set by real scroll events
  interacted  INTEGER NOT NULL,   -- 1 after a scroll, pointer, key or touch event
  owner       INTEGER NOT NULL DEFAULT 0,  -- 1 when the site owner marked their own browser (?me=1)
  created_at  INTEGER NOT NULL,   -- ms since epoch, first beacon
  updated_at  INTEGER NOT NULL    -- ms since epoch, last beacon
);
CREATE INDEX IF NOT EXISTS events_updated ON events (updated_at, id);

-- Migration for a database created before the owner column existed (run once, by hand):
-- ALTER TABLE events ADD COLUMN owner INTEGER NOT NULL DEFAULT 0;
