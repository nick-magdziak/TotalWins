ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "league_start_date" date;

-- One-time backfill: for any league whose league_start_date is still NULL,
-- set it to the earliest synced game date for that league's sport+season.
-- This preserves prior standings semantics for legacy rows: existing leagues
-- count wins from the start of the games we have for their sport+season.
UPDATE "leagues" l
SET "league_start_date" = sub.earliest::date
FROM (
  SELECT sport, season, MIN(game_date) AS earliest
  FROM games
  GROUP BY sport, season
) sub
WHERE l."league_start_date" IS NULL
  AND l.sport = sub.sport
  AND l.season = sub.season;
