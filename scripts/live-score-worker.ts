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

async function runOneCycle(
  label: string,
  sportsToSync?: { MLB: boolean; NBA: boolean; NFL: boolean },
): Promise<void> {
  const startedAt = Date.now();
  const now = new Date();
  log(`▶ ${label}: sync starting`);

  // Per-sport in-season check up front so we know which sports to skip
  // entirely this cycle (no API call, no DB write).
  const [mlbInSeason, nbaInSeason, nflInSeason] = await Promise.all([
    isInSeason("MLB", now),
    isInSeason("NBA", now),
    isInSeason("NFL", now),
  ]);

  // Per-sport cadence filter: when the caller supplies `sportsToSync`,
  // a sport only runs this cycle if it's in season AND flagged to sync.
  // This is what lets MLB sit on the 15-min idle cadence while NFL syncs
  // every 2 min during a Monday Night Football game.
  const mlbOn = mlbInSeason && (sportsToSync?.MLB ?? true);
  const nbaOn = nbaInSeason && (sportsToSync?.NBA ?? true);
  const nflOn = nflInSeason && (sportsToSync?.NFL ?? true);

  if (!mlbInSeason) log("  ⊘ skipping MLB: off-season");
  else if (!mlbOn)  log("  ⊘ skipping MLB: idle cadence (no live game)");
  if (!nbaInSeason) log("  ⊘ skipping NBA: off-season");
  else if (!nbaOn)  log("  ⊘ skipping NBA: idle cadence (no live game)");
  if (!nflInSeason) log("  ⊘ skipping NFL: off-season");
  else if (!nflOn)  log("  ⊘ skipping NFL: idle cadence (no live game)");

  // Each sport is wrapped in its own try/catch so one failure doesn't skip
  // the rest of the cycle. The worker as a whole should never exit on a
  // transient ESPN error.
  const tasks: Array<[string, () => Promise<unknown>]> = [];

  // Per-sport timing + error capture so we can persist accurate "last sync"
  // metadata for the admin dashboard.
  const sportTimers: Record<Sport, { start: number; error: string | null } | undefined> = {
    MLB: undefined, NBA: undefined, NFL: undefined,
  };
  const startSport = (s: Sport) => {
    if (!sportTimers[s]) sportTimers[s] = { start: Date.now(), error: null };
  };
  const failSport = (s: Sport, err: unknown) => {
    const t = sportTimers[s];
    if (t && !t.error) t.error = err instanceof Error ? err.message : String(err);
  };

  if (mlbOn) {
    startSport("MLB");
    tasks.push(["MLB standings", () => sportsService.updateMLBStandings().catch(e => { failSport("MLB", e); throw e; })]);
    tasks.push(["MLB games",     () => sportsApi.syncMLBGames().catch(e => { failSport("MLB", e); throw e; })]);
  }
  if (nbaOn) {
    startSport("NBA");
    tasks.push(["NBA standings", () => sportsService.updateNBAStandings().catch(e => { failSport("NBA", e); throw e; })]);
    tasks.push(["NBA games",     () => sportsApi.syncNBAGames().catch(e => { failSport("NBA", e); throw e; })]);
  }
  if (nflOn) {
    startSport("NFL");
    tasks.push(["NFL standings",        () => sportsService.updateNFLStandings().catch(e => { failSport("NFL", e); throw e; })]);
    tasks.push(["NFL games (current)",  () => sportsApi.syncCurrentNFLGames().catch(e => { failSport("NFL", e); throw e; })]);
    tasks.push(["NFL games (next wk)",  () => sportsApi.syncNextWeekNFLGames().catch(e => { failSport("NFL", e); throw e; })]);
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

  // Persist per-sport sync metadata so the admin dashboard can show
  // when each sport last refreshed and surface any error from the
  // most recent attempt.
  for (const sport of ["MLB", "NBA", "NFL"] as Sport[]) {
    const t = sportTimers[sport];
    if (!t) continue;
    try {
      await storage.recordSyncResult(sport, Date.now() - t.start, t.error);
    } catch (err) {
      log(`  ! failed to record sync status for ${sport}:`, err);
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

  // Per-sport "next idle sync due" timestamps. When a sport is on the
  // idle cadence (no live games of its own) but the worker is ticking
  // every 2 min because some *other* sport is live, we still want the
  // idle sport's standings/games to refresh at least every 15 min.
  // Initialized to "due now" so each sport gets one sync on the first
  // post-startup tick.
  let mlbDueAt = Date.now();
  let nbaDueAt = Date.now();
  let nflDueAt = Date.now();

  // Continuous loop. We use a self-rescheduling setTimeout instead of
  // setInterval so a slow cycle can never overlap with the next one.
  const tick = async () => {
    const now = new Date();

    // Choose the interval BEFORE running the cycle so the log line is
    // accurate, and so we don't pay the cost of a live-game check during
    // quiet hours when we're already throttled to 1 hr regardless.
    let intervalMs: number;
    let label: string;

    let sportsToSync: { MLB: boolean; NBA: boolean; NFL: boolean } | undefined;

    if (isQuietHours(now)) {
      intervalMs = QUIET_INTERVAL_MS;
      label = "quiet-hours (1h)";
      // During quiet hours we still sync everything that's in season,
      // just at the 1-hour cadence. Leave sportsToSync undefined so
      // runOneCycle treats all sports as eligible.
    } else {
      // Per-sport live-game check. A sport with at least one in-progress
      // game runs on the 2-minute "active" cadence this tick; sports with
      // nothing live fall back to the 15-minute idle cadence even if
      // another sport is live right now.
      let mlbLive = false, nbaLive = false, nflLive = false;
      try {
        [mlbLive, nbaLive, nflLive] = await Promise.all([
          storage.hasGamesInProgressBySport("MLB"),
          storage.hasGamesInProgressBySport("NBA"),
          storage.hasGamesInProgressBySport("NFL"),
        ]);
      } catch (err) {
        // Defensive: a DB hiccup shouldn't push us off-cadence. Assume
        // everything is live (the safer choice) and continue.
        log("hasGamesInProgressBySport() failed; assuming all live:", err);
        mlbLive = nbaLive = nflLive = true;
      }

      const anyLive = mlbLive || nbaLive || nflLive;
      if (anyLive) {
        intervalMs = ACTIVE_INTERVAL_MS;
        const liveSports = [
          mlbLive ? "MLB" : null,
          nbaLive ? "NBA" : null,
          nflLive ? "NFL" : null,
        ].filter(Boolean).join(",");
        const idleSports = [
          !mlbLive ? "MLB" : null,
          !nbaLive ? "NBA" : null,
          !nflLive ? "NFL" : null,
        ].filter(Boolean).join(",") || "none";
        label = `active — live: [${liveSports}] idle-this-tick: [${idleSports}] (2m)`;
        // Only the live sports sync at this 2-min tick. The idle sports
        // will still sync, but only on ticks where the elapsed time has
        // crossed the 15-min idle threshold.
        sportsToSync = {
          MLB: mlbLive || mlbDueAt <= now.getTime(),
          NBA: nbaLive || nbaDueAt <= now.getTime(),
          NFL: nflLive || nflDueAt <= now.getTime(),
        };
      } else {
        intervalMs = IDLE_INTERVAL_MS;
        label = "idle — no live games anywhere (15m)";
      }
    }

    try {
      await runOneCycle(label, sportsToSync);
      // Advance the per-sport "next idle sync due" timestamps for sports
      // that actually ran this cycle. Sports that were held off until
      // their idle cadence keep their existing due time.
      const advancedAt = Date.now();
      if (!sportsToSync || sportsToSync.MLB) mlbDueAt = advancedAt + IDLE_INTERVAL_MS;
      if (!sportsToSync || sportsToSync.NBA) nbaDueAt = advancedAt + IDLE_INTERVAL_MS;
      if (!sportsToSync || sportsToSync.NFL) nflDueAt = advancedAt + IDLE_INTERVAL_MS;
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
