import { storage } from "../storage";
import { type Game } from "@shared/schema";

export class WorldCupDataService {
  private readonly ESPN_WC_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
  private readonly SEASON = "2026";

  async syncWorldCupGames(): Promise<void> {
    try {
      console.log("⚽ Syncing World Cup games from ESPN API...");
      const games = await this.fetchWorldCupGames();

      // Fetch all WC games once (seeded + previously synced)
      const allExisting = await storage.getGames(undefined, this.SEASON);
      const wcExisting = allExisting.filter((g) => g.sport === "WORLD_CUP");

      for (const game of games) {
        // Match by unordered team pair + round to avoid ID mismatch with pre-seeded
        // fixtures (seeded IDs: wc-gs-A-md1-1, ESPN IDs: wc-{eventId}).
        // Try both home/away orderings because ESPN neutral-site orientation may differ.
        const teamA = game.homeTeamId;
        const teamB = game.awayTeamId;
        const existing = wcExisting.find(
          (g) =>
            g.wcRound === game.wcRound &&
            ((g.homeTeamId === teamA && g.awayTeamId === teamB) ||
              (g.homeTeamId === teamB && g.awayTeamId === teamA))
        );

        if (existing) {
          // Update the seeded record in-place; preserve its stable ID
          await storage.updateGame(existing.id, {
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            status: game.status,
            completedAt: game.completedAt,
            period: game.period,
            gameDate: game.gameDate, // update to exact ESPN kickoff time
          });
        } else {
          // No matching seeded fixture — add as new record (e.g. knockout games)
          await storage.addGame(game);
        }
      }

      console.log(`⚽ Synced ${games.length} World Cup games`);

      if (games.some((g) => g.status === "completed")) {
        await storage.calculateWorldCupPlayerPoints();
      }
    } catch (error) {
      console.error("Error syncing World Cup games:", error);
    }
  }

  private async fetchWorldCupGames(): Promise<Game[]> {
    try {
      const response = await fetch(this.ESPN_WC_URL, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        console.warn(`ESPN WC API returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      return this.parseESPNWorldCupGames(data);
    } catch (error) {
      console.error("Error fetching World Cup games from ESPN:", error);
      return [];
    }
  }

  private parseESPNWorldCupGames(data: any): Game[] {
    const games: Game[] = [];
    if (!data.events || !Array.isArray(data.events)) return games;

    for (const event of data.events) {
      try {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeComp = competition.competitors?.find((c: any) => c.homeAway === "home");
        const awayComp = competition.competitors?.find((c: any) => c.homeAway === "away");
        if (!homeComp || !awayComp) continue;

        const statusName: string = event.status?.type?.name || "";
        const status = this.mapESPNStatus(statusName);

        let wcRound: string = "group_stage";
        let wcGroup: string | null = null;

        const notes = competition.notes || [];
        for (const note of notes) {
          const headline: string = (note.headline || "").toLowerCase();
          if (headline.includes("round of 32")) wcRound = "round_of_32";
          else if (headline.includes("round of 16")) wcRound = "round_of_16";
          else if (headline.includes("quarter")) wcRound = "quarterfinal";
          else if (headline.includes("semi")) wcRound = "semifinal";
          else if (headline.includes("third") || headline.includes("3rd")) wcRound = "third_place";
          else if (headline.includes("final")) wcRound = "final";
          else {
            const groupMatch = headline.match(/group ([a-l])/i);
            if (groupMatch) {
              wcRound = "group_stage";
              wcGroup = groupMatch[1].toUpperCase();
            }
          }
        }

        const game: Game = {
          id: `wc-${event.id}`,
          sport: "WORLD_CUP",
          season: this.SEASON,
          week: null,
          homeTeamId: this.mapESPNTeamToWCId(homeComp.team),
          awayTeamId: this.mapESPNTeamToWCId(awayComp.team),
          homeScore: homeComp.score != null ? Number(homeComp.score) : null,
          awayScore: awayComp.score != null ? Number(awayComp.score) : null,
          status,
          gameDate: new Date(event.date),
          completedAt: status === "completed" ? new Date(event.date) : null,
          period: null,
          wcRound,
          wcGroup,
        };

        games.push(game);
      } catch (err) {
        console.error("Error parsing WC game:", err);
      }
    }

    return games;
  }

  private mapESPNTeamToWCId(team: any): string {
    if (!team) return "UNKNOWN";
    const abbr = (team.abbreviation || "").toUpperCase();
    return `wc-${abbr}`;
  }

  private mapESPNStatus(statusName: string): "scheduled" | "in_progress" | "completed" {
    switch (statusName) {
      case "STATUS_SCHEDULED":
      case "STATUS_POSTPONED":
        return "scheduled";
      case "STATUS_IN_PROGRESS":
      case "STATUS_HALFTIME":
        return "in_progress";
      case "STATUS_FINAL":
      case "STATUS_FINAL_AET":
      case "STATUS_FINAL_PEN":
        return "completed";
      default:
        return "scheduled";
    }
  }
}

export const worldCupDataService = new WorldCupDataService();
