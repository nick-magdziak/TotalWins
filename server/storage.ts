import { eq, desc, and, sql, gte, lt } from "drizzle-orm";
import { db } from "./db";
import {
  type User,
  type InsertUser,
  type League,
  type InsertLeague,
  type LeagueMember,
  type InsertLeagueMember,
  type NFLTeam,
  type MLBTeam,
  type NBATeam,
  type DraftPick,
  type InsertDraftPick,
  type Game,
  type InsertGame,
  type PlayerStanding,
  type DraftStatus,
  users,
  leagues,
  leagueMembers,
  nflTeams,
  mlbTeams,
  nbaTeams,
  draftPicks,
  games,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserPrivileges(userId: string, isAdmin: boolean): Promise<void>;

  // Leagues
  getLeague(id: string): Promise<League | undefined>;
  createLeague(league: InsertLeague): Promise<League>;
  updateLeague(id: string, updates: Partial<League>): Promise<League | undefined>;
  getUserLeagues(userId: string): Promise<League[]>;

  // League Members
  getLeagueMembers(leagueId: string): Promise<LeagueMember[]>;
  getLeagueMember(leagueId: string, userId: string): Promise<LeagueMember | undefined>;
  addLeagueMember(member: InsertLeagueMember): Promise<LeagueMember>;
  removeLeagueMember(leagueId: string, userId: string): Promise<boolean>;
  updateLeagueMemberPreferences(leagueId: string, userId: string, preferences: { draftNotifications?: boolean; gameNotifications?: boolean; }): Promise<boolean>;
  getPlayerStandings(leagueId: string): Promise<PlayerStanding[]>;

  // NFL Teams
  getAllNFLTeams(): Promise<NFLTeam[]>;
  getNFLTeam(id: string): Promise<NFLTeam | undefined>;
  updateTeamRecord(teamId: string, wins: number, losses: number, ties: number): Promise<void>;

  // MLB Teams
  getAllMLBTeams(): Promise<MLBTeam[]>;
  updateMLBTeamRecord(teamId: string, wins: number, losses: number): Promise<void>;

  // Draft
  getDraftPicks(leagueId: string): Promise<DraftPick[]>;
  addDraftPick(pick: InsertDraftPick): Promise<DraftPick>;
  getDraftStatus(leagueId: string): Promise<DraftStatus>;
  getUserDraftPicks(leagueId: string, userId: string): Promise<DraftPick[]>;
  resetDraft(leagueId: string): Promise<void>;
  undoLastDraftPick(leagueId: string): Promise<boolean>;

  // Games
  getGames(week?: number, season?: string): Promise<Game[]>;
  updateGame(gameId: string, updates: Partial<Game>): Promise<Game | undefined>;
  addGame(game: InsertGame): Promise<Game>;
  getRecentCompletedGames(limit: number): Promise<Game[]>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeNFLTeams();
    this.initializeMLBTeams();
    this.initializeNBATeams();
    this.initializeSampleGameData();
    this.initializeDemoLeagues();
    // Sync real MLB games after initialization
    this.syncRealTimeMLBGames();
  }

  private async syncRealTimeMLBGames() {
    // Delay to allow other initializations to complete
    setTimeout(async () => {
      try {
        const { sportsApi } = await import("./services/sportsApi");
        await sportsApi.syncMLBGames();
      } catch (error) {
        console.error("Error syncing real-time MLB games:", error);
      }
    }, 2000);
  }

  private async initializeNFLTeams() {
    try {
      // Check if teams already exist
      const existingTeams = await db.select().from(nflTeams).limit(1);
      if (existingTeams.length > 0) {
        return; // Teams already initialized
      }

      const teams: NFLTeam[] = [
        // AFC East
        { id: "BUF", name: "Bills", city: "Buffalo", abbreviation: "BUF", division: "AFC East", conference: "AFC", wins: 13, losses: 4, ties: 0 },
        { id: "MIA", name: "Dolphins", city: "Miami", abbreviation: "MIA", division: "AFC East", conference: "AFC", wins: 8, losses: 9, ties: 0 },
        { id: "NE", name: "Patriots", city: "New England", abbreviation: "NE", division: "AFC East", conference: "AFC", wins: 4, losses: 13, ties: 0 },
        { id: "NYJ", name: "Jets", city: "New York", abbreviation: "NYJ", division: "AFC East", conference: "AFC", wins: 5, losses: 12, ties: 0 },
        
        // AFC North
        { id: "BAL", name: "Ravens", city: "Baltimore", abbreviation: "BAL", division: "AFC North", conference: "AFC", wins: 12, losses: 5, ties: 0 },
        { id: "CIN", name: "Bengals", city: "Cincinnati", abbreviation: "CIN", division: "AFC North", conference: "AFC", wins: 9, losses: 8, ties: 0 },
        { id: "CLE", name: "Browns", city: "Cleveland", abbreviation: "CLE", division: "AFC North", conference: "AFC", wins: 3, losses: 14, ties: 0 },
        { id: "PIT", name: "Steelers", city: "Pittsburgh", abbreviation: "PIT", division: "AFC North", conference: "AFC", wins: 10, losses: 7, ties: 0 },
        
        // AFC South
        { id: "HOU", name: "Texans", city: "Houston", abbreviation: "HOU", division: "AFC South", conference: "AFC", wins: 10, losses: 7, ties: 0 },
        { id: "IND", name: "Colts", city: "Indianapolis", abbreviation: "IND", division: "AFC South", conference: "AFC", wins: 8, losses: 9, ties: 0 },
        { id: "JAX", name: "Jaguars", city: "Jacksonville", abbreviation: "JAX", division: "AFC South", conference: "AFC", wins: 4, losses: 13, ties: 0 },
        { id: "TEN", name: "Titans", city: "Tennessee", abbreviation: "TEN", division: "AFC South", conference: "AFC", wins: 3, losses: 14, ties: 0 },
        
        // AFC West
        { id: "DEN", name: "Broncos", city: "Denver", abbreviation: "DEN", division: "AFC West", conference: "AFC", wins: 10, losses: 7, ties: 0 },
        { id: "KC", name: "Chiefs", city: "Kansas City", abbreviation: "KC", division: "AFC West", conference: "AFC", wins: 15, losses: 2, ties: 0 },
        { id: "LV", name: "Raiders", city: "Las Vegas", abbreviation: "LV", division: "AFC West", conference: "AFC", wins: 4, losses: 13, ties: 0 },
        { id: "LAC", name: "Chargers", city: "Los Angeles", abbreviation: "LAC", division: "AFC West", conference: "AFC", wins: 11, losses: 6, ties: 0 },
        
        // NFC East
        { id: "DAL", name: "Cowboys", city: "Dallas", abbreviation: "DAL", division: "NFC East", conference: "NFC", wins: 7, losses: 10, ties: 0 },
        { id: "NYG", name: "Giants", city: "New York", abbreviation: "NYG", division: "NFC East", conference: "NFC", wins: 3, losses: 14, ties: 0 },
        { id: "PHI", name: "Eagles", city: "Philadelphia", abbreviation: "PHI", division: "NFC East", conference: "NFC", wins: 14, losses: 3, ties: 0 },
        { id: "WAS", name: "Commanders", city: "Washington", abbreviation: "WAS", division: "NFC East", conference: "NFC", wins: 12, losses: 5, ties: 0 },
        
        // NFC North
        { id: "CHI", name: "Bears", city: "Chicago", abbreviation: "CHI", division: "NFC North", conference: "NFC", wins: 5, losses: 12, ties: 0 },
        { id: "DET", name: "Lions", city: "Detroit", abbreviation: "DET", division: "NFC North", conference: "NFC", wins: 15, losses: 2, ties: 0 },
        { id: "GB", name: "Packers", city: "Green Bay", abbreviation: "GB", division: "NFC North", conference: "NFC", wins: 11, losses: 6, ties: 0 },
        { id: "MIN", name: "Vikings", city: "Minnesota", abbreviation: "MIN", division: "NFC North", conference: "NFC", wins: 14, losses: 3, ties: 0 },
        
        // NFC South
        { id: "ATL", name: "Falcons", city: "Atlanta", abbreviation: "ATL", division: "NFC South", conference: "NFC", wins: 8, losses: 9, ties: 0 },
        { id: "CAR", name: "Panthers", city: "Carolina", abbreviation: "CAR", division: "NFC South", conference: "NFC", wins: 5, losses: 12, ties: 0 },
        { id: "NO", name: "Saints", city: "New Orleans", abbreviation: "NO", division: "NFC South", conference: "NFC", wins: 5, losses: 12, ties: 0 },
        { id: "TB", name: "Buccaneers", city: "Tampa Bay", abbreviation: "TB", division: "NFC South", conference: "NFC", wins: 10, losses: 7, ties: 0 },
        
        // NFC West
        { id: "ARI", name: "Cardinals", city: "Arizona", abbreviation: "ARI", division: "NFC West", conference: "NFC", wins: 8, losses: 9, ties: 0 },
        { id: "LAR", name: "Rams", city: "Los Angeles", abbreviation: "LAR", division: "NFC West", conference: "NFC", wins: 10, losses: 7, ties: 0 },
        { id: "SF", name: "49ers", city: "San Francisco", abbreviation: "SF", division: "NFC West", conference: "NFC", wins: 6, losses: 11, ties: 0 },
        { id: "SEA", name: "Seahawks", city: "Seattle", abbreviation: "SEA", division: "NFC West", conference: "NFC", wins: 10, losses: 7, ties: 0 },
      ];

      await db.insert(nflTeams).values(teams);
    } catch (error) {
      console.log("NFL teams may already be initialized:", error);
    }
  }

  private async initializeMLBTeams() {
    try {
      const existingTeams = await db.select().from(mlbTeams).limit(1);
      if (existingTeams.length > 0) return; // Teams already initialized

      const mlbTeamsData = [
        // American League East
        { id: "BAL-MLB", city: "Baltimore", name: "Orioles", abbreviation: "BAL", division: "AL East", league: "American League", wins: 91, losses: 71 },
        { id: "BOS", city: "Boston", name: "Red Sox", abbreviation: "BOS", division: "AL East", league: "American League", wins: 81, losses: 81 },
        { id: "NYY", city: "New York", name: "Yankees", abbreviation: "NYY", division: "AL East", league: "American League", wins: 94, losses: 68 },
        { id: "TB-MLB", city: "Tampa Bay", name: "Rays", abbreviation: "TB", division: "AL East", league: "American League", wins: 80, losses: 82 },
        { id: "TOR", city: "Toronto", name: "Blue Jays", abbreviation: "TOR", division: "AL East", league: "American League", wins: 64, losses: 88 },

        // American League Central
        { id: "CWS", city: "Chicago", name: "White Sox", abbreviation: "CWS", division: "AL Central", league: "American League", wins: 41, losses: 121 },
        { id: "CLE-MLB", city: "Cleveland", name: "Guardians", abbreviation: "CLE", division: "AL Central", league: "American League", wins: 92, losses: 69 },
        { id: "DET-MLB", city: "Detroit", name: "Tigers", abbreviation: "DET", division: "AL Central", league: "American League", wins: 86, losses: 76 },
        { id: "KC-MLB", city: "Kansas City", name: "Royals", abbreviation: "KC", division: "AL Central", league: "American League", wins: 86, losses: 76 },
        { id: "MIN-MLB", city: "Minnesota", name: "Twins", abbreviation: "MIN", division: "AL Central", league: "American League", wins: 82, losses: 80 },

        // American League West
        { id: "HOU-MLB", city: "Houston", name: "Astros", abbreviation: "HOU", division: "AL West", league: "American League", wins: 88, losses: 73 },
        { id: "LAA", city: "Los Angeles", name: "Angels", abbreviation: "LAA", division: "AL West", league: "American League", wins: 63, losses: 99 },
        { id: "OAK", city: "Oakland", name: "Athletics", abbreviation: "OAK", division: "AL West", league: "American League", wins: 69, losses: 93 },
        { id: "SEA-MLB", city: "Seattle", name: "Mariners", abbreviation: "SEA", division: "AL West", league: "American League", wins: 85, losses: 77 },
        { id: "TEX", city: "Texas", name: "Rangers", abbreviation: "TEX", division: "AL West", league: "American League", wins: 78, losses: 84 },

        // National League East
        { id: "ATL-MLB", city: "Atlanta", name: "Braves", abbreviation: "ATL", division: "NL East", league: "National League", wins: 89, losses: 73 },
        { id: "MIA-MLB", city: "Miami", name: "Marlins", abbreviation: "MIA", division: "NL East", league: "National League", wins: 62, losses: 100 },
        { id: "NYM", city: "New York", name: "Mets", abbreviation: "NYM", division: "NL East", league: "National League", wins: 89, losses: 73 },
        { id: "PHI-MLB", city: "Philadelphia", name: "Phillies", abbreviation: "PHI", division: "NL East", league: "National League", wins: 95, losses: 67 },
        { id: "WSH", city: "Washington", name: "Nationals", abbreviation: "WSH", division: "NL East", league: "National League", wins: 71, losses: 91 },

        // National League Central
        { id: "CHC", city: "Chicago", name: "Cubs", abbreviation: "CHC", division: "NL Central", league: "National League", wins: 83, losses: 79 },
        { id: "CIN-MLB", city: "Cincinnati", name: "Reds", abbreviation: "CIN", division: "NL Central", league: "National League", wins: 77, losses: 85 },
        { id: "MIL", city: "Milwaukee", name: "Brewers", abbreviation: "MIL", division: "NL Central", league: "National League", wins: 93, losses: 69 },
        { id: "PIT-MLB", city: "Pittsburgh", name: "Pirates", abbreviation: "PIT", division: "NL Central", league: "National League", wins: 76, losses: 86 },
        { id: "STL", city: "St. Louis", name: "Cardinals", abbreviation: "STL", division: "NL Central", league: "National League", wins: 83, losses: 79 },

        // National League West
        { id: "ARI-MLB", city: "Arizona", name: "Diamondbacks", abbreviation: "ARI", division: "NL West", league: "National League", wins: 89, losses: 73 },
        { id: "COL", city: "Colorado", name: "Rockies", abbreviation: "COL", division: "NL West", league: "National League", wins: 61, losses: 101 },
        { id: "LAD", city: "Los Angeles", name: "Dodgers", abbreviation: "LAD", division: "NL West", league: "National League", wins: 98, losses: 64 },
        { id: "SD", city: "San Diego", name: "Padres", abbreviation: "SD", division: "NL West", league: "National League", wins: 93, losses: 69 },
        { id: "SF-MLB", city: "San Francisco", name: "Giants", abbreviation: "SF", division: "NL West", league: "National League", wins: 80, losses: 82 },
      ];

      await db.insert(mlbTeams).values(mlbTeamsData);
      console.log("MLB teams initialized");
    } catch (error) {
      console.error("Error initializing MLB teams:", error);
    }
  }

  private async initializeNBATeams() {
    try {
      const existingTeams = await db.select().from(nbaTeams).limit(1);
      if (existingTeams.length > 0) return; // Teams already initialized

      const nbaTeamsData = [
        // Eastern Conference - Atlantic Division
        { id: "BOS-NBA", city: "Boston", name: "Celtics", abbreviation: "BOS", division: "Atlantic", conference: "Eastern", wins: 64, losses: 18 },
        { id: "BKN", city: "Brooklyn", name: "Nets", abbreviation: "BKN", division: "Atlantic", conference: "Eastern", wins: 32, losses: 50 },
        { id: "NYK", city: "New York", name: "Knicks", abbreviation: "NYK", division: "Atlantic", conference: "Eastern", wins: 50, losses: 32 },
        { id: "PHI-NBA", city: "Philadelphia", name: "76ers", abbreviation: "PHI", division: "Atlantic", conference: "Eastern", wins: 47, losses: 35 },
        { id: "TOR-NBA", city: "Toronto", name: "Raptors", abbreviation: "TOR", division: "Atlantic", conference: "Eastern", wins: 25, losses: 57 },

        // Eastern Conference - Central Division
        { id: "CHI-NBA", city: "Chicago", name: "Bulls", abbreviation: "CHI", division: "Central", conference: "Eastern", wins: 39, losses: 43 },
        { id: "CLE-NBA", city: "Cleveland", name: "Cavaliers", abbreviation: "CLE", division: "Central", conference: "Eastern", wins: 48, losses: 34 },
        { id: "DET-NBA", city: "Detroit", name: "Pistons", abbreviation: "DET", division: "Central", conference: "Eastern", wins: 14, losses: 68 },
        { id: "IND-NBA", city: "Indiana", name: "Pacers", abbreviation: "IND", division: "Central", conference: "Eastern", wins: 47, losses: 35 },
        { id: "MIL-NBA", city: "Milwaukee", name: "Bucks", abbreviation: "MIL", division: "Central", conference: "Eastern", wins: 49, losses: 33 },

        // Eastern Conference - Southeast Division
        { id: "ATL-NBA", city: "Atlanta", name: "Hawks", abbreviation: "ATL", division: "Southeast", conference: "Eastern", wins: 36, losses: 46 },
        { id: "CHA", city: "Charlotte", name: "Hornets", abbreviation: "CHA", division: "Southeast", conference: "Eastern", wins: 21, losses: 61 },
        { id: "MIA-NBA", city: "Miami", name: "Heat", abbreviation: "MIA", division: "Southeast", conference: "Eastern", wins: 46, losses: 36 },
        { id: "ORL", city: "Orlando", name: "Magic", abbreviation: "ORL", division: "Southeast", conference: "Eastern", wins: 47, losses: 35 },
        { id: "WAS-NBA", city: "Washington", name: "Wizards", abbreviation: "WAS", division: "Southeast", conference: "Eastern", wins: 15, losses: 67 },

        // Western Conference - Northwest Division
        { id: "DEN-NBA", city: "Denver", name: "Nuggets", abbreviation: "DEN", division: "Northwest", conference: "Western", sport: "NBA", wins: 57, losses: 25, ties: 0 },
        { id: "MIN-NBA", city: "Minnesota", name: "Timberwolves", abbreviation: "MIN", division: "Northwest", conference: "Western", sport: "NBA", wins: 56, losses: 26, ties: 0 },
        { id: "OKC", city: "Oklahoma City", name: "Thunder", abbreviation: "OKC", division: "Northwest", conference: "Western", sport: "NBA", wins: 57, losses: 25, ties: 0 },
        { id: "POR", city: "Portland", name: "Trail Blazers", abbreviation: "POR", division: "Northwest", conference: "Western", sport: "NBA", wins: 21, losses: 61, ties: 0 },
        { id: "UTA", city: "Utah", name: "Jazz", abbreviation: "UTA", division: "Northwest", conference: "Western", sport: "NBA", wins: 31, losses: 51, ties: 0 },

        // Western Conference - Pacific Division
        { id: "GSW", city: "Golden State", name: "Warriors", abbreviation: "GSW", division: "Pacific", conference: "Western", sport: "NBA", wins: 46, losses: 36, ties: 0 },
        { id: "LAC-NBA", city: "Los Angeles", name: "Clippers", abbreviation: "LAC", division: "Pacific", conference: "Western", sport: "NBA", wins: 51, losses: 31, ties: 0 },
        { id: "LAL", city: "Los Angeles", name: "Lakers", abbreviation: "LAL", division: "Pacific", conference: "Western", sport: "NBA", wins: 47, losses: 35, ties: 0 },
        { id: "PHX", city: "Phoenix", name: "Suns", abbreviation: "PHX", division: "Pacific", conference: "Western", sport: "NBA", wins: 49, losses: 33, ties: 0 },
        { id: "SAC", city: "Sacramento", name: "Kings", abbreviation: "SAC", division: "Pacific", conference: "Western", sport: "NBA", wins: 46, losses: 36, ties: 0 },

        // Western Conference - Southwest Division
        { id: "DAL-NBA", city: "Dallas", name: "Mavericks", abbreviation: "DAL", division: "Southwest", conference: "Western", sport: "NBA", wins: 50, losses: 32, ties: 0 },
        { id: "HOU-NBA", city: "Houston", name: "Rockets", abbreviation: "HOU", division: "Southwest", conference: "Western", sport: "NBA", wins: 41, losses: 41, ties: 0 },
        { id: "MEM", city: "Memphis", name: "Grizzlies", abbreviation: "MEM", division: "Southwest", conference: "Western", sport: "NBA", wins: 27, losses: 55, ties: 0 },
        { id: "NO", city: "New Orleans", name: "Pelicans", abbreviation: "NO", division: "Southwest", conference: "Western", sport: "NBA", wins: 49, losses: 33, ties: 0 },
        { id: "SA", city: "San Antonio", name: "Spurs", abbreviation: "SA", division: "Southwest", conference: "Western", sport: "NBA", wins: 22, losses: 60, ties: 0 },
      ];

      await db.insert(nbaTeams).values(nbaTeamsData);
      console.log("NBA teams initialized");
    } catch (error) {
      console.error("Error initializing NBA teams:", error);
    }
  }

  private async initializeSampleGameData() {
    try {
      // Check if games already exist
      const existingGames = await db.select().from(games).limit(1);
      if (existingGames.length > 0) {
        return; // Games already initialized
      }

      // Sample MLB Games
      const mlbGames = [
        {
          id: "mlb-game-1",
          sport: "MLB",
          season: "2024",
          homeTeamId: "LAD",
          awayTeamId: "SF-MLB",
          homeScore: 8,
          awayScore: 5,
          status: "completed",
          gameDate: new Date("2024-07-25T19:00:00Z"),
          completedAt: new Date("2024-07-25T22:15:00Z"),
          week: null
        },
        {
          id: "mlb-game-2", 
          sport: "MLB",
          season: "2024",
          homeTeamId: "BOS-MLB",
          awayTeamId: "NYY",
          homeScore: 7,
          awayScore: 3,
          status: "completed",
          gameDate: new Date("2024-07-26T19:00:00Z"),
          completedAt: new Date("2024-07-26T22:30:00Z"),
          week: null
        },
        {
          id: "mlb-game-3",
          sport: "MLB", 
          season: "2024",
          homeTeamId: "ATL-MLB",
          awayTeamId: "PHI-MLB",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date("2024-07-30T19:30:00Z"),
          completedAt: null,
          week: null
        },
        {
          id: "mlb-game-4",
          sport: "MLB",
          season: "2024", 
          homeTeamId: "HOU-MLB",
          awayTeamId: "TEX",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date("2024-07-31T20:00:00Z"),
          completedAt: null,
          week: null
        },
        // Additional upcoming MLB games for demo
        {
          id: "mlb-upcoming-4",
          sport: "MLB",
          season: "2024",
          homeTeamId: "LAD",
          awayTeamId: "SF-MLB",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date(Date.now() + 24*60*60*1000), // Tomorrow
          completedAt: null,
          week: null
        },
        {
          id: "mlb-upcoming-5",
          sport: "MLB",
          season: "2024",
          homeTeamId: "NYY",
          awayTeamId: "BOS-MLB",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date(Date.now() + 24*60*60*1000), // Tomorrow
          completedAt: null,
          week: null
        },
        {
          id: "mlb-upcoming-6",
          sport: "MLB",
          season: "2024",
          homeTeamId: "ATL-MLB",
          awayTeamId: "PHI-MLB",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date(Date.now() + 24*60*60*1000), // Tomorrow
          completedAt: null,
          week: null
        },
        {
          id: "mlb-upcoming-7",
          sport: "MLB",
          season: "2024",
          homeTeamId: "HOU-MLB",
          awayTeamId: "TEX",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date(Date.now() + 36*60*60*1000), // Day after tomorrow
          completedAt: null,
          week: null
        },
        {
          id: "mlb-upcoming-8",
          sport: "MLB",
          season: "2024",
          homeTeamId: "CHC",
          awayTeamId: "STL",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date(Date.now() + 36*60*60*1000), // Day after tomorrow
          completedAt: null,
          week: null
        }
      ];

      // Sample NBA Games  
      const nbaGames = [
        {
          id: "nba-game-1",
          sport: "NBA",
          season: "2024-25",
          homeTeamId: "LAL",
          awayTeamId: "BOS-NBA",
          homeScore: 112,
          awayScore: 108,
          status: "completed",
          gameDate: new Date("2024-07-25T21:00:00Z"),
          completedAt: new Date("2024-07-25T23:30:00Z"),
          week: null
        },
        {
          id: "nba-game-2",
          sport: "NBA", 
          season: "2024-25",
          homeTeamId: "GSW",
          awayTeamId: "LAC-NBA",
          homeScore: 118,
          awayScore: 115,
          status: "completed",
          gameDate: new Date("2024-07-26T22:00:00Z"),
          completedAt: new Date("2024-07-27T00:45:00Z"),
          week: null
        },
        {
          id: "nba-game-3",
          sport: "NBA",
          season: "2024-25",
          homeTeamId: "MIL-NBA",
          awayTeamId: "PHX",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date("2024-07-30T20:00:00Z"),
          completedAt: null,
          week: null
        },
        {
          id: "nba-game-4",
          sport: "NBA",
          season: "2024-25",
          homeTeamId: "DAL-NBA", 
          awayTeamId: "DEN-NBA",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          gameDate: new Date("2024-07-31T21:30:00Z"),
          completedAt: null,
          week: null
        }
      ];

      // Insert MLB games
      await db.insert(games).values(mlbGames);
      console.log("MLB sample games initialized");

      // Insert NBA games  
      await db.insert(games).values(nbaGames);
      console.log("NBA sample games initialized");

    } catch (error) {
      console.error("Error initializing sample game data:", error);
    }
  }

  private async initializeDemoLeagues() {
    try {
      // Force fresh demo leagues - delete existing ones first
      await db.delete(draftPicks).where(
        sql`league_id IN ('demo-league-1', 'demo-league-2', 'demo-league-3')`
      );
      await db.delete(leagueMembers).where(
        sql`league_id IN ('demo-league-1', 'demo-league-2', 'demo-league-3')`
      );
      await db.delete(leagues).where(
        sql`id IN ('demo-league-1', 'demo-league-2', 'demo-league-3')`
      );

      // Create demo leagues
      const demoLeagues = [
        {
          id: "demo-league-1",
          name: "Champions League",
          season: "2025-26",
          sport: "NFL",
          teamsPerPlayer: 4,
          maxPlayers: 8,
          draftStatus: "completed",
          seasonStatus: "active",
          createdBy: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", // Demo user ID
        },
        {
          id: "demo-league-2", 
          name: "Sunday Squad",
          season: "2025",
          sport: "MLB",
          teamsPerPlayer: 4,
          maxPlayers: 8,
          draftStatus: "completed",
          seasonStatus: "active",
          createdBy: "62f5c618-a04f-4b08-92e6-f7266c4ed7be",
        },
        {
          id: "demo-league-3",
          name: "Fantasy Friends",
          season: "2024-25", 
          sport: "NBA",
          teamsPerPlayer: 4,
          maxPlayers: 8,
          draftStatus: "completed",
          seasonStatus: "active",
          createdBy: "62f5c618-a04f-4b08-92e6-f7266c4ed7be",
        }
      ];

      await db.insert(leagues).values(demoLeagues);

      // Add demo user to all leagues
      const demoMemberships = demoLeagues.map((league, index) => ({
        leagueId: league.id,
        userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be",
        draftPosition: 1,
        totalWins: 0
      }));

      await db.insert(leagueMembers).values(demoMemberships);

      // Add more demo players to make the league full
      const additionalPlayers = [
        { id: "player-2", email: "mike@demo.com", password: "demo", firstName: "Mike", lastName: "Johnson", displayName: "Mike J" },
        { id: "player-3", email: "sarah@demo.com", password: "demo", firstName: "Sarah", lastName: "Davis", displayName: "Sarah D" },
        { id: "player-4", email: "tom@demo.com", password: "demo", firstName: "Tom", lastName: "Wilson", displayName: "Tom W" },
        { id: "player-5", email: "lisa@demo.com", password: "demo", firstName: "Lisa", lastName: "Brown", displayName: "Lisa B" },
        { id: "player-6", email: "james@demo.com", password: "demo", firstName: "James", lastName: "Miller", displayName: "James M" },
        { id: "player-7", email: "amy@demo.com", password: "demo", firstName: "Amy", lastName: "Garcia", displayName: "Amy G" },
        { id: "player-8", email: "steve@demo.com", password: "demo", firstName: "Steve", lastName: "Rodriguez", displayName: "Steve R" },
        { id: "player-9", email: "rachel@demo.com", password: "demo", firstName: "Rachel", lastName: "Johnson", displayName: "Rachel J" },
        { id: "player-10", email: "david@demo.com", password: "demo", firstName: "David", lastName: "Brown", displayName: "David B" },
        { id: "player-11", email: "jessica@demo.com", password: "demo", firstName: "Jessica", lastName: "Taylor", displayName: "Jessica T" },
        { id: "player-12", email: "kevin@demo.com", password: "demo", firstName: "Kevin", lastName: "Anderson", displayName: "Kevin A" }
      ];

      // Only insert users that don't already exist
      for (const player of additionalPlayers) {
        const existingUser = await db.select().from(users).where(eq(users.id, player.id)).limit(1);
        if (existingUser.length === 0) {
          await db.insert(users).values(player);
        }
      }

      // Add only 7 more players to Champions League (8 total)
      const championsMemberships = additionalPlayers.slice(0, 7).map((player, index) => ({
        leagueId: "demo-league-1",
        userId: player.id,
        draftPosition: index + 2,
        totalWins: 0
      }));

      await db.insert(leagueMembers).values(championsMemberships);

      // Add 7 more players to Sunday Squad (8 total) - Don't add main user again, already added above
      const sundaySquadMemberships = additionalPlayers.slice(0, 7).map((player, index) => ({
        leagueId: "demo-league-2",
        userId: player.id,
        draftPosition: index + 2,
        totalWins: 0
      }));

      await db.insert(leagueMembers).values(sundaySquadMemberships);

      // Add all players to demo-league-3 (NBA) - Don't add main user again, already added above
      const allPlayersForLeague3 = additionalPlayers.slice(0, 7).map((player, index) => ({
        leagueId: "demo-league-3",
        userId: player.id,
        draftPosition: index + 2,
        totalWins: 0
      }));

      await db.insert(leagueMembers).values(allPlayersForLeague3);

      // Add realistic draft picks for each player (4 teams each)
      const demoDraftPicks = [
        // Player 1 (main user) - High performing teams
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "DET", sport: "NFL", pickNumber: 1, round: 1 },
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "MIN", sport: "NFL", pickNumber: 16, round: 2 },
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "BUF", sport: "NFL", pickNumber: 17, round: 3 },
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "WAS", sport: "NFL", pickNumber: 32, round: 4 },

        // Player 2 - Mike J
        { leagueId: "demo-league-1", userId: "player-2", teamId: "KC", sport: "NFL", pickNumber: 2, round: 1 },
        { leagueId: "demo-league-1", userId: "player-2", teamId: "PHI", sport: "NFL", pickNumber: 15, round: 2 },
        { leagueId: "demo-league-1", userId: "player-2", teamId: "HOU", sport: "NFL", pickNumber: 18, round: 3 },
        { leagueId: "demo-league-1", userId: "player-2", teamId: "GB", sport: "NFL", pickNumber: 31, round: 4 },

        // Player 3 - Sarah D
        { leagueId: "demo-league-1", userId: "player-3", teamId: "PIT", sport: "NFL", pickNumber: 3, round: 1 },
        { leagueId: "demo-league-1", userId: "player-3", teamId: "BAL", sport: "NFL", pickNumber: 14, round: 2 },
        { leagueId: "demo-league-1", userId: "player-3", teamId: "TB", sport: "NFL", pickNumber: 19, round: 3 },
        { leagueId: "demo-league-1", userId: "player-3", teamId: "LAR", sport: "NFL", pickNumber: 30, round: 4 },

        // Player 4 - Tom W
        { leagueId: "demo-league-1", userId: "player-4", teamId: "LAC", sport: "NFL", pickNumber: 4, round: 1 },
        { leagueId: "demo-league-1", userId: "player-4", teamId: "SEA", sport: "NFL", pickNumber: 13, round: 2 },
        { leagueId: "demo-league-1", userId: "player-4", teamId: "DEN", sport: "NFL", pickNumber: 20, round: 3 },
        { leagueId: "demo-league-1", userId: "player-4", teamId: "ATL", sport: "NFL", pickNumber: 29, round: 4 },

        // Player 5 - Lisa B
        { leagueId: "demo-league-1", userId: "player-5", teamId: "CIN", sport: "NFL", pickNumber: 5, round: 1 },
        { leagueId: "demo-league-1", userId: "player-5", teamId: "ARI", sport: "NFL", pickNumber: 12, round: 2 },
        { leagueId: "demo-league-1", userId: "player-5", teamId: "MIA", sport: "NFL", pickNumber: 21, round: 3 },
        { leagueId: "demo-league-1", userId: "player-5", teamId: "IND", sport: "NFL", pickNumber: 28, round: 4 },

        // Player 6 - James M
        { leagueId: "demo-league-1", userId: "player-6", teamId: "NYJ", sport: "NFL", pickNumber: 6, round: 1 },
        { leagueId: "demo-league-1", userId: "player-6", teamId: "SF", sport: "NFL", pickNumber: 11, round: 2 },
        { leagueId: "demo-league-1", userId: "player-6", teamId: "LV", sport: "NFL", pickNumber: 22, round: 3 },
        { leagueId: "demo-league-1", userId: "player-6", teamId: "NE", sport: "NFL", pickNumber: 27, round: 4 },

        // Player 7 - Amy G
        { leagueId: "demo-league-1", userId: "player-7", teamId: "CLE", sport: "NFL", pickNumber: 7, round: 1 },
        { leagueId: "demo-league-1", userId: "player-7", teamId: "CHI", sport: "NFL", pickNumber: 10, round: 2 },
        { leagueId: "demo-league-1", userId: "player-7", teamId: "CAR", sport: "NFL", pickNumber: 23, round: 3 },
        { leagueId: "demo-league-1", userId: "player-7", teamId: "NYG", sport: "NFL", pickNumber: 26, round: 4 },

        // Player 8 - Steve R
        { leagueId: "demo-league-1", userId: "player-8", teamId: "DAL", sport: "NFL", pickNumber: 8, round: 1 },
        { leagueId: "demo-league-1", userId: "player-8", teamId: "NO", sport: "NFL", pickNumber: 9, round: 2 },
        { leagueId: "demo-league-1", userId: "player-8", teamId: "TEN", sport: "NFL", pickNumber: 24, round: 3 },
        { leagueId: "demo-league-1", userId: "player-8", teamId: "JAX", sport: "NFL", pickNumber: 25, round: 4 },

        // MLB League (demo-league-2) - Sunday Squad: NO DRAFT PICKS (for real draft testing)
        // This league will be used for real draft functionality testing

        // NO MLB DRAFT PICKS FOR DEMO-LEAGUE-2 (Sunday Squad)
        // This league is set up for real draft functionality testing

        // NBA League (demo-league-3) - Fantasy Friends draft picks  
        // Player 1 (main user) - Top NBA teams
        { leagueId: "demo-league-3", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "BOS-NBA", sport: "NBA", pickNumber: 1, round: 1 },
        { leagueId: "demo-league-3", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "OKC", sport: "NBA", pickNumber: 16, round: 2 },
        { leagueId: "demo-league-3", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "DEN-NBA", sport: "NBA", pickNumber: 17, round: 3 },
        { leagueId: "demo-league-3", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "NYK", sport: "NBA", pickNumber: 32, round: 4 },

        // NBA Player 2 - Mike J
        { leagueId: "demo-league-3", userId: "player-2", teamId: "MIN-NBA", sport: "NBA", pickNumber: 2, round: 1 },
        { leagueId: "demo-league-3", userId: "player-2", teamId: "LAC-NBA", sport: "NBA", pickNumber: 15, round: 2 },
        { leagueId: "demo-league-3", userId: "player-2", teamId: "PHX", sport: "NBA", pickNumber: 18, round: 3 },
        { leagueId: "demo-league-3", userId: "player-2", teamId: "NO", sport: "NBA", pickNumber: 31, round: 4 },

        // NBA Player 3 - Sarah D
        { leagueId: "demo-league-3", userId: "player-3", teamId: "CLE-NBA", sport: "NBA", pickNumber: 3, round: 1 },
        { leagueId: "demo-league-3", userId: "player-3", teamId: "DAL", sport: "NBA", pickNumber: 14, round: 2 },
        { leagueId: "demo-league-3", userId: "player-3", teamId: "MEM", sport: "NBA", pickNumber: 19, round: 3 },
        { leagueId: "demo-league-3", userId: "player-3", teamId: "MIA-NBA", sport: "NBA", pickNumber: 30, round: 4 },

        // NBA Player 4 - Tom W
        { leagueId: "demo-league-3", userId: "player-4", teamId: "HOU-NBA", sport: "NBA", pickNumber: 4, round: 1 },
        { leagueId: "demo-league-3", userId: "player-4", teamId: "GSW", sport: "NBA", pickNumber: 13, round: 2 },
        { leagueId: "demo-league-3", userId: "player-4", teamId: "SAC", sport: "NBA", pickNumber: 20, round: 3 },
        { leagueId: "demo-league-3", userId: "player-4", teamId: "ORL", sport: "NBA", pickNumber: 29, round: 4 },

        // NBA Player 5 - Lisa B
        { leagueId: "demo-league-3", userId: "player-5", teamId: "IND-NBA", sport: "NBA", pickNumber: 5, round: 1 },
        { leagueId: "demo-league-3", userId: "player-5", teamId: "MIL-NBA", sport: "NBA", pickNumber: 12, round: 2 },
        { leagueId: "demo-league-3", userId: "player-5", teamId: "LAL", sport: "NBA", pickNumber: 21, round: 3 },
        { leagueId: "demo-league-3", userId: "player-5", teamId: "ATL-NBA", sport: "NBA", pickNumber: 28, round: 4 },

        // NBA Player 6 - James M
        { leagueId: "demo-league-3", userId: "player-6", teamId: "PHI-NBA", sport: "NBA", pickNumber: 6, round: 1 },
        { leagueId: "demo-league-3", userId: "player-6", teamId: "POR", sport: "NBA", pickNumber: 11, round: 2 },
        { leagueId: "demo-league-3", userId: "player-6", teamId: "SA", sport: "NBA", pickNumber: 22, round: 3 },
        { leagueId: "demo-league-3", userId: "player-6", teamId: "UTA", sport: "NBA", pickNumber: 27, round: 4 },

        // NBA Player 7 - Amy G
        { leagueId: "demo-league-3", userId: "player-7", teamId: "TOR-NBA", sport: "NBA", pickNumber: 7, round: 1 },
        { leagueId: "demo-league-3", userId: "player-7", teamId: "CHI-NBA", sport: "NBA", pickNumber: 10, round: 2 },
        { leagueId: "demo-league-3", userId: "player-7", teamId: "WAS-NBA", sport: "NBA", pickNumber: 23, round: 3 },
        { leagueId: "demo-league-3", userId: "player-7", teamId: "CHA", sport: "NBA", pickNumber: 26, round: 4 },

        // NBA Player 8 - Steve R
        { leagueId: "demo-league-3", userId: "player-8", teamId: "BKN", sport: "NBA", pickNumber: 8, round: 1 },
        { leagueId: "demo-league-3", userId: "player-8", teamId: "DET-NBA", sport: "NBA", pickNumber: 9, round: 2 },
        { leagueId: "demo-league-3", userId: "player-8", teamId: "CHI-NBA", sport: "NBA", pickNumber: 24, round: 3 },
        { leagueId: "demo-league-3", userId: "player-8", teamId: "WAS-NBA", sport: "NBA", pickNumber: 25, round: 4 }
      ];

      await db.insert(draftPicks).values(demoDraftPicks);

      console.log("Demo leagues initialized successfully");
    } catch (error) {
      console.error("Error initializing demo leagues:", error);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserPrivileges(userId: string, isAdmin: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isAdmin })
      .where(eq(users.id, userId));
  }

  // League methods
  async getLeague(id: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
    return league || undefined;
  }

  async createLeague(insertLeague: InsertLeague): Promise<League> {
    const [league] = await db.insert(leagues).values(insertLeague).returning();
    return league;
  }

  async updateLeague(id: string, updates: Partial<League>): Promise<League | undefined> {
    const [league] = await db.update(leagues).set(updates).where(eq(leagues.id, id)).returning();
    return league || undefined;
  }

  async getUserLeagues(userId: string): Promise<League[]> {
    const result = await db
      .select({ league: leagues })
      .from(leagueMembers)
      .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
      .where(eq(leagueMembers.userId, userId));
    
    return result.map(r => r.league);
  }

  // League member methods
  async getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
    return await db.select().from(leagueMembers).where(eq(leagueMembers.leagueId, leagueId));
  }

  async addLeagueMember(insertMember: InsertLeagueMember): Promise<LeagueMember> {
    const [member] = await db.insert(leagueMembers).values(insertMember).returning();
    return member;
  }

  async removeLeagueMember(leagueId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getLeagueMember(leagueId: string, userId: string): Promise<LeagueMember | undefined> {
    const [member] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));
    
    return member || undefined;
  }

  async updateLeagueMemberPreferences(
    leagueId: string, 
    userId: string, 
    preferences: { draftNotifications?: boolean; gameNotifications?: boolean; }
  ): Promise<boolean> {
    const result = await db
      .update(leagueMembers)
      .set(preferences)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getPlayerStandings(leagueId: string): Promise<PlayerStanding[]> {
    const members = await db
      .select({
        member: leagueMembers,
        user: users,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(eq(leagueMembers.leagueId, leagueId));

    const league = await this.getLeague(leagueId);
    if (!league) return [];

    const standings: PlayerStanding[] = [];

    for (const { member, user } of members) {
      const userPicks = await this.getUserDraftPicks(leagueId, user.id);
      const teams = await Promise.all(
        userPicks.map(pick => this.getTeamBySport(pick.teamId!, pick.sport!))
      );
      const validTeams = teams.filter((team): team is NFLTeam | MLBTeam | NBATeam => Boolean(team));
      const totalWins = validTeams.reduce((sum, team) => sum + (team?.wins || 0), 0);

      standings.push({
        userId: user.id,
        displayName: user.displayName,
        totalWins,
        teams: validTeams,
        rank: 0, // Will be calculated after sorting
      });
    }

    // Sort by total wins and assign ranks
    standings.sort((a, b) => b.totalWins - a.totalWins);
    standings.forEach((standing, index) => {
      standing.rank = index + 1;
    });

    return standings;
  }

  // Multi-sport team methods
  async getAllNFLTeams(): Promise<NFLTeam[]> {
    return await db.select().from(nflTeams);
  }

  async getAllMLBTeams(): Promise<MLBTeam[]> {
    return await db.select().from(mlbTeams);
  }

  async getAllNBATeams(): Promise<NBATeam[]> {
    return await db.select().from(nbaTeams);
  }

  async getNFLTeam(id: string): Promise<NFLTeam | undefined> {
    const [team] = await db.select().from(nflTeams).where(eq(nflTeams.id, id));
    return team || undefined;
  }

  async getMLBTeam(id: string): Promise<MLBTeam | undefined> {
    const [team] = await db.select().from(mlbTeams).where(eq(mlbTeams.id, id));
    return team || undefined;
  }

  async getNBATeam(id: string): Promise<NBATeam | undefined> {
    const [team] = await db.select().from(nbaTeams).where(eq(nbaTeams.id, id));
    return team || undefined;
  }

  async getTeamBySport(id: string, sport: string): Promise<NFLTeam | MLBTeam | NBATeam | undefined> {
    switch (sport) {
      case 'NFL':
        return await this.getNFLTeam(id);
      case 'MLB':
        return await this.getMLBTeam(id);
      case 'NBA':
        return await this.getNBATeam(id);
      default:
        return undefined;
    }
  }

  async updateTeamRecord(teamId: string, wins: number, losses: number, ties: number = 0): Promise<void> {
    await db.update(nflTeams).set({ wins, losses, ties }).where(eq(nflTeams.id, teamId));
  }

  async updateMLBTeamRecord(teamId: string, wins: number, losses: number): Promise<void> {
    await db.update(mlbTeams).set({ wins, losses }).where(eq(mlbTeams.id, teamId));
  }

  // Helper method to check for standings changes and send notifications
  async checkAndNotifyStandingsChanges(): Promise<void> {
    try {
      const { pushNotificationService } = await import("./services/pushNotificationService");
      
      // Get all active leagues
      const allLeagues = await db.select().from(leagues);
      
      for (const league of allLeagues) {
        // Get current standings
        const currentStandings = await this.getPlayerStandings(league.id);
        
        // For now, we'll store the previous standings in memory
        // In a production system, you'd want to store this in a database
        const cacheKey = `standings_${league.id}`;
        const previousStandings = (global as any).standingsCache?.[cacheKey] || [];
        
        // Check if standings have changed
        if (previousStandings.length > 0) {
          await pushNotificationService.sendStandingsUpdates(
            league.id,
            previousStandings,
            currentStandings
          );
        }
        
        // Update the cache
        if (!(global as any).standingsCache) {
          (global as any).standingsCache = {};
        }
        (global as any).standingsCache[cacheKey] = currentStandings;
      }
    } catch (error) {
      console.error('Error checking standings changes:', error);
    }
  }

  async updateNBATeamRecord(teamId: string, wins: number, losses: number): Promise<void> {
    await db.update(nbaTeams).set({ wins, losses }).where(eq(nbaTeams.id, teamId));
  }

  // Draft methods
  async getDraftPicks(leagueId: string): Promise<DraftPick[]> {
    return await db
      .select()
      .from(draftPicks)
      .where(eq(draftPicks.leagueId, leagueId))
      .orderBy(draftPicks.pickNumber);
  }

  async addDraftPick(insertPick: InsertDraftPick): Promise<DraftPick> {
    const [pick] = await db.insert(draftPicks).values(insertPick).returning();
    return pick;
  }

  async getUserDraftPicks(leagueId: string, userId: string): Promise<DraftPick[]> {
    return await db
      .select()
      .from(draftPicks)
      .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.userId, userId)))
      .orderBy(draftPicks.pickNumber);
  }

  async getDraftStatus(leagueId: string): Promise<DraftStatus> {
    const league = await this.getLeague(leagueId);
    const picks = await this.getDraftPicks(leagueId);
    const members = await this.getLeagueMembers(leagueId);

    if (!league || league.draftStatus !== "active") {
      return {
        isActive: false,
        currentPick: 0,
        currentPlayer: "",
        round: 1,
      };
    }

    const totalPicks = members.length * league.teamsPerPlayer;
    const currentPickNumber = picks.length + 1;

    if (currentPickNumber > totalPicks) {
      return {
        isActive: false,
        currentPick: totalPicks,
        currentPlayer: "",
        round: Math.ceil(totalPicks / members.length),
      };
    }

    const round = Math.ceil(currentPickNumber / members.length);
    const positionInRound = ((currentPickNumber - 1) % members.length) + 1;
    const isSnakeRound = round % 2 === 0;
    const draftPosition = isSnakeRound ? members.length - positionInRound + 1 : positionInRound;

    const currentMember = members.find(m => m.draftPosition === draftPosition);
    const currentUser = currentMember ? await this.getUser(currentMember.userId!) : null;

    return {
      isActive: true,
      currentPick: currentPickNumber,
      currentPlayer: currentUser?.displayName || "",
      round,
    };
  }

  // Game methods
  async getGames(week?: number, season: string = "2024"): Promise<Game[]> {
    if (week !== undefined) {
      return await db.select().from(games).where(and(eq(games.season, season), eq(games.week, week)));
    }
    
    return await db.select().from(games).where(eq(games.season, season));
  }

  async updateGame(gameId: string, updates: Partial<Game>): Promise<Game | undefined> {
    const [game] = await db.update(games).set(updates).where(eq(games.id, gameId)).returning();
    return game || undefined;
  }

  async addGame(insertGame: InsertGame): Promise<Game> {
    const [game] = await db.insert(games).values(insertGame)
      .onConflictDoUpdate({
        target: games.id,
        set: {
          homeScore: insertGame.homeScore,
          awayScore: insertGame.awayScore,
          status: insertGame.status,
          completedAt: insertGame.completedAt,
          period: insertGame.period,
        }
      })
      .returning();
    return game;
  }

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

  async getRecentCompletedGames(limit: number): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(eq(games.status, "completed"))
      .orderBy(desc(games.completedAt))
      .limit(limit);
  }

  async resetDraft(leagueId: string): Promise<void> {
    await db.delete(draftPicks).where(eq(draftPicks.leagueId, leagueId));
  }

  async undoLastDraftPick(leagueId: string): Promise<boolean> {
    const lastPick = await db
      .select()
      .from(draftPicks)
      .where(eq(draftPicks.leagueId, leagueId))
      .orderBy(desc(draftPicks.pickNumber))
      .limit(1);

    if (lastPick.length === 0) {
      return false;
    }

    await db.delete(draftPicks).where(eq(draftPicks.id, lastPick[0].id));
    return true;
  }

  async getRecentGamesWithOwners(leagueId: string, limit: number): Promise<any[]> {
    // Get the league to determine sport
    const league = await this.getLeague(leagueId);
    if (!league) return [];
    
    // For MLB/NBA, get today's games only. For NFL, get recent completed games
    let recentGames;
    
    if (league.sport === 'MLB' || league.sport === 'NBA') {
      // Get today's games including late night games that extend into early morning
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 6, 0, 0); // Start at 6 AM to exclude late night games from previous day
      const tomorrowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 6, 0, 0); // End at 6 AM next day
      
      recentGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.sport, league.sport),
          gte(games.gameDate, todayStart),
          lt(games.gameDate, tomorrowEnd)
        ))
        .orderBy(games.gameDate)
        .limit(limit);
    } else {
      // For NFL, get current week's completed games only
      const currentWeek = this.getCurrentNFLWeek();
      recentGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.status, "completed"),
          eq(games.sport, league.sport || "NFL"),
          eq(games.week, currentWeek)
        ))
        .orderBy(games.gameDate)
        .limit(limit);
    }
    
    const gamesWithOwners = await Promise.all(
      recentGames.map(async (game) => {
        // Find owners of home and away teams in this league
        const homeOwner = await db
          .select({ user: users })
          .from(draftPicks)
          .innerJoin(users, eq(draftPicks.userId, users.id))
          .where(and(
            eq(draftPicks.leagueId, leagueId),
            eq(draftPicks.teamId, game.homeTeamId!)
          ))
          .limit(1);

        const awayOwner = await db
          .select({ user: users })
          .from(draftPicks)
          .innerJoin(users, eq(draftPicks.userId, users.id))
          .where(and(
            eq(draftPicks.leagueId, leagueId),
            eq(draftPicks.teamId, game.awayTeamId!)
          ))
          .limit(1);

        return {
          ...game,
          homeOwner: homeOwner[0]?.user || null,
          awayOwner: awayOwner[0]?.user || null,
        };
      })
    );

    return gamesWithOwners;
  }

  async getUpcomingGamesWithOwners(leagueId: string, limit: number): Promise<any[]> {
    // Get the league to determine sport
    const league = await this.getLeague(leagueId);
    if (!league) return [];
    
    // For MLB/NBA, get tomorrow's games only. For NFL, get upcoming scheduled games
    let upcomingGames;
    
    if (league.sport === 'MLB' || league.sport === 'NBA') {
      // Get tomorrow's games using same 6 AM cutoff logic as today's games
      const today = new Date();
      const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 6, 0, 0); // Start at 6 AM tomorrow
      const dayAfterEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 6, 0, 0); // End at 6 AM day after
      
      upcomingGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.sport, league.sport),
          gte(games.gameDate, tomorrowStart),
          lt(games.gameDate, dayAfterEnd)
        ))
        .orderBy(games.gameDate)
        .limit(limit);
    } else {
      // For NFL, get next week's upcoming scheduled games only
      const currentWeek = this.getCurrentNFLWeek();
      const nextWeek = currentWeek + 1;
      upcomingGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.status, "scheduled"),
          eq(games.sport, league.sport || "NFL"),
          eq(games.week, nextWeek)
        ))
        .orderBy(games.gameDate)
        .limit(limit);
    }
    
    const gamesWithOwners = await Promise.all(
      upcomingGames.map(async (game) => {
        // Find owners of home and away teams in this league
        const homeOwner = await db
          .select({ user: users })
          .from(draftPicks)
          .innerJoin(users, eq(draftPicks.userId, users.id))
          .where(and(
            eq(draftPicks.leagueId, leagueId),
            eq(draftPicks.teamId, game.homeTeamId!)
          ))
          .limit(1);

        const awayOwner = await db
          .select({ user: users })
          .from(draftPicks)
          .innerJoin(users, eq(draftPicks.userId, users.id))
          .where(and(
            eq(draftPicks.leagueId, leagueId),
            eq(draftPicks.teamId, game.awayTeamId!)
          ))
          .limit(1);

        return {
          ...game,
          homeOwner: homeOwner[0]?.user || null,
          awayOwner: awayOwner[0]?.user || null,
        };
      })
    );

    return gamesWithOwners;
  }
}

export const storage = new DatabaseStorage();