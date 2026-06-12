import { storage } from "../storage";
import { SportsDataService } from "../sportsDataService";
import { sportsApi } from "./sportsApi";
import { worldCupDataService } from "./worldCupService";

const sportsService = new SportsDataService(storage);

const ACTIVE_INTERVAL_MS = 2 * 60 * 1000;
const IDLE_INTERVAL_MS   = 15 * 60 * 1000;
const QUIET_INTERVAL_MS  = 60 * 60 * 1000;

type Sport = "MLB" | "NBA" | "NFL";

function log(...args: unknown[]) {
  const ts = new Date().toISOString();
  console.log(`[liveScoreSync ${ts}]`, ...args);
}

function isWorldCupTournamentWindow(now: Date): boolean {
  return now.getFullYear() === 2026 && now.getMonth() + 1 >= 6 && now.getMonth() + 1 <= 7;
}

function isQuietHours(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 2 && hour < 6;
}

function inCalendarSeasonWindow(sport: Sport, now: Date): boolean {
  const m = now.getMonth();
  if (sport === "MLB") return m >= 2 && m <= 8;
  if (sport === "NBA") return m >= 9 || m <= 3;
  if (sport === "NFL") return m >= 8 || m === 0;
  return true;
}

async function isInSeason(sport: Sport, now: Date): Promise<boolean> {
  if (inCalendarSeasonWindow(sport, now)) return true;
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

  const [mlbInSeason, nbaInSeason, nflInSeason] = await Promise.all([
    isInSeason("MLB", now),
    isInSeason("NBA", now),
    isInSeason("NFL", now),
  ]);

  const mlbOn = mlbInSeason && (sportsToSync?.MLB ?? true);
  const nbaOn = nbaInSeason && (sportsToSync?.NBA ?? true);
  const nflOn = nflInSeason && (sportsToSync?.NFL ?? true);

  if (!mlbInSeason) log("  ⊘ skipping MLB: off-season");
  else if (!mlbOn)  log("  ⊘ skipping MLB: idle cadence (no live game)");
  if (!nbaInSeason) log("  ⊘ skipping NBA: off-season");
  else if (!nbaOn)  log("  ⊘ skipping NBA: idle cadence (no live game)");
  if (!nflInSeason) log("  ⊘ skipping NFL: off-season");
  else if (!nflOn)  log("  ⊘ skipping NFL: idle cadence (no live game)");

  const tasks: Array<[string, () => Promise<unknown>]> = [];

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

async function run(): Promise<void> {
  log("live score sync starting");

  await runOneCycle("startup");

  try {
    log("▶ startup backfill: 30-day MLB/NBA games window");
    await sportsApi.syncMLBGames(30, 2);
    await sportsApi.syncNBAGames(30, 1);
    log("■ startup backfill: complete");
  } catch (err) {
    log("startup backfill failed:", err instanceof Error ? err.message : err);
  }

  if (process.env.BACKFILL_HISTORICAL_GAMES === "true") {
    (async () => {
      try {
        const { runHistoricalGamesBackfill } = await import("./historicalBackfill");
        log("historical backfill: starting");
        await runHistoricalGamesBackfill();
        log("historical backfill: complete");
      } catch (err) {
        log("historical backfill failed:", err);
      }
    })();
  }

  let mlbDueAt = Date.now();
  let nbaDueAt = Date.now();
  let nflDueAt = Date.now();

  const tick = async () => {
    const now = new Date();

    let intervalMs: number;
    let label: string;
    let sportsToSync: { MLB: boolean; NBA: boolean; NFL: boolean } | undefined;

    // During the World Cup window, check if a WC game is currently in progress.
    // If so, bypass quiet hours so we don't miss the completion on a 1h interval.
    let wcLiveDuringQuiet = false;
    if (isQuietHours(now) && isWorldCupTournamentWindow(now)) {
      try {
        wcLiveDuringQuiet = await storage.hasGamesInProgressBySport("WORLD_CUP");
      } catch (_) { /* ignore — safe to stay in quiet mode */ }
    }

    if (isQuietHours(now) && !wcLiveDuringQuiet) {
      intervalMs = QUIET_INTERVAL_MS;
      label = "quiet-hours (1h)";
    } else {
      let mlbLive = false, nbaLive = false, nflLive = false;
      // wcLiveDuringQuiet may already be true if we bypassed quiet hours for WC
      let wcLive = wcLiveDuringQuiet;
      try {
        const wcCheck = (!wcLive && isWorldCupTournamentWindow(now))
          ? storage.hasGamesInProgressBySport("WORLD_CUP")
          : Promise.resolve(wcLive);
        [mlbLive, nbaLive, nflLive, wcLive] = await Promise.all([
          storage.hasGamesInProgressBySport("MLB"),
          storage.hasGamesInProgressBySport("NBA"),
          storage.hasGamesInProgressBySport("NFL"),
          wcCheck,
        ]);
      } catch (err) {
        log("hasGamesInProgressBySport() failed; assuming all live:", err);
        mlbLive = nbaLive = nflLive = true;
      }

      const anyLive = mlbLive || nbaLive || nflLive || wcLive;
      if (anyLive) {
        intervalMs = ACTIVE_INTERVAL_MS;
        const liveSports = [
          mlbLive ? "MLB" : null,
          nbaLive ? "NBA" : null,
          nflLive ? "NFL" : null,
          wcLive ? "WC" : null,
        ].filter(Boolean).join(",");
        const idleSports = [
          !mlbLive ? "MLB" : null,
          !nbaLive ? "NBA" : null,
          !nflLive ? "NFL" : null,
        ].filter(Boolean).join(",") || "none";
        label = `active — live: [${liveSports}] idle-this-tick: [${idleSports}] (2m)`;
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
      const advancedAt = Date.now();
      if (!sportsToSync || sportsToSync.MLB) mlbDueAt = advancedAt + IDLE_INTERVAL_MS;
      if (!sportsToSync || sportsToSync.NBA) nbaDueAt = advancedAt + IDLE_INTERVAL_MS;
      if (!sportsToSync || sportsToSync.NFL) nflDueAt = advancedAt + IDLE_INTERVAL_MS;
    } catch (err) {
      log("unexpected cycle error:", err);
    }
    await checkAndPostDailyStandings();
    setTimeout(tick, intervalMs);
  };

  setTimeout(tick, ACTIVE_INTERVAL_MS);
  log(`live loop scheduled (active=${ACTIVE_INTERVAL_MS / 1000}s, idle=${IDLE_INTERVAL_MS / 1000}s, quiet=${QUIET_INTERVAL_MS / 1000}s)`);
}

/**
 * Start the adaptive live-score sync loop in the background.
 * Kicks off the initial sync + startup backfill and schedules the
 * self-rescheduling tick loop, then returns immediately.
 * Must NOT be called more than once per process.
 *
 * @param onFatalError  Optional callback invoked on unrecoverable async startup
 *                      failure (e.g. so a standalone worker can call process.exit(1)).
 */
export function startLiveScoreSync(onFatalError?: (err: unknown) => void): void {
  run().catch(err => {
    console.error("[liveScoreSync] fatal error in sync loop:", err);
    onFatalError?.(err);
  });
  scheduleHourlyDraftBoardPost();
}

// Tracks which leagues have already had their daily standings posted today
// (keyed by leagueId → UTC date string "YYYY-MM-DD").

// How long after the last game completes before posting standings
const DAILY_POST_DELAY_MS = 5 * 60 * 1000;

/**
 * Called after every sync cycle. For each league with a Discord webhook,
 * checks whether all of today's games are done AND at least 5 minutes have
 * passed since the last one finished — if so, posts the standings image and
 * records it so we don't post again today.
 */
async function checkAndPostDailyStandings(): Promise<void> {
  try {
    const { postStandingsToDiscord } = await import("./discordService");
    const allLeagues = await storage.getLeaguesWithDiscordWebhook();
    const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" UTC

    for (const league of allLeagues) {
      if (league.discordStandingsEnabled === false) continue;
      if (league.discordStandingsPostedOn === todayStr) continue;

      const { allDone, lastCompletedAt } = await storage.getTodayLastCompletedGameAt(league.sport);
      if (!allDone || !lastCompletedAt) continue;

      const msSince = Date.now() - lastCompletedAt.getTime();
      if (msSince < DAILY_POST_DELAY_MS) continue;

      await postStandingsToDiscord(league);
      await storage.updateLeagueDiscordStandingsPostedOn(league.id, todayStr);
      log(`daily standings posted for ${league.name} (${Math.round(msSince / 60000)}m after last game)`);
    }
  } catch (err) {
    log("checkAndPostDailyStandings error:", err);
  }
}

function scheduleHourlyDraftBoardPost(): void {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  const msUntil = nextHour.getTime() - now.getTime();

  setTimeout(async () => {
    const fireOnce = async () => {
      try {
        const { postHourlyDraftBoards } = await import("./discordService");
        await postHourlyDraftBoards();
        log("draft board hourly post fired");
      } catch (err) {
        log("draft board hourly post error:", err);
      }
    };
    await fireOnce();
    setInterval(fireOnce, 60 * 60 * 1000);
  }, msUntil);

  log(`draft board hourly post scheduled in ${Math.round(msUntil / 1000 / 60)}m`);
}
