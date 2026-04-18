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

async function backfillMLB(seasonYear: string): Promise<number> {
  const year = parseInt(seasonYear, 10);
  if (isNaN(year)) return 0;
  // MLB regular season runs late March through early October; postseason
  // through early November. Pull the whole window.
  const from = new Date(Date.UTC(year, 2, 20)); // Mar 20
  const todayUtc = new Date();
  const seasonEnd = new Date(Date.UTC(year, 10, 5)); // Nov 5
  const to = todayUtc.getTime() < seasonEnd.getTime() ? todayUtc : seasonEnd;

  let total = 0;
  await forEachDay(from, to, async (d) => {
    const dateStr = toDateStr(d);
    const data = await fetchJson(`${ESPN_BASE}/baseball/mlb/scoreboard?dates=${dateStr}`);
    if (!data) return;
    const games = sportsApi.parseESPNMLBGames(data);
    if (games.length > 0) total += await upsertGames(games);
  });
  console.log(`[backfill] MLB ${seasonYear}: stored ${total} games`);
  return total;
}

async function backfillNBA(leagueSeason: string, gamesSeason: string): Promise<number> {
  // NBA "2025-26" league season corresponds to ESPN's season=2026 (end year).
  // The regular season runs mid-October (start year) through mid-April
  // (end year); playoffs through mid-June.
  const endYear = parseInt(gamesSeason, 10);
  if (isNaN(endYear)) return 0;
  const startYear = endYear - 1;
  const from = new Date(Date.UTC(startYear, 9, 15)); // Oct 15 of start year
  const todayUtc = new Date();
  const seasonEnd = new Date(Date.UTC(endYear, 5, 25)); // Jun 25 of end year
  const to = todayUtc.getTime() < seasonEnd.getTime() ? todayUtc : seasonEnd;

  let total = 0;
  await forEachDay(from, to, async (d) => {
    const dateStr = toDateStr(d);
    const data = await fetchJson(`${ESPN_BASE}/basketball/nba/scoreboard?dates=${dateStr}`);
    if (!data) return;
    const games = sportsApi.parseESPNNBAGames(data);
    if (games.length > 0) total += await upsertGames(games);
  });
  console.log(`[backfill] NBA ${leagueSeason} (games season ${gamesSeason}): stored ${total} games`);
  return total;
}

async function backfillNFL(gamesSeason: string): Promise<number> {
  // NFL games-season key is the START year ("2025-26" -> "2025"). Regular
  // season is 18 weeks (seasontype=2); postseason has 5 weeks (seasontype=3).
  let total = 0;
  for (let week = 1; week <= 18; week++) {
    const data = await fetchJson(
      `${ESPN_BASE}/football/nfl/scoreboard?week=${week}&seasontype=2&year=${gamesSeason}`,
    );
    if (data) {
      const games = sportsApi.parseESPNGames(data, week, gamesSeason);
      if (games.length > 0) total += await upsertGames(games);
    }
  }
  for (let week = 1; week <= 5; week++) {
    const data = await fetchJson(
      `${ESPN_BASE}/football/nfl/scoreboard?week=${week}&seasontype=3&year=${gamesSeason}`,
    );
    if (data) {
      const games = sportsApi.parseESPNGames(data, week, gamesSeason);
      if (games.length > 0) total += await upsertGames(games);
    }
  }
  console.log(`[backfill] NFL ${gamesSeason}: stored ${total} games (regular + postseason)`);
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
  coverageThreshold?: number;
}): Promise<void> {
  const coverageThreshold = opts?.coverageThreshold ?? 200;
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
    const existing = await storage.getGames(undefined, t.gamesSeason);
    const sportExisting = existing.filter((g) => g.sport === t.sport).length;
    if (sportExisting >= coverageThreshold) {
      console.log(
        `[backfill] skip ${t.sport} ${t.leagueSeason} — already has ${sportExisting} games (>= ${coverageThreshold})`,
      );
      continue;
    }
    console.log(
      `[backfill] target ${t.sport} ${t.leagueSeason} (games season ${t.gamesSeason}); existing=${sportExisting}`,
    );
    try {
      if (t.sport === "MLB") await backfillMLB(t.gamesSeason);
      else if (t.sport === "NBA") await backfillNBA(t.leagueSeason, t.gamesSeason);
      else if (t.sport === "NFL") await backfillNFL(t.gamesSeason);
    } catch (err) {
      console.error(`[backfill] ${t.sport} ${t.leagueSeason} failed:`, err);
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[backfill] historical games backfill complete in ${elapsed}s`);
}
