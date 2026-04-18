import { storage } from "../storage";
import { sportsApi } from "./sportsApi";
import { db } from "../db";
import { leagues, type InsertGame } from "@shared/schema";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0].replace(/-/g, "");
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[backfill] fetch failed: ${url}`, err);
    return null;
  }
}

async function upsertGames(games: InsertGame[]): Promise<number> {
  let count = 0;
  for (const g of games) {
    try {
      await storage.addGame(g);
      count++;
    } catch (err) {
      console.error(`[backfill] addGame failed for ${g.id}:`, err);
    }
  }
  return count;
}

/**
 * Iterate from `from` (inclusive) to `to` (inclusive) in 1-day steps,
 * calling fn(date) for each. Bails after `maxDays` to avoid runaway loops.
 */
async function forEachDay(
  from: Date,
  to: Date,
  fn: (d: Date) => Promise<void>,
  maxDays = 400,
): Promise<void> {
  const cur = new Date(from.getTime());
  let n = 0;
  while (cur.getTime() <= to.getTime() && n < maxDays) {
    await fn(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 1);
    n++;
  }
}

// Expected regular-season game counts per sport. Used to detect completeness
// so the backfill only short-circuits when a season is genuinely fully synced.
//   * NFL: 32 teams × 17 games / 2 = 272
//   * MLB: 30 teams × 162 games / 2 = 2430
//   * NBA: 30 teams × 82 games / 2  = 1230
const EXPECTED_REGULAR_SEASON_GAMES: Record<string, number> = {
  NFL: 272,
  MLB: 2430,
  NBA: 1230,
};

async function backfillMLB(seasonYear: string): Promise<number> {
  const year = parseInt(seasonYear, 10);
  if (isNaN(year)) return 0;
  // MLB regular season runs late March through early October. We deliberately
  // stop at Oct 1 so postseason games are not pulled — standings count only
  // regular-season games.
  // Wide window that fully covers regular-season variations (international
  // openers in Feb/Mar, postponed makeup games into Oct). Postseason games
  // are still excluded by the `seasonType === "regular"` filter below.
  const from = new Date(Date.UTC(year, 1, 20)); // Feb 20
  const todayUtc = new Date();
  const seasonEnd = new Date(Date.UTC(year, 9, 15)); // Oct 15
  const to = todayUtc.getTime() < seasonEnd.getTime() ? todayUtc : seasonEnd;

  let total = 0;
  await forEachDay(from, to, async (d) => {
    const dateStr = toDateStr(d);
    const data = await fetchJson(`${ESPN_BASE}/baseball/mlb/scoreboard?dates=${dateStr}`);
    if (!data) return;
    const games = sportsApi
      .parseESPNMLBGames(data)
      .filter((g) => g.seasonType === "regular");
    if (games.length > 0) total += await upsertGames(games);
  });
  console.log(`[backfill] MLB ${seasonYear}: stored ${total} regular-season games`);
  return total;
}

async function backfillNBA(leagueSeason: string, gamesSeason: string): Promise<number> {
  // NBA "2025-26" league season corresponds to ESPN's season=2026 (end year).
  // Regular season runs mid-October (start year) through mid-April (end year).
  // We stop at Apr 20 so playoffs are not pulled.
  const endYear = parseInt(gamesSeason, 10);
  if (isNaN(endYear)) return 0;
  const startYear = endYear - 1;
  // Wide window so any preseason/late-makeup edge cases are still scanned;
  // postseason is excluded by the `seasonType === "regular"` filter below.
  const from = new Date(Date.UTC(startYear, 9, 1)); // Oct 1 of start year
  const todayUtc = new Date();
  const seasonEnd = new Date(Date.UTC(endYear, 3, 25)); // Apr 25 of end year
  const to = todayUtc.getTime() < seasonEnd.getTime() ? todayUtc : seasonEnd;

  let total = 0;
  await forEachDay(from, to, async (d) => {
    const dateStr = toDateStr(d);
    const data = await fetchJson(`${ESPN_BASE}/basketball/nba/scoreboard?dates=${dateStr}`);
    if (!data) return;
    const games = sportsApi
      .parseESPNNBAGames(data)
      .filter((g) => g.seasonType === "regular");
    if (games.length > 0) total += await upsertGames(games);
  });
  console.log(
    `[backfill] NBA ${leagueSeason} (games season ${gamesSeason}): stored ${total} regular-season games`,
  );
  return total;
}

async function backfillNFL(gamesSeason: string): Promise<number> {
  // NFL games-season key is the START year ("2025-26" -> "2025"). Regular
  // season is 18 weeks (seasontype=2). Postseason (seasontype=3) is
  // intentionally NOT pulled so it cannot inflate league win totals.
  let total = 0;
  for (let week = 1; week <= 18; week++) {
    const data = await fetchJson(
      `${ESPN_BASE}/football/nfl/scoreboard?week=${week}&seasontype=2&year=${gamesSeason}`,
    );
    if (data) {
      const games = sportsApi
        .parseESPNGames(data, week, gamesSeason)
        .filter((g) => g.seasonType === "regular");
      if (games.length > 0) total += await upsertGames(games);
    }
  }
  console.log(`[backfill] NFL ${gamesSeason}: stored ${total} regular-season games`);
  return total;
}

/**
 * Convert a league season ("2025", "2025-26") to the season key used in the
 * games table for that sport. NFL uses START year; NBA uses END year.
 */
function normalizeSeasonForGames(sport: string, leagueSeason: string): string {
  if (!leagueSeason) return leagueSeason;
  if (sport === "NBA" && /^\d{4}-\d{2}$/.test(leagueSeason)) {
    return `${leagueSeason.slice(0, 2)}${leagueSeason.slice(5, 7)}`;
  }
  return leagueSeason.slice(0, 4);
}

/**
 * One-time historical backfill of past games for every distinct
 * (sport, season) combination represented by an existing league. Idempotent:
 * `storage.addGame` upserts on game id, so re-running only refreshes scores.
 *
 * Skips WORLD_CUP (handled by its own service) and skips combinations that
 * already have at least `coverageThreshold` games stored — assume those are
 * already covered.
 */
export async function runHistoricalGamesBackfill(opts?: {
  force?: boolean;
}): Promise<void> {
  const force = opts?.force === true;
  const started = Date.now();
  console.log("[backfill] historical games backfill starting…");

  const allLeagues = await db.select().from(leagues);
  const seen = new Set<string>();
  const targets: { sport: string; leagueSeason: string; gamesSeason: string }[] = [];
  for (const l of allLeagues) {
    if (!l.sport || !l.season) continue;
    if (l.sport === "WORLD_CUP") continue;
    const gamesSeason = normalizeSeasonForGames(l.sport, l.season);
    const key = `${l.sport}:${gamesSeason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ sport: l.sport, leagueSeason: l.season, gamesSeason });
  }

  for (const t of targets) {
    // Completeness check: count existing REGULAR-season games for this
    // sport/season and skip only when we have at least the expected
    // full-season count. For in-progress seasons this never trips, so the
    // backfill always runs and stays current.
    const existing = await storage.getGames(undefined, t.gamesSeason);
    const regularExisting = existing.filter(
      (g) => g.sport === t.sport && g.seasonType === "regular",
    ).length;
    const expected = EXPECTED_REGULAR_SEASON_GAMES[t.sport] ?? Infinity;
    if (!force && regularExisting >= expected) {
      console.log(
        `[backfill] skip ${t.sport} ${t.leagueSeason} — already complete ` +
          `(${regularExisting} >= ${expected} regular-season games)`,
      );
      continue;
    }
    console.log(
      `[backfill] target ${t.sport} ${t.leagueSeason} (games season ${t.gamesSeason}); ` +
        `existing regular=${regularExisting}, expected=${expected}`,
    );
    try {
      if (t.sport === "MLB") await backfillMLB(t.gamesSeason);
      else if (t.sport === "NBA") await backfillNBA(t.leagueSeason, t.gamesSeason);
      else if (t.sport === "NFL") await backfillNFL(t.gamesSeason);
    } catch (err) {
      console.error(`[backfill] ${t.sport} ${t.leagueSeason} failed:`, err);
    }

    // Post-run completeness validation: re-count regular-season rows now in
    // the games table for this sport+season and warn when below the
    // expected full-season total (only meaningful for completed seasons).
    const after = await storage.getGames(undefined, t.gamesSeason);
    const regularAfter = after.filter(
      (g) => g.sport === t.sport && g.seasonType === "regular",
    ).length;
    if (regularAfter < expected) {
      console.warn(
        `[backfill] WARN ${t.sport} ${t.leagueSeason}: regularGamesStored=${regularAfter} < expected=${expected} ` +
          `(in-progress season or partial coverage)`,
      );
    } else {
      console.log(
        `[backfill] OK   ${t.sport} ${t.leagueSeason}: regularGamesStored=${regularAfter} >= expected=${expected}`,
      );
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[backfill] historical games backfill complete in ${elapsed}s`);
}
