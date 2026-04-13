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
      
      // ESPN's default no-date endpoint returns the last completed day, not today.
      // Always fetch by explicit ET date to get today's scheduled games correctly.
      // ET (EDT) = UTC-4 in April/May, UTC-5 in standard time.
      const etOffsetMs = 4 * 60 * 60 * 1000; // EDT = UTC-4
      const etNow = new Date(Date.now() - etOffsetMs);
      const toDateStr = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
      
      const dates = [
        new Date(etNow.getTime() - 86400000), // yesterday ET (update completed scores)
        new Date(etNow.getTime()),             // today ET
        new Date(etNow.getTime() + 86400000),  // tomorrow ET
        new Date(etNow.getTime() + 2 * 86400000), // day after ET
      ];

      for (const date of dates) {
        const dateStr = toDateStr(date);
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (response.ok) {
          const data = await response.json();
          allGames.push(...this.parseESPNMLBGames(data));
        }
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

  async fetchNBAGames(): Promise<Game[]> {
    const allGames: Game[] = [];
    try {
      const dates = [new Date(), new Date(Date.now() + 86400000), new Date(Date.now() - 86400000)];
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (!response.ok) continue;
        const data = await response.json();
        allGames.push(...this.parseESPNNBAGames(data));
      }
    } catch (error) {
      console.error('Error fetching NBA games:', error);
    }
    return allGames;
  }

  private parseESPNNBAGames(data: any): Game[] {
    const games: Game[] = [];
    if (!data.events || !Array.isArray(data.events)) return games;

    for (const event of data.events) {
      try {
        const competition = event.competitions[0];
        const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');
        const situation = competition.situation;
        const statusName = event.status?.type?.name || '';

        let period: string | null = null;
        if (this.mapESPNStatus(statusName) === 'in_progress' && situation) {
          const quarter = situation.period ?? situation.quarter;
          const clock = situation.displayClock || '';
          if (quarter) {
            const qLabel = quarter <= 4 ? `Q${quarter}` : `OT${quarter - 4}`;
            period = clock ? `${qLabel} ${clock}` : qLabel;
          }
        }

        const game: Game = {
          id: event.id,
          sport: 'NBA',
          season: event.season?.year?.toString() || '2025',
          homeTeamId: this.mapESPNTeamToNBAId(homeCompetitor?.team),
          awayTeamId: this.mapESPNTeamToNBAId(awayCompetitor?.team),
          homeScore: homeCompetitor?.score != null ? Number(homeCompetitor.score) : null,
          awayScore: awayCompetitor?.score != null ? Number(awayCompetitor.score) : null,
          status: this.mapESPNStatus(statusName),
          gameDate: new Date(event.date),
          completedAt: statusName === 'STATUS_FINAL' ? new Date(event.date) : null,
          week: null,
          period
        };
        games.push(game);
      } catch (err) {
        console.error('Error parsing NBA game:', err);
      }
    }
    return games;
  }

  private mapESPNTeamToNBAId(team: any): string {
    if (!team) return 'UNKNOWN';
    const map: { [key: string]: string } = {
      'BOS': 'BOS-NBA', 'BKN': 'BKN', 'NYK': 'NYK', 'PHI': 'PHI-NBA', 'TOR': 'TOR-NBA',
      'CHI': 'CHI-NBA', 'CLE': 'CLE-NBA', 'DET': 'DET-NBA', 'IND': 'IND-NBA', 'MIL': 'MIL-NBA',
      'ATL': 'ATL-NBA', 'CHA': 'CHA', 'MIA': 'MIA-NBA', 'ORL': 'ORL', 'WAS': 'WAS-NBA',
      'DEN': 'DEN-NBA', 'MIN': 'MIN-NBA', 'OKC': 'OKC', 'POR': 'POR', 'UTA': 'UTA',
      'GS': 'GSW', 'GSW': 'GSW', 'LAC': 'LAC-NBA', 'LAL': 'LAL', 'PHX': 'PHX', 'SAC': 'SAC',
      'DAL': 'DAL-NBA', 'HOU': 'HOU-NBA', 'MEM': 'MEM', 'NO': 'NO', 'NOP': 'NO', 'SA': 'SA', 'SAS': 'SA'
    };
    return map[team.abbreviation] || team.abbreviation;
  }

  async syncNBAGames(): Promise<void> {
    try {
      console.log('🏀 Syncing NBA games from ESPN API...');
      const games = await this.fetchNBAGames();
      for (const game of games) {
        const existingGame = await storage.getGames(undefined, game.season)
          .then(gs => gs.find(g => g.id === game.id));
        if (existingGame) {
          await storage.updateGame(game.id, game);
        } else {
          await storage.addGame(game);
        }
      }
      console.log(`🏀 Synced ${games.length} NBA games`);
    } catch (error) {
      console.error('Error syncing NBA games:', error);
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
   * Sync team win/loss records directly from ESPN's team API.
   * This is more reliable than computing from our games table (which is partial).
   */
  async syncTeamStandingsFromESPN(): Promise<{ updated: number; errors: number }> {
    const toESPNAbbr = (id: string) => id.replace(/-MLB$/, '').replace(/-NBA$/, '');
    const endpoints: { sport: 'NFL' | 'MLB' | 'NBA'; path: string }[] = [
      { sport: 'NFL', path: 'football/nfl' },
      { sport: 'MLB', path: 'baseball/mlb' },
      { sport: 'NBA', path: 'basketball/nba' },
    ];

    let updated = 0;
    let errors = 0;

    for (const { sport, path } of endpoints) {
      let teamIds: string[] = [];
      if (sport === 'NFL') {
        const rows = await storage.getAllNFLTeams();
        teamIds = rows.map(t => t.id);
      } else if (sport === 'MLB') {
        const rows = await storage.getAllMLBTeams();
        teamIds = rows.map(t => t.id);
      } else {
        const rows = await storage.getAllNBATeams();
        teamIds = rows.map(t => t.id);
      }

      const results = await Promise.allSettled(
        teamIds.map(async (teamId) => {
          const espnAbbr = toESPNAbbr(teamId);
          const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${espnAbbr}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          // items[0] is the "total" (overall) season record
          const stats: Array<{ name: string; value: number }> =
            data.team?.record?.items?.find((i: any) => i.type === 'total')?.stats
            ?? data.team?.record?.items?.[0]?.stats
            ?? [];
          const wins = Math.round(stats.find(s => s.name === 'wins')?.value ?? 0);
          const losses = Math.round(stats.find(s => s.name === 'losses')?.value ?? 0);
          const ties = Math.round(stats.find(s => s.name === 'ties')?.value ?? 0);
          // Use sport-specific update methods so team IDs that exist in multiple
          // tables (e.g. "NO" = Saints AND Pelicans) don't cross-contaminate.
          if (sport === 'NFL') {
            await storage.updateTeamRecord(teamId, wins, losses, ties);
          } else if (sport === 'MLB') {
            await storage.updateMLBTeamRecord(teamId, wins, losses);
          } else {
            await storage.updateNBATeamRecord(teamId, wins, losses);
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') updated++;
        else errors++;
      }
    }

    console.log(`✅ Team standings synced: ${updated} updated, ${errors} errors`);
    return { updated, errors };
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
