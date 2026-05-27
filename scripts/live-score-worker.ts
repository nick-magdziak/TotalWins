/**
 * Live score worker
 * -----------------
 * This process owns ALL ESPN sports-data syncing. It used to live inside the
 * Express web server, but that meant every Autoscale instance would spin up
 * its own sync loops and hammer ESPN in parallel. Now the website runs
 * stateless on Autoscale and a single Reserved VM runs this worker, writing
 * to the same Postgres database via DATABASE_URL.
 *
 * Run locally:
 *   npm run worker:live-scores
 *
 * Deploy:
 *   Reserved VM / always-on worker, command = `npm run worker:live-scores`
 *   (or `tsx scripts/live-score-worker.ts` directly).
 */

import { storage } from "../server/storage";
import { SportsDataService } from "../server/sportsDataService";
import { sportsApi } from "../server/services/sportsApi";
import { worldCupDataService } from "../server/services/worldCupService";

const sportsService = new SportsDataService(storage);

// Sync cadence — three tiers:
//   live    : at least one game is in progress → 2 min (near-instant feel)
//   idle    : no live games → 15 min (most of the day)
//   quiet   : 2 AM – 6 AM local server time → 1 hr (overnight)
const ACTIVE_INTERVAL_MS = 2 * 60 * 1000;       // 2 minutes
const IDLE_INTERVAL_MS   = 15 * 60 * 1000;      // 15 minutes
const QUIET_INTERVAL_MS  = 60 * 60 * 1000;      // 1 hour (overnight)

type Sport = "MLB" | "NBA" | "NFL";

function log(...args: unknown[]) {
  const ts = new Date().toISOString();
  console.log(`[live-score-worker ${ts}]`, ...args);
}

function isWorldCupTournamentWindow(now: Date): boolean {
  // 2026 FIFA World Cup runs June–July 2026. Outside that window there's
  // nothing to sync, so we skip the WC call entirely.
  return now.getFullYear() === 2026 && now.getMonth() + 1 >= 6 && now.getMonth() + 1 <= 7;
}

function isQuietHours(now: Date): boolean {
  // Local-server clock. The web server's old 2-min loop only ran 6 AM – 2 AM,
  // so we mirror that: 2 AM – 6 AM is "quiet".
  const hour = now.getHours();
  return hour >= 2 && hour < 6;
}

/**
 * Calendar-based safety net for whether a sport is plausibly in its
 * regular season right now. Mirrors the logic in storage.getRegularSeasonStatus
 * so we never skip a sport during its actual season window — even if the
 * games table is empty/stale.
 *   MLB regular season: late March → late September   (months 2..8)
 *   NBA regular season: mid-October → mid-April       (months 9..11, 0..3)
 *   NFL regular season: September → early January     (months 8..11, 0)
 */
function inCalendarSeasonWindow(sport: Sport, now: Date): boolean {
  const m = now.getMonth(); // 0 = Jan
  if (sport === "MLB") return m >= 2 && m <= 8;
  if (sport === "NBA") return m >= 9 || m <= 3;
  if (sport === "NFL") return m >= 8 || m === 0;
  return true;
}

/**
 * Returns true when we should sync the given sport on this cycle.
 * Conservative — defaults to true on any uncertainty so we never silently
 * stop syncing a sport that's actually in season.
 */
async function isInSeason(sport: Sport, now: Date): Promise<boolean> {
  // Within the sport's calendar window → always in season.
  if (inCalendarSeasonWindow(sport, now)) return true;

  // Outside the calendar window: only consider it in season if there are
  // upcoming regular-season games scheduled in the games table.
  try {
    return await storage.hasUpcomingRegularSeasonGames(sport, 14);
  } catch (err) {
    log(`isInSeason(${sport}) check failed; defaulting to in-season:`, err);
    return true;
  }
}

async function runOneCycle(label: string): Promise<void> {
  const startedAt = Date.now();
  const now = new Date();
  log(`▶ ${label}: sync starting`);

  // Per-sport in-season check up front so we know which sports to skip
  // entirely this cycle (no API call, no DB write).
  const [mlbOn, nbaOn, nflOn] = await Promise.all([
    isInSeason("MLB", now),
    isInSeason("NBA", now),
    isInSeason("NFL", now),
  ]);

  if (!mlbOn) log("  ⊘ skipping MLB: off-season");
  if (!nbaOn) log("  ⊘ skipping NBA: off-season");
  if (!nflOn) log("  ⊘ skipping NFL: off-season");

  // Each sport is wrapped in its own try/catch so one failure doesn't skip
  // the rest of the cycle. The worker as a whole should never exit on a
  // transient ESPN error.
  const tasks: Array<[string, () => Promise<unknown>]> = [];

  if (mlbOn) {
    tasks.push(["MLB standings", () => sportsService.updateMLBStandings()]);
    tasks.push(["MLB games",     () => sportsApi.syncMLBGames()]);
  }
  if (nbaOn) {
    tasks.push(["NBA standings", () => sportsService.updateNBAStandings()]);
    tasks.push(["NBA games",     () => sportsApi.syncNBAGames()]);
  }
  if (nflOn) {
    tasks.push(["NFL standings",        () => sportsService.updateNFLStandings()]);
    tasks.push(["NFL games (current)",  () => sportsApi.syncCurrentNFLGames()]);
    tasks.push(["NFL games (next wk)",  () => sportsApi.syncNextWeekNFLGames()]);
  }

  // ESPN team-record endpoint covers all three sports in one helper, so we
  // call it once with the subset of sports that are currently in season.
  const inSeasonSports: Array<"NFL" | "MLB" | "NBA"> = [];
  if (nflOn) inSeasonSports.push("NFL");
  if (mlbOn) inSeasonSports.push("MLB");
  if (nbaOn) inSeasonSports.push("NBA");
  if (inSeasonSports.length > 0) {
    tasks.push([
      `ESPN team standings (${inSeasonSports.join(",")})`,
      () => sportsApi.syncTeamStandingsFromESPN(inSeasonSports),
    ]);
  }

  if (isWorldCupTournamentWindow(now)) {
    tasks.push(["World Cup games", () => worldCupDataService.syncWorldCupGames()]);
  }

  for (const [name, fn] of tasks) {
    try {
      await fn();
      log(`  ✓ ${name}`);
    } catch (err) {
      log(`  ✗ ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  log(`■ ${label}: sync complete in ${(elapsedMs / 1000).toFixed(1)}s (${tasks.length} tasks)`);
}

async function main(): Promise<void> {
  log("worker booting");
  log(`DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);

  // Run once immediately on startup so the database is fresh before the
  // first interval fires.
  await runOneCycle("startup");

  // Gap backfill: if the worker has been down for a while, the regular
  // sync (yesterday/today/tomorrow only) leaves a hole in the games table
  // that the standings query then under-counts. On every startup, pull a
  // wider window (30 days back) once so any gap heals automatically.
  // Cheap: ~30 ESPN calls per sport, only at boot time.
  try {
    log("▶ startup backfill: 30-day MLB/NBA games window");
    await sportsApi.syncMLBGames(30, 2);
    await sportsApi.syncNBAGames(30, 1);
    log("■ startup backfill: complete");
  } catch (err) {
    log("startup backfill failed:", err instanceof Error ? err.message : err);
  }

  // Optional one-shot historical backfill, gated by env flag. Used to live
  // in the web server. Runs in the background so the live loop isn't blocked.
  if (process.env.BACKFILL_HISTORICAL_GAMES === "true") {
    (async () => {
      try {
        const { runHistoricalGamesBackfill } = await import(
          "../server/services/historicalBackfill"
        );
        log("historical backfill: starting");
        await runHistoricalGamesBackfill();
        log("historical backfill: complete");
      } catch (err) {
        log("historical backfill failed:", err);
      }
    })();
  }

  // Continuous loop. We use a self-rescheduling setTimeout instead of
  // setInterval so a slow cycle can never overlap with the next one.
  const tick = async () => {
    const now = new Date();

    // Choose the interval BEFORE running the cycle so the log line is
    // accurate, and so we don't pay the cost of a live-game check during
    // quiet hours when we're already throttled to 1 hr regardless.
    let intervalMs: number;
    let label: string;

    if (isQuietHours(now)) {
      intervalMs = QUIET_INTERVAL_MS;
      label = "quiet-hours (1h)";
    } else {
      let live = false;
      try {
        live = await storage.hasGamesInProgress();
      } catch (err) {
        // Defensive: a DB hiccup shouldn't push us off-cadence. Assume live
        // (the safer choice) and continue.
        log("hasGamesInProgress() failed; assuming live:", err);
        live = true;
      }
      if (live) {
        intervalMs = ACTIVE_INTERVAL_MS;
        label = "active — live games detected (2m)";
      } else {
        intervalMs = IDLE_INTERVAL_MS;
        label = "idle — no live games (15m)";
      }
    }

    try {
      await runOneCycle(label);
    } catch (err) {
      // Defensive: runOneCycle already swallows per-task errors, but if the
      // wrapper itself ever throws we still want to keep ticking.
      log("unexpected cycle error:", err);
    }
    setTimeout(tick, intervalMs);
  };

  setTimeout(tick, ACTIVE_INTERVAL_MS);
  log(`live loop scheduled (active=${ACTIVE_INTERVAL_MS / 1000}s, idle=${IDLE_INTERVAL_MS / 1000}s, quiet=${QUIET_INTERVAL_MS / 1000}s)`);
}

// Graceful shutdown so deployment platforms can rotate the worker cleanly.
process.on("SIGTERM", () => {
  log("SIGTERM received, exiting");
  process.exit(0);
});
process.on("SIGINT", () => {
  log("SIGINT received, exiting");
  process.exit(0);
});

main().catch((err) => {
  log("fatal worker error:", err);
  process.exit(1);
});
