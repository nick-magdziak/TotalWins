import { storage } from "../storage";
import { type Game } from "@shared/schema";

export class WorldCupDataService {
  private readonly ESPN_WC_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
  private readonly SEASON = "2026";

  async syncWorldCupGames(): Promise<void> {
    try {
      console.log("⚽ Syncing World Cup games from ESPN API...");

      // Fetch yesterday + today + next 3 days so:
      //  - yesterday: restores completed scores after server restart
      //  - today: live updates for in-progress games
      //  - +1/+2/+3 days: matches the 3-day Upcoming Matches window so all
      //    visible fixtures have ESPN-corrected kickoff times
      const [yesterdayGames, todayGames, plus1Games, plus2Games, plus3Games] = await Promise.all([
        this.fetchWorldCupGamesForDate(this.offsetDateStr(-1)),
        this.fetchWorldCupGamesForDate(this.offsetDateStr(0)),
        this.fetchWorldCupGamesForDate(this.offsetDateStr(1)),
        this.fetchWorldCupGamesForDate(this.offsetDateStr(2)),
        this.fetchWorldCupGamesForDate(this.offsetDateStr(3)),
      ]);

      // Merge, deduplicate by ESPN event id (id = "wc-<espnId>")
      const seenIds = new Set<string>();
      const games: Game[] = [];
      for (const g of [...yesterdayGames, ...todayGames, ...plus1Games, ...plus2Games, ...plus3Games]) {
        if (!seenIds.has(g.id)) {
          seenIds.add(g.id);
          games.push(g);
        }
      }

      // Fetch all WC games once (seeded + previously synced)
      const allExisting = await storage.getGames(undefined, this.SEASON);
      const wcExisting = allExisting.filter((g) => g.sport === "WORLD_CUP");

      for (const game of games) {
        // Match by unordered team pair + round + date proximity (±3 days) to avoid
        // cross-matchday contamination (e.g. MEX vs RSA on June 11 matching the
        // seeded MEX vs RSA fixture on June 17).
        // Try both home/away orderings because ESPN neutral-site orientation may differ.
        const teamA = game.homeTeamId;
        const teamB = game.awayTeamId;
        const gameDate = new Date(game.gameDate).getTime();
        const existing = wcExisting.find((g) => {
          const sameRound = g.wcRound === game.wcRound;
          const sameTeams =
            (g.homeTeamId === teamA && g.awayTeamId === teamB) ||
            (g.homeTeamId === teamB && g.awayTeamId === teamA);
          // Require dates within ±3 days to prevent matching different matchday's games
          const daysDiff = Math.abs(new Date(g.gameDate).getTime() - gameDate) / 86_400_000;
          return sameRound && sameTeams && daysDiff <= 3;
        });

        if (existing) {
          // ESPN neutral-site games may have home/away orientation flipped vs. our
          // seeded fixture. Detect the swap and align scores to our fixture's orientation
          // so that win/loss calculations always use the correct team's score.
          const espnFlipped = existing.homeTeamId !== game.homeTeamId;
          // Update the seeded record in-place; preserve its stable ID and group.
          // Only stamp completedAt on the first transition to completed so the
          // 5-minute post-delay countdown isn't reset on every sync cycle.
          const completedAt = existing.completedAt
            ? existing.completedAt
            : game.completedAt;
          await storage.updateGame(existing.id, {
            homeScore: espnFlipped ? game.awayScore : game.homeScore,
            awayScore: espnFlipped ? game.homeScore : game.awayScore,
            status: game.status,
            completedAt,
            period: game.period,
            gameDate: game.gameDate, // update to exact ESPN kickoff time
          });
        } else {
          // No matching seeded fixture — only add as new record if it has full group info
          // (group stage games without a wcGroup are likely ESPN schedule previews that
          // don't correspond to a real already-seeded fixture, so skip to avoid duplicates).
          if (game.wcRound === "group_stage" && !game.wcGroup) {
            continue; // skip — incomplete group info, likely a duplicate of a seeded fixture
          }
          await storage.addGame(game);
        }
      }

      console.log(`⚽ Synced ${games.length} World Cup games (yesterday + today + next 3 days)`);

      if (games.some((g) => g.status === "completed" || g.status === "in_progress")) {
        await storage.calculateWorldCupPlayerPoints();
      }
    } catch (error) {
      console.error("Error syncing World Cup games:", error);
    }
  }

  /**
   * Fetch WC games for a specific calendar date (YYYYMMDD) — used for backfill
   * so completed games aren't lost when the server restarts and re-seeds fixtures.
   */
  async syncWorldCupGamesForDate(dateStr: string): Promise<void> {
    try {
      const url = `${this.ESPN_WC_URL}?dates=${dateStr}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const data = await response.json();
      const games = this.parseESPNWorldCupGames(data);
      if (games.length === 0) return;

      const allExisting = await storage.getGames(undefined, this.SEASON);
      const wcExisting = allExisting.filter((g) => g.sport === "WORLD_CUP");

      let updatedCount = 0;
      for (const game of games) {
        const teamA = game.homeTeamId;
        const teamB = game.awayTeamId;
        const gameDate = new Date(game.gameDate).getTime();
        const existing = wcExisting.find((g) => {
          const sameRound = g.wcRound === game.wcRound;
          const sameTeams =
            (g.homeTeamId === teamA && g.awayTeamId === teamB) ||
            (g.homeTeamId === teamB && g.awayTeamId === teamA);
          const daysDiff = Math.abs(new Date(g.gameDate).getTime() - gameDate) / 86_400_000;
          return sameRound && sameTeams && daysDiff <= 3;
        });

        console.log(
          `⚽ [backfill ${dateStr}] ${teamA} vs ${teamB} → ESPN status: ${game.status}` +
          ` score: ${game.homeScore ?? "?"}–${game.awayScore ?? "?"}` +
          ` | match: ${existing ? existing.id : "NONE"}`
        );

        if (existing) {
          const espnFlipped = existing.homeTeamId !== game.homeTeamId;
          const completedAt = existing.completedAt
            ? existing.completedAt
            : game.completedAt;
          await storage.updateGame(existing.id, {
            homeScore: espnFlipped ? game.awayScore : game.homeScore,
            awayScore: espnFlipped ? game.homeScore : game.awayScore,
            status: game.status,
            completedAt,
            period: game.period,
            gameDate: game.gameDate,
          });
          updatedCount++;
        }
      }
      console.log(`⚽ Backfill ${dateStr}: updated ${updatedCount}/${games.length} WC game(s) in DB`);
    } catch (err) {
      console.error(`⚽ Backfill ${dateStr} failed:`, err);
    }
  }

  private async fetchWorldCupGamesForDate(dateStr: string): Promise<Game[]> {
    try {
      const url = `${this.ESPN_WC_URL}?dates=${dateStr}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        console.warn(`ESPN WC API (${dateStr}) returned ${response.status}`);
        return [];
      }
      const data = await response.json();
      return this.parseESPNWorldCupGames(data);
    } catch (error) {
      console.error(`Error fetching WC games for ${dateStr}:`, error);
      return [];
    }
  }

  private async fetchWorldCupGames(): Promise<Game[]> {
    return this.fetchWorldCupGamesForDate(this.todayDateStr());
  }

  private todayDateStr(): string {
    return this.offsetDateStr(0);
  }

  private offsetDateStr(daysOffset: number): string {
    const d = new Date(Date.now() + daysOffset * 86_400_000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
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

        // Parse soccer game clock (e.g. "32'" or "HT" or "45'+2")
        let period: string | null = null;
        if (status === "in_progress") {
          const statusDetail: string = event.status?.type?.detail || event.status?.type?.description || "";
          const displayClock: string = event.status?.displayClock || "";
          const half: number = event.status?.period ?? 0;
          if (statusDetail.toLowerCase().includes("half")) {
            period = "HT";
          } else if (displayClock) {
            period = `${displayClock}'`;
          } else if (half === 1) {
            period = "1st Half";
          } else if (half === 2) {
            period = "2nd Half";
          }
        }

        const game: Game = {
          id: `wc-${event.id}`,
          sport: "WORLD_CUP",
          season: this.SEASON,
          week: null,
          seasonType: "regular",
          homeTeamId: this.mapESPNTeamToWCId(homeComp.team),
          awayTeamId: this.mapESPNTeamToWCId(awayComp.team),
          homeScore: homeComp.score != null ? Number(homeComp.score) : null,
          awayScore: awayComp.score != null ? Number(awayComp.score) : null,
          status,
          gameDate: new Date(event.date),
          completedAt: status === "completed" ? new Date() : null,
          period,
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

  // Teams whose internal ID doesn't follow the wc-{ABBREVIATION} pattern,
  // plus any alternate ESPN abbreviations that differ from the FIFA standard.
  private readonly ABBR_TO_WC_ID: Record<string, string> = {
    // Czech Republic
    "CZE": "wc-A4",
    // Bosnia and Herzegovina
    "BIH": "wc-B4",
    "BOS": "wc-B4",
    // Turkey
    "TUR": "wc-D4",
    // DR Congo
    "COD": "wc-K4",
    "CGO": "wc-K4",
    "DRC": "wc-K4",
    // South Africa — ESPN soccer sometimes uses SAF instead of RSA
    "SAF": "wc-RSA",
    "ZAF": "wc-RSA",
    // South Korea — ESPN sometimes uses KOR or PRK variants
    "SKO": "wc-KOR",
    "KOR": "wc-KOR",
    // Sweden — ESPN uses SWE; seeded as wc-F4 (4th team in Group F)
    "SWE": "wc-F4",
    // Switzerland — SUI vs SWI
    "SWI": "wc-SUI",
    // Ivory Coast — CIV vs CIV
    "CIV": "wc-CIV",
    // Saudi Arabia — KSA vs KSA
    "KSA": "wc-KSA",
    "SAU": "wc-KSA",
    // Cape Verde — CPV vs CPV
    "CPV": "wc-CPV",
    "CVD": "wc-CPV",
    // Uzbekistan
    "UZB": "wc-UZB",
    // New Zealand — NZL vs NZL
    "NZL": "wc-NZL",
    "NZE": "wc-NZL",
    // Haiti — HAI vs HAI
    "HAI": "wc-HAI",
    "HTI": "wc-HAI",
    // Curaçao
    "CUW": "wc-CUW",
    "CUR": "wc-CUW",
  };

  private mapESPNTeamToWCId(team: any): string {
    if (!team) return "UNKNOWN";
    const abbr = (team.abbreviation || "").toUpperCase();
    const mapped = this.ABBR_TO_WC_ID[abbr] ?? `wc-${abbr}`;
    if (mapped !== `wc-${abbr}`) {
      console.log(`⚽ ESPN abbr mapping: ${abbr} → ${mapped}`);
    }
    return mapped;
  }

  private mapESPNStatus(statusName: string): "scheduled" | "in_progress" | "completed" {
    switch (statusName) {
      case "STATUS_SCHEDULED":
      case "STATUS_POSTPONED":
        return "scheduled";
      case "STATUS_IN_PROGRESS":
      case "STATUS_FIRST_HALF":
      case "STATUS_HALFTIME":
      case "STATUS_HALF_TIME":
      case "STATUS_SECOND_HALF":
      case "STATUS_EXTRA_TIME":
      case "STATUS_SHOOTOUT":
        return "in_progress";
      case "STATUS_FINAL":
      case "STATUS_FINAL_AET":
      case "STATUS_FINAL_PEN":
      case "STATUS_FULL_TIME":
      case "STATUS_FT":
      case "STATUS_END_PERIOD":
        return "completed";
      default:
        // Log unknown statuses so mismatches are visible in production logs
        if (statusName && statusName !== "STATUS_SCHEDULED" && statusName !== "STATUS_POSTPONED") {
          console.log(`⚽ Unknown ESPN status: "${statusName}" — defaulting to scheduled`);
        }
        return "scheduled";
    }
  }
}

export const worldCupDataService = new WorldCupDataService();
