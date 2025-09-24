import { storage } from "../storage";
import { type Game, type InsertGame } from "@shared/schema";

export class SportsApiService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.SPORTS_API_KEY || process.env.ESPN_API_KEY || "demo_key";
  }

  async fetchMLBGames(): Promise<Game[]> {
    try {
      const allGames: Game[] = [];
      
      // Fetch current day games
      const todayResponse = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (todayResponse.ok) {
        const todayData = await todayResponse.json();
        allGames.push(...this.parseESPNMLBGames(todayData));
      }

      // Fetch tomorrow's games for upcoming games
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0].replace(/-/g, '');
      
      const tomorrowResponse = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${tomorrowStr}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (tomorrowResponse.ok) {
        const tomorrowData = await tomorrowResponse.json();
        allGames.push(...this.parseESPNMLBGames(tomorrowData));
      }

      // Fetch day after tomorrow's games
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      const dayAfterStr = dayAfter.toISOString().split('T')[0].replace(/-/g, '');
      
      const dayAfterResponse = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dayAfterStr}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (dayAfterResponse.ok) {
        const dayAfterData = await dayAfterResponse.json();
        allGames.push(...this.parseESPNMLBGames(dayAfterData));
      }

      return allGames;
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      return [];
    }
  }

  private parseESPNMLBGames(data: any): Game[] {
    const games: Game[] = [];
    
    if (!data.events || !Array.isArray(data.events)) {
      console.log('No MLB games found in ESPN API response');
      return games;
    }

    for (const event of data.events) {
      try {
        // Extract period information from ESPN API
        const competition = event.competitions[0];
        const situation = competition.situation;
        let period = null;
        
        if (this.mapESPNStatus(event.status.type.name) === 'in_progress') {
          // Try to get inning from situation first
          if (situation && situation.inning !== undefined) {
            const half = situation.isTopInning ? 'Top' : 'Bottom';
            period = `${half} ${situation.inning}`;
          } 
          // If no situation data, try to parse from status detail
          else if (event.status.type.detail || event.status.type.shortDetail) {
            const detail = event.status.type.detail || event.status.type.shortDetail;
            // Parse formats like "Top 3rd", "Bottom 5th", "Mid 7th", etc.
            // Also handle ordinal formats: "3rd", "5th", "1st", etc.
            const inningMatch = detail.match(/(Top|Bottom|Mid)\s+(\d+)(?:st|nd|rd|th)?/i);
            if (inningMatch) {
              period = `${inningMatch[1]} ${inningMatch[2]}`;
            }
          }
        }

        const homeCompetitor = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
        
        const game: Game = {
          id: event.id,
          sport: "MLB",
          season: event.season?.year?.toString() || "2024",
          homeTeamId: this.mapESPNTeamToMLBId(homeCompetitor?.team),
          awayTeamId: this.mapESPNTeamToMLBId(awayCompetitor?.team),
          homeScore: homeCompetitor?.score != null ? Number(homeCompetitor.score) : null,
          awayScore: awayCompetitor?.score != null ? Number(awayCompetitor.score) : null,
          status: this.mapESPNStatus(event.status.type.name),
          gameDate: new Date(event.date),
          completedAt: event.status.type.name === 'STATUS_FINAL' ? new Date(event.date) : null,
          week: null,
          period: period
        };

        games.push(game);
      } catch (error) {
        console.error('Error parsing MLB game:', error);
      }
    }

    return games;
  }

  private mapESPNTeamToMLBId(team: any): string {
    if (!team) return 'UNKNOWN';
    
    // Map ESPN team abbreviations to our MLB team IDs
    const espnToMLBMap: { [key: string]: string } = {
      'LAD': 'LAD',
      'SF': 'SF-MLB', 
      'BOS': 'BOS-MLB',
      'NYY': 'NYY',
      'ATL': 'ATL-MLB',
      'PHI': 'PHI-MLB',
      'HOU': 'HOU-MLB',
      'TEX': 'TEX',
      'BAL': 'BAL-MLB',
      'TB': 'TB-MLB',
      'TOR': 'TOR',
      'CWS': 'CWS',
      'CHW': 'CWS', // Chicago White Sox alternate
      'CLE': 'CLE-MLB',
      'DET': 'DET-MLB',
      'KC': 'KC-MLB',
      'MIN': 'MIN-MLB',
      'CHC': 'CHC',
      'CIN': 'CIN-MLB',
      'MIL': 'MIL',
      'PIT': 'PIT-MLB',
      'STL': 'STL',
      'ARI': 'ARI-MLB',
      'COL': 'COL',
      'SD': 'SD',
      'LAA': 'LAA',
      'OAK': 'OAK',
      'SEA': 'SEA-MLB',
      'MIA': 'MIA-MLB',
      'NYM': 'NYM',
      'WAS': 'WAS-MLB',
      'WSH': 'WAS-MLB', // Washington alternate
      'ATH': 'OAK' // Athletics (Oakland)
    };

    return espnToMLBMap[team.abbreviation] || team.abbreviation;
  }

  private mapESPNStatus(statusName: string): "scheduled" | "in_progress" | "completed" {
    switch (statusName) {
      case 'STATUS_SCHEDULED':
      case 'STATUS_POSTPONED':
        return 'scheduled';
      case 'STATUS_IN_PROGRESS':
      case 'STATUS_HALFTIME':
        return 'in_progress';
      case 'STATUS_FINAL':
      case 'STATUS_FINAL_OT':
        return 'completed';
      default:
        return 'scheduled';
    }
  }

  async fetchNFLGames(week: number, season: string): Promise<Game[]> {
    try {
      // In a real implementation, this would call ESPN API or similar
      // For now, we'll simulate the API call structure
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${season}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Sports API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseESPNGames(data, week, season);
    } catch (error) {
      console.error('Error fetching NFL games:', error);
      return [];
    }
  }

  private parseESPNGames(espnData: any, week: number, season: string): Game[] {
    const games: Game[] = [];
    
    if (espnData.events) {
      for (const event of espnData.events) {
        const competition = event.competitions[0];
        const competitors = competition.competitors;
        const situation = competition.situation;
        
        const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = competitors.find((c: any) => c.homeAway === 'away');
        
        // Extract period information for NFL
        let period = null;
        if (situation && situation.quarter !== undefined && this.mapESPNStatus(competition.status.type.name) === 'in_progress') {
          // For NFL: Get quarter and time from ESPN API
          const quarterMap: { [key: number]: string } = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };
          const quarter = quarterMap[situation.quarter] || `Q${situation.quarter}`;
          const clock = situation.displayClock || situation.clock || '';
          period = clock ? `${quarter} ${clock}` : quarter;
        }

        const game: Game = {
          id: event.id,
          sport: "NFL",
          week,
          season,
          homeTeamId: this.mapESPNTeamToId(homeTeam.team.abbreviation),
          awayTeamId: this.mapESPNTeamToId(awayTeam.team.abbreviation),
          homeScore: homeTeam.score != null ? Number(homeTeam.score) : null,
          awayScore: awayTeam.score != null ? Number(awayTeam.score) : null,
          status: this.mapESPNStatus(competition.status.type.name),
          gameDate: new Date(event.date),
          completedAt: competition.status.type.completed ? new Date() : null,
          period: period
        };
        
        games.push(game);
      }
    }
    
    return games;
  }

  private mapESPNTeamToId(espnAbbr: string): string {
    // Map ESPN team abbreviations to our team IDs
    const teamMap: { [key: string]: string } = {
      'BUF': 'BUF', 'MIA': 'MIA', 'NE': 'NE', 'NYJ': 'NYJ',
      'BAL': 'BAL', 'CIN': 'CIN', 'CLE': 'CLE', 'PIT': 'PIT',
      'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 'TEN': 'TEN',
      'DEN': 'DEN', 'KC': 'KC', 'LV': 'LV', 'LAC': 'LAC',
      'DAL': 'DAL', 'NYG': 'NYG', 'PHI': 'PHI', 'WSH': 'WAS',
      'CHI': 'CHI', 'DET': 'DET', 'GB': 'GB', 'MIN': 'MIN',
      'ATL': 'ATL', 'CAR': 'CAR', 'NO': 'NO', 'TB': 'TB',
      'ARI': 'ARI', 'LAR': 'LAR', 'SF': 'SF', 'SEA': 'SEA'
    };
    
    return teamMap[espnAbbr] || espnAbbr;
  }



  async updateTeamRecords(): Promise<void> {
    try {
      const currentSeason = new Date().getFullYear().toString();
      const allGames = await storage.getGames(undefined, currentSeason);
      const completedGames = allGames.filter(game => game.status === 'completed');
      
      // Calculate wins/losses for each team
      const teamRecords: { [teamId: string]: { wins: number, losses: number, ties: number } } = {};
      
      for (const game of completedGames) {
        if (game.homeScore !== null && game.awayScore !== null) {
          const homeTeamId = game.homeTeamId!;
          const awayTeamId = game.awayTeamId!;
          
          if (!teamRecords[homeTeamId]) {
            teamRecords[homeTeamId] = { wins: 0, losses: 0, ties: 0 };
          }
          if (!teamRecords[awayTeamId]) {
            teamRecords[awayTeamId] = { wins: 0, losses: 0, ties: 0 };
          }
          
          if (game.homeScore > game.awayScore) {
            teamRecords[homeTeamId].wins++;
            teamRecords[awayTeamId].losses++;
          } else if (game.awayScore > game.homeScore) {
            teamRecords[awayTeamId].wins++;
            teamRecords[homeTeamId].losses++;
          } else {
            teamRecords[homeTeamId].ties++;
            teamRecords[awayTeamId].ties++;
          }
        }
      }
      
      // Update team records in storage
      for (const [teamId, record] of Object.entries(teamRecords)) {
        await storage.updateTeamRecord(teamId, record.wins, record.losses, record.ties);
      }
    } catch (error) {
      console.error('Error updating team records:', error);
    }
  }

  async syncGamesForWeek(week: number, season: string): Promise<void> {
    try {
      const games = await this.fetchNFLGames(week, season);
      
      for (const game of games) {
        const existingGame = await storage.getGames(week, season)
          .then(games => games.find(g => g.id === game.id));
        
        if (existingGame) {
          await storage.updateGame(game.id, game);
        } else {
          await storage.addGame(game);
        }
      }
      
      await this.updateTeamRecords();
    } catch (error) {
      console.error('Error syncing games:', error);
    }
  }

  async syncMLBGames(): Promise<void> {
    try {
      console.log('Syncing MLB games from ESPN API...');
      const games = await this.fetchMLBGames();
      
      for (const game of games) {
        const existingGame = await storage.getGames(undefined, game.season)
          .then(games => games.find(g => g.id === game.id));
        
        if (existingGame) {
          await storage.updateGame(game.id, game);
        } else {
          await storage.addGame(game);
        }
      }
      
      console.log(`Synced ${games.length} MLB games`);
    } catch (error) {
      console.error('Error syncing MLB games:', error);
    }
  }

  /**
   * Calculate current NFL week based on the date
   * NFL season typically starts first week of September
   */
  private getCurrentNFLWeek(): number {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // NFL season typically starts around Labor Day (first Monday in September)
    // For 2024-25 season, Week 1 started September 5, 2024
    // For 2025-26 season, estimate around September 4, 2025
    const seasonStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1; // Sept onwards = current year's season
    const seasonStart = new Date(seasonStartYear, 8, 4); // September 4th as estimate
    
    // Find the first Thursday of September (NFL season usually starts Thursday night)
    while (seasonStart.getDay() !== 4) { // 4 = Thursday
      seasonStart.setDate(seasonStart.getDate() + 1);
    }
    
    const diffTime = now.getTime() - seasonStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.max(1, Math.ceil(diffDays / 7));
    
    // Cap at week 18 (regular season)
    return Math.min(weekNumber, 18);
  }

  /**
   * Get the current NFL season year
   */
  private getCurrentNFLSeason(): string {
    const now = new Date();
    // NFL season spans two years (e.g., 2024-25 season)
    // If it's September or later, it's the current year's season
    // If it's January-August, it's the previous year's season
    const seasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return seasonYear.toString();
  }

  /**
   * Sync current week NFL games for live scores
   */
  async syncCurrentNFLGames(): Promise<void> {
    try {
      const currentWeek = this.getCurrentNFLWeek();
      const currentSeason = this.getCurrentNFLSeason();
      
      console.log(`🏈 Syncing NFL Week ${currentWeek} games for ${currentSeason} season...`);
      const games = await this.fetchNFLGames(currentWeek, currentSeason);
      
      for (const game of games) {
        const existingGame = await storage.getGames(currentWeek, currentSeason)
          .then(games => games.find(g => g.id === game.id));
        
        if (existingGame) {
          await storage.updateGame(game.id, game);
        } else {
          await storage.addGame(game);
        }
      }
      
      console.log(`✅ Synced ${games.length} NFL games for Week ${currentWeek}`);
    } catch (error) {
      console.error('Error syncing NFL games:', error);
    }
  }

  /**
   * Sync next week NFL games for upcoming preview
   */
  async syncNextWeekNFLGames(): Promise<void> {
    try {
      const currentWeek = this.getCurrentNFLWeek();
      const nextWeek = currentWeek + 1;
      const currentSeason = this.getCurrentNFLSeason();
      
      // Only sync if next week is within the regular season
      if (nextWeek <= 18) {
        console.log(`🏈 Syncing NFL Week ${nextWeek} games for ${currentSeason} season...`);
        const games = await this.fetchNFLGames(nextWeek, currentSeason);
        
        for (const game of games) {
          const existingGame = await storage.getGames(nextWeek, currentSeason)
            .then(games => games.find(g => g.id === game.id));
          
          if (existingGame) {
            await storage.updateGame(game.id, game);
          } else {
            await storage.addGame(game);
          }
        }
        
        console.log(`✅ Synced ${games.length} NFL games for Week ${nextWeek}`);
      }
    } catch (error) {
      console.error('Error syncing next week NFL games:', error);
    }
  }
}

export const sportsApi = new SportsApiService();
