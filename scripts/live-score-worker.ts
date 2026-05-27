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

// Sync cadence. We keep the same near-instant feel the web server used to
// provide (~2 minute heartbeat). Outside reasonable hours we throttle to once
// an hour to be polite to ESPN.
//
// TODO: live-game-aware throttling — when there is at least one in-progress
// game in the database, drop the interval to ~60s; when no games are live,
// stretch it to 10–15 minutes. The hooks for `getGames(undefined, season)`
// already exist in storage; wire them up here once we have a clean
// "is there a game live right now" helper across all four sports.
const ACTIVE_INTERVAL_MS = 2 * 60 * 1000;       // 2 minutes
const QUIET_INTERVAL_MS  = 60 * 60 * 1000;      // 1 hour (overnight)

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

async function runOneCycle(label: string): Promise<void> {
  const startedAt = Date.now();
  log(`▶ ${label}: sync starting`);

  // Each sport is wrapped in its own try/catch so one failure doesn't skip
  // the rest of the cycle. The worker as a whole should never exit on a
  // transient ESPN error.
  const tasks: Array<[string, () => Promise<unknown>]> = [
    ["MLB standings",       () => sportsService.updateMLBStandings()],
    ["NFL standings",       () => sportsService.updateNFLStandings()],
    ["NBA standings",       () => sportsService.updateNBAStandings()],
    ["MLB games",           () => sportsApi.syncMLBGames()],
    ["NBA games",           () => sportsApi.syncNBAGames()],
    ["NFL games (current)", () => sportsApi.syncCurrentNFLGames()],
    ["NFL games (next wk)", () => sportsApi.syncNextWeekNFLGames()],
    ["ESPN team standings", () => sportsApi.syncTeamStandingsFromESPN()],
  ];

  if (isWorldCupTournamentWindow(new Date())) {
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
  log(`■ ${label}: sync complete in ${(elapsedMs / 1000).toFixed(1)}s`);
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
    const intervalMs = isQuietHours(now) ? QUIET_INTERVAL_MS : ACTIVE_INTERVAL_MS;
    try {
      await runOneCycle(isQuietHours(now) ? "quiet-hours" : "active");
    } catch (err) {
      // Defensive: runOneCycle already swallows per-task errors, but if the
      // wrapper itself ever throws we still want to keep ticking.
      log("unexpected cycle error:", err);
    }
    setTimeout(tick, intervalMs);
  };

  setTimeout(tick, ACTIVE_INTERVAL_MS);
  log(`live loop scheduled (active=${ACTIVE_INTERVAL_MS / 1000}s, quiet=${QUIET_INTERVAL_MS / 1000}s)`);
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
