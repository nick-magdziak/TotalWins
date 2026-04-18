ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "league_start_date" date;

-- One-time backfill: for any league whose league_start_date is still NULL,
-- set it to MIN(games.game_date) for that league's sport+season.
-- League seasons differ from games-table seasons:
--   * MLB / WORLD_CUP: same single-year format ("2025"), direct match
--   * NFL: league "YYYY-YY" -> games START year (first 4 chars of league season)
--   * NBA: league "YYYY-YY" -> games END year (e.g. "2025-26" -> "2026")
WITH normalized AS (
  SELECT
    id,
    sport,
    CASE
      WHEN sport = 'NBA' AND season ~ '^[0-9]{4}-[0-9]{2}$'
        THEN substring(season, 1, 2) || substring(season, 6, 2)
      ELSE substring(season, 1, 4)
    END AS games_season
  FROM "leagues"
  WHERE league_start_date IS NULL
),
floors AS (
  SELECT
    n.id,
    MIN(g.game_date)::date AS earliest
  FROM normalized n
  JOIN games g ON g.sport = n.sport AND g.season = n.games_season
  GROUP BY n.id
)
UPDATE "leagues" l
SET league_start_date = f.earliest
FROM floors f
WHERE l.id = f.id
  AND l.league_start_date IS NULL;
