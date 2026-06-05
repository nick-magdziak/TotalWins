import { storage } from "../storage";
import { generateStandingsImage } from "./discordImageService";
import type { League } from "../../shared/schema";

function log(...args: unknown[]) {
  console.log(`[discordService ${new Date().toISOString()}]`, ...args);
}

export async function postStandingsToDiscord(league: League): Promise<void> {
  if (!league.discordWebhookUrl) return;

  // Only post once the season has started — no spoiler-free standings before
  // the first game counts. Uses the admin-set leagueStartDate if present,
  // otherwise the earliest synced game date for the sport/season.
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

  const standings = await storage.getPlayerStandings(league.id);
  if (!standings || standings.length === 0) return;

  const imageBuffer = await generateStandingsImage(
    league.name,
    league.sport,
    standings
  );

  const form = new FormData();
  form.append("content", `**${league.name} Standings**`);
  form.append(
    "file",
    new Blob([imageBuffer], { type: "image/png" }),
    "standings.png"
  );

  const response = await fetch(league.discordWebhookUrl, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${text}`);
  }
}

export async function postDailyStandings(): Promise<void> {
  const allLeagues = await storage.getLeaguesWithDiscordWebhook();
  const results = await Promise.allSettled(
    allLeagues.map((league: League) => postStandingsToDiscord(league))
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[discordService] post failed:", r.reason);
    }
  }
}
