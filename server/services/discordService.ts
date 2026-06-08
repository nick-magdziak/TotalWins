import { storage } from "../storage";
import { generateStandingsImage } from "./discordImageService";
import { generateDraftBoardImage } from "./draftBoardImageService";
import { getDraftConfigByKey } from "../../shared/draftConfig";
import type { League } from "../../shared/schema";

function log(...args: unknown[]) {
  console.log(`[discordService ${new Date().toISOString()}]`, ...args);
}

export async function postStandingsToDiscord(league: League): Promise<void> {
  if (!league.discordWebhookUrl) return;

  // Respect the "Daily Standings" toggle (default true for backward-compat)
  if (league.discordStandingsEnabled === false) {
    log(`skipping ${league.name} — standings posting disabled`);
    return;
  }

  // Only post once the season has started
  const { startDate } = await storage.getLeagueEffectiveStartDate(league.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!startDate) {
    log(`skipping ${league.name} — no season start date resolved yet`);
    return;
  }

  const seasonStart = new Date(startDate);
  seasonStart.setHours(0, 0, 0, 0);

  if (today < seasonStart) {
    log(
      `skipping ${league.name} — season starts ${seasonStart.toISOString().slice(0, 10)}, today is ${today.toISOString().slice(0, 10)}`
    );
    return;
  }

  // Only post if at least one game was completed yesterday
  const hadGames = await storage.hadCompletedGamesYesterday(league.sport);
  if (!hadGames) {
    log(`skipping ${league.name} — no completed ${league.sport} games yesterday`);
    return;
  }

  const standings = await storage.getPlayerStandings(league.id);
  if (!standings || standings.length === 0) return;

  const imageBuffer = await generateStandingsImage(league.name, league.sport, standings);

  const form = new FormData();
  form.append("content", `**${league.name} Standings**`);
  form.append("file", new Blob([imageBuffer], { type: "image/png" }), "standings.png");

  const response = await fetch(league.discordWebhookUrl, { method: "POST", body: form });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${text}`);
  }
}

export async function postDraftBoardToDiscord(league: League, force = false): Promise<void> {
  if (!league.discordWebhookUrl) return;
  if (league.sport !== "WORLD_CUP") return;
  // When force=true (manual test/send from admin), bypass the enabled toggle and new-picks gate
  if (!force && !league.discordDraftBoardEnabled) return;

  if (!force) {
    // Only post if at least one pick has been made in the last hour
    const latestPickAt = await storage.getLatestDraftPickAt(league.id);
    if (!latestPickAt) {
      log(`skipping draft board for ${league.name} — no picks made`);
      return;
    }
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const ageMs = Date.now() - new Date(latestPickAt).getTime();
    if (ageMs > ONE_HOUR_MS) {
      log(`skipping draft board for ${league.name} — last pick was ${Math.round(ageMs / 60000)}m ago (> 1h)`);
      return;
    }
    const lastPostedAt = (league as any).lastDraftBoardPostedAt as Date | null;
    if (lastPostedAt && new Date(latestPickAt) <= new Date(lastPostedAt)) {
      log(`skipping draft board for ${league.name} — no new picks since last post`);
      return;
    }
  }

  const boardData = await storage.getLeagueDraftBoard(league.id);
  if (!boardData) return;

  const imageBuffer = await generateDraftBoardImage(boardData);

  const pickCount = boardData.picks.length;
  const draftCfg = boardData.league.draftConfiguration ? getDraftConfigByKey(boardData.league.draftConfiguration) : null;
  const total = draftCfg
    ? draftCfg.players * draftCfg.teams
    : Math.max(pickCount, boardData.members.length * (boardData.league.teamsPerPlayer ?? 6));

  const form = new FormData();
  form.append("content", `**${league.name} — Draft Board** · ${pickCount}/${total} picks made`);
  form.append("file", new Blob([imageBuffer], { type: "image/png" }), "draft-board.png");

  const response = await fetch(league.discordWebhookUrl, { method: "POST", body: form });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord draft board webhook failed: ${response.status} ${text}`);
  }

  await storage.updateLeagueLastDraftBoardPost(league.id);
  log(`draft board posted for ${league.name} (${pickCount}/${total} picks made)`);
}

export async function postPickAlertToDiscord(
  league: League,
  pickerName: string,
  teamName: string,
  pickNumber: number,
  nextPlayerName: string | null
): Promise<void> {
  if (!league.discordWebhookUrl) return;
  if (!league.discordPickAlertEnabled) return;

  const nextLine = nextPlayerName
    ? `**${nextPlayerName}** is up with the next pick!`
    : "The draft is complete!";

  const content = `**${pickerName}** picks **${teamName}** at Pick #${pickNumber}. ${nextLine}`;

  const response = await fetch(league.discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord pick alert failed: ${response.status} ${text}`);
  }
  log(`pick alert posted for ${league.name}: ${content}`);
}

export async function postDailyStandings(): Promise<void> {
  const allLeagues = await storage.getLeaguesWithDiscordWebhook();
  const results = await Promise.allSettled(
    allLeagues.map((league: League) => postStandingsToDiscord(league))
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[discordService] standings post failed:", r.reason);
    }
  }
}

export async function postHourlyDraftBoards(): Promise<void> {
  const wcLeagues = await storage.getLeaguesWithDraftBoardEnabled();
  const results = await Promise.allSettled(
    wcLeagues.map((league: League) => postDraftBoardToDiscord(league))
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[discordService] draft board post failed:", r.reason);
    }
  }
}
