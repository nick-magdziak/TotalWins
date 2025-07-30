import { storage } from "../storage";
import { type Game, type InsertGame } from "@shared/schema";

export class SportsApiService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.SPORTS_API_KEY || process.env.ESPN_API_KEY || "demo_key";
  }

  async fetchMLBGames(): Promise<Game[]> {
    try {
      // Fetch current MLB games from ESPN API
      const response = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseESPNMLBGames(data);
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
        const game: Game = {
          id: event.id,
          sport: "MLB",
          season: event.season?.year?.toString() || "2024",
          homeTeamId: this.mapESPNTeamToMLBId(event.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team),
          awayTeamId: this.mapESPNTeamToMLBId(event.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team),
          homeScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.score || null,
          awayScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.score || null,
          status: this.mapESPNStatus(event.status.type.name),
          gameDate: new Date(event.date),
          completedAt: event.status.type.name === 'STATUS_FINAL' ? new Date(event.date) : null,
          week: null
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
      'WAS': 'WAS-MLB'
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
        
        const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = competitors.find((c: any) => c.homeAway === 'away');
        
        const game: Game = {
          id: event.id,
          sport: "NFL",
          week,
          season,
          homeTeamId: this.mapESPNTeamToId(homeTeam.team.abbreviation),
          awayTeamId: this.mapESPNTeamToId(awayTeam.team.abbreviation),
          homeScore: parseInt(homeTeam.score) || null,
          awayScore: parseInt(awayTeam.score) || null,
          status: this.mapESPNStatus(competition.status.type.name),
          gameDate: new Date(event.date),
          completedAt: competition.status.type.completed ? new Date() : null,
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
}

export const sportsApi = new SportsApiService();
