import { storage } from "../storage";
import { generateStandingsImage } from "./discordImageService";
import type { League } from "../../shared/schema";

export async function postStandingsToDiscord(league: League): Promise<void> {
  if (!league.discordWebhookUrl) return;

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
    allLeagues.map((league: import("../../shared/schema").League) => postStandingsToDiscord(league))
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[discordService] post failed:", r.reason);
    }
  }
}
