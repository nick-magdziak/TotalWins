import { eq, desc, and, sql, gte, lt, lte, inArray } from "drizzle-orm";
import { db } from "./db";
import { hashPassword } from "./lib/auth.js";
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
  type WorldCupTeam,
  type InsertWorldCupTeam,
  type DraftPick,
  type InsertDraftPick,
  type Game,
  type InsertGame,
  type PlayerStanding,
  type DraftStatus,
  type WCGroupStanding,
  type WCPlayerStanding,
  users,
  leagues,
  leagueMembers,
  nflTeams,
  mlbTeams,
  nbaTeams,
  worldCupTeams,
  draftPicks,
  games,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserPrivileges(userId: string, isAdmin: boolean): Promise<void>;

  // Leagues
  getLeague(id: string): Promise<League | undefined>;
  getLeagueByInviteCode(code: string): Promise<League | undefined>;
  createLeague(league: InsertLeague): Promise<League>;
  updateLeague(id: string, updates: Partial<League>): Promise<League | undefined>;
  getUserLeagues(userId: string): Promise<League[]>;

  // League Members
  getLeagueMembers(leagueId: string): Promise<LeagueMember[]>;
  getLeagueMember(leagueId: string, userId: string): Promise<LeagueMember | undefined>;
  addLeagueMember(member: InsertLeagueMember): Promise<LeagueMember>;
  removeLeagueMember(leagueId: string, userId: string): Promise<boolean>;
  updateLeagueMemberPreferences(leagueId: string, userId: string, preferences: { draftNotifications?: boolean; gameNotifications?: boolean; }): Promise<boolean>;
  saveDraftOrder(leagueId: string, orderedUserIds: string[]): Promise<boolean>;
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

  // World Cup
  getAllWorldCupTeams(): Promise<WorldCupTeam[]>;
  getWorldCupTeam(id: string): Promise<WorldCupTeam | undefined>;
  getWorldCupGroups(): Promise<Record<string, WCGroupStanding[]>>;
  getWorldCupBracket(): Promise<Record<string, { homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null; status: string; gameDate: Date }[]>>;
  getWorldCupPlayerStandings(leagueId: string): Promise<WCPlayerStanding[]>;
  calculateWorldCupPlayerPoints(): Promise<void>;
  getWorldCupGames(): Promise<Game[]>;
  getLeagueAnalytics(leagueId: string): Promise<{
    gamesProcessed: number;
    totalGames: number;
    players: Array<{
      userId: string;
      displayName: string;
      currentWins: number;
      maxPossibleWins: number;
    }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeNFLTeams();
    this.initializeMLBTeams();
    this.initializeNBATeams();
    this.initializeWorldCupTeams();
    this.initializeWorldCupGames();
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
          season: "2025-26",
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
      const demoPasswordHash = await hashPassword("demo");
      const additionalPlayers = [
        { id: "player-2", email: "mike@demo.com", password: demoPasswordHash, firstName: "Mike", lastName: "Johnson", displayName: "Mike J" },
        { id: "player-3", email: "sarah@demo.com", password: demoPasswordHash, firstName: "Sarah", lastName: "Davis", displayName: "Sarah D" },
        { id: "player-4", email: "tom@demo.com", password: demoPasswordHash, firstName: "Tom", lastName: "Wilson", displayName: "Tom W" },
        { id: "player-5", email: "lisa@demo.com", password: demoPasswordHash, firstName: "Lisa", lastName: "Brown", displayName: "Lisa B" },
        { id: "player-6", email: "james@demo.com", password: demoPasswordHash, firstName: "James", lastName: "Miller", displayName: "James M" },
        { id: "player-7", email: "amy@demo.com", password: demoPasswordHash, firstName: "Amy", lastName: "Garcia", displayName: "Amy G" },
        { id: "player-8", email: "steve@demo.com", password: demoPasswordHash, firstName: "Steve", lastName: "Rodriguez", displayName: "Steve R" },
        { id: "player-9", email: "rachel@demo.com", password: demoPasswordHash, firstName: "Rachel", lastName: "Johnson", displayName: "Rachel J" },
        { id: "player-10", email: "david@demo.com", password: demoPasswordHash, firstName: "David", lastName: "Brown", displayName: "David B" },
        { id: "player-11", email: "jessica@demo.com", password: demoPasswordHash, firstName: "Jessica", lastName: "Taylor", displayName: "Jessica T" },
        { id: "player-12", email: "kevin@demo.com", password: demoPasswordHash, firstName: "Kevin", lastName: "Anderson", displayName: "Kevin A" }
      ];

      // Insert new users or upgrade plain-text passwords to bcrypt hashes
      for (const player of additionalPlayers) {
        const [existingUser] = await db.select().from(users).where(eq(users.id, player.id)).limit(1);
        if (!existingUser) {
          await db.insert(users).values(player);
        } else if (!existingUser.password?.startsWith("$2")) {
          await db.update(users).set({ password: demoPasswordHash }).where(eq(users.id, player.id));
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
        { leagueId: "demo-league-3", userId: "player-3", teamId: "DAL-NBA", sport: "NBA", pickNumber: 14, round: 2 },
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

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
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

  async getLeagueByInviteCode(code: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(sql`UPPER(${leagues.inviteCode}) = UPPER(${code})`);
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

  async saveDraftOrder(leagueId: string, orderedUserIds: string[]): Promise<boolean> {
    await Promise.all(
      orderedUserIds.map((userId, index) =>
        db
          .update(leagueMembers)
          .set({ draftPosition: index + 1 })
          .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
      )
    );
    return true;
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

    // For WORLD_CUP, use fantasy points from getWorldCupPlayerStandings
    if (league.sport === 'WORLD_CUP') {
      const wcStandings = await this.getWorldCupPlayerStandings(leagueId);
      return wcStandings.map((s, index) => ({
        userId: s.userId,
        displayName: s.displayName,
        totalWins: s.fantasyPoints,
        teams: s.teams as unknown as (NFLTeam | MLBTeam | NBATeam)[],
        rank: s.rank,
      }));
    }

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

  async getTeamBySport(id: string, sport: string): Promise<NFLTeam | MLBTeam | NBATeam | WorldCupTeam | undefined> {
    switch (sport) {
      case 'NFL':
        return await this.getNFLTeam(id);
      case 'MLB':
        return await this.getMLBTeam(id);
      case 'NBA':
        return await this.getNBATeam(id);
      case 'WORLD_CUP':
        return await this.getWorldCupTeam(id);
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

    const isPaused = league?.draftStatus === "paused";
    const isRunning = league?.draftStatus === "active";

    // Only compute turn info when the draft is active or paused
    if (!league || (!isRunning && !isPaused)) {
      return {
        isActive: false,
        isPaused: false,
        currentPick: 0,
        currentPlayer: "",
        round: 1,
      };
    }

    // Shared computation for both active and paused states
    const totalPicks = members.length * league.teamsPerPlayer;
    const currentPickNumber = picks.length + 1;

    if (currentPickNumber > totalPicks) {
      return {
        isActive: false,
        isPaused: false,
        currentPick: totalPicks,
        currentPlayer: "",
        round: Math.ceil(totalPicks / members.length),
      };
    }

    const round = Math.ceil(currentPickNumber / members.length);
    const positionInRound = ((currentPickNumber - 1) % members.length) + 1;
    const isSnakeRound = round % 2 === 0;
    const draftPosition = isSnakeRound ? members.length - positionInRound + 1 : positionInRound;

    let currentMember = members.find(m => m.draftPosition === draftPosition);

    // Fallback: if explicit positions aren't set, infer order from round-1 pick history
    if (!currentMember) {
      // Build an inferred draft order from the first N picks (round 1)
      const roundOnePicks = picks
        .filter(p => p.pickNumber <= members.length)
        .sort((a, b) => a.pickNumber - b.pickNumber);

      if (roundOnePicks.length >= draftPosition) {
        // We've seen this position's pick before — infer the player
        const inferredUserId = roundOnePicks[draftPosition - 1]?.userId;
        if (inferredUserId) {
          currentMember = members.find(m => m.userId === inferredUserId);
        }
      } else {
        // Not enough round-1 data — fall back to stable member ordering
        // Sort: explicit positions first, then nulls in DB return order
        const sorted = [...members].sort((a, b) => {
          if (a.draftPosition != null && b.draftPosition != null) return a.draftPosition - b.draftPosition;
          if (a.draftPosition != null) return -1;
          if (b.draftPosition != null) return 1;
          return 0;
        });
        currentMember = sorted[draftPosition - 1];
      }
    }

    const currentUser = currentMember ? await this.getUser(currentMember.userId!) : null;

    return {
      isActive: isRunning,
      isPaused,
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

  async getRecentGamesWithOwners(leagueId: string, limit: number, localDate?: string, tzOffset: number = 0): Promise<any[]> {
    // Get the league to determine sport
    const league = await this.getLeague(leagueId);
    if (!league) return [];
    
    // For MLB/NBA, get today's games only. For NFL, get recent completed games
    let recentGames;
    
    if (league.sport === 'WORLD_CUP') {
      // World Cup: yesterday midnight → today end-of-day (2-day window, date-based)
      // localDate is "yesterday" sent by the frontend
      let windowStart: Date, windowEnd: Date;
      if (localDate) {
        const [year, month, day] = localDate.split('-').map(Number);
        const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
        windowStart = new Date(utcMidnight + tzOffset * 60 * 1000);
        windowEnd = new Date(windowStart.getTime() + 48 * 60 * 60 * 1000 - 1);
      } else {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        windowStart = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0));
        windowEnd = new Date(windowStart.getTime() + 48 * 60 * 60 * 1000 - 1);
      }
      recentGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.sport, "WORLD_CUP"),
          gte(games.gameDate, windowStart),
          lte(games.gameDate, windowEnd)
        ))
        .orderBy(games.gameDate)
        .limit(limit);
    } else if (league.sport === 'MLB' || league.sport === 'NBA') {
      // Compute the UTC window for the user's local "today"
      // localDate = "YYYY-MM-DD" in user's timezone, tzOffset = minutes (from getTimezoneOffset(), positive = west of UTC)
      let todayStart: Date, todayEnd: Date;
      if (localDate) {
        const [year, month, day] = localDate.split('-').map(Number);
        // UTC timestamp for midnight of that local date
        // Local midnight = UTC midnight + tzOffset minutes
        const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
        todayStart = new Date(utcMidnight + tzOffset * 60 * 1000);
        todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      } else {
        // Fallback: use server UTC date
        const now = new Date();
        todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
      }
      
      recentGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.sport, league.sport),
          gte(games.gameDate, todayStart),
          lte(games.gameDate, todayEnd)
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

  private async initializeWorldCupTeams() {
    try {
      // Always re-seed to keep groups accurate (official draw can be updated here)
      await db.delete(worldCupTeams);

      const wcTeams: InsertWorldCupTeam[] = [
        // Group A — Opening match: Mexico vs South Africa, June 11 at Estadio Azteca
        { id: "wc-MEX", name: "Mexico", abbreviation: "MEX", group: "A", confederation: "CONCACAF", qualified: true, fifaRanking: 15, flagEmoji: "🇲🇽" },
        { id: "wc-RSA", name: "South Africa", abbreviation: "RSA", group: "A", confederation: "CAF", qualified: true, fifaRanking: 61, flagEmoji: "🇿🇦" },
        { id: "wc-KOR", name: "South Korea", abbreviation: "KOR", group: "A", confederation: "AFC", qualified: true, fifaRanking: 22, flagEmoji: "🇰🇷" },
        { id: "wc-A4", name: "Czech Republic", abbreviation: "CZE", group: "A", confederation: "UEFA", qualified: true, fifaRanking: 43, flagEmoji: "🇨🇿" },
        // Group B
        { id: "wc-CAN", name: "Canada", abbreviation: "CAN", group: "B", confederation: "CONCACAF", qualified: true, fifaRanking: 27, flagEmoji: "🇨🇦" },
        { id: "wc-SUI", name: "Switzerland", abbreviation: "SUI", group: "B", confederation: "UEFA", qualified: true, fifaRanking: 17, flagEmoji: "🇨🇭" },
        { id: "wc-QAT", name: "Qatar", abbreviation: "QAT", group: "B", confederation: "AFC", qualified: true, fifaRanking: 51, flagEmoji: "🇶🇦" },
        { id: "wc-B4", name: "Bosnia and Herzegovina", abbreviation: "BIH", group: "B", confederation: "UEFA", qualified: true, fifaRanking: 71, flagEmoji: "🇧🇦" },
        // Group C
        { id: "wc-BRA", name: "Brazil", abbreviation: "BRA", group: "C", confederation: "CONMEBOL", qualified: true, fifaRanking: 5, flagEmoji: "🇧🇷" },
        { id: "wc-MAR", name: "Morocco", abbreviation: "MAR", group: "C", confederation: "CAF", qualified: true, fifaRanking: 11, flagEmoji: "🇲🇦" },
        { id: "wc-SCO", name: "Scotland", abbreviation: "SCO", group: "C", confederation: "UEFA", qualified: true, fifaRanking: 36, flagEmoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
        { id: "wc-HAI", name: "Haiti", abbreviation: "HAI", group: "C", confederation: "CONCACAF", qualified: true, fifaRanking: 84, flagEmoji: "🇭🇹" },
        // Group D — USA as host
        { id: "wc-USA", name: "United States", abbreviation: "USA", group: "D", confederation: "CONCACAF", qualified: true, fifaRanking: 14, flagEmoji: "🇺🇸" },
        { id: "wc-PAR", name: "Paraguay", abbreviation: "PAR", group: "D", confederation: "CONMEBOL", qualified: true, fifaRanking: 39, flagEmoji: "🇵🇾" },
        { id: "wc-AUS", name: "Australia", abbreviation: "AUS", group: "D", confederation: "AFC", qualified: true, fifaRanking: 26, flagEmoji: "🇦🇺" },
        { id: "wc-D4", name: "Turkey", abbreviation: "TUR", group: "D", confederation: "UEFA", qualified: true, fifaRanking: 26, flagEmoji: "🇹🇷" },
        // Group E
        { id: "wc-GER", name: "Germany", abbreviation: "GER", group: "E", confederation: "UEFA", qualified: true, fifaRanking: 9, flagEmoji: "🇩🇪" },
        { id: "wc-ECU", name: "Ecuador", abbreviation: "ECU", group: "E", confederation: "CONMEBOL", qualified: true, fifaRanking: 23, flagEmoji: "🇪🇨" },
        { id: "wc-CIV", name: "Ivory Coast", abbreviation: "CIV", group: "E", confederation: "CAF", qualified: true, fifaRanking: 42, flagEmoji: "🇨🇮" },
        { id: "wc-CUW", name: "Curaçao", abbreviation: "CUW", group: "E", confederation: "CONCACAF", qualified: true, fifaRanking: 82, flagEmoji: "🇨🇼" },
        // Group F
        { id: "wc-NED", name: "Netherlands", abbreviation: "NED", group: "F", confederation: "UEFA", qualified: true, fifaRanking: 7, flagEmoji: "🇳🇱" },
        { id: "wc-JPN", name: "Japan", abbreviation: "JPN", group: "F", confederation: "AFC", qualified: true, fifaRanking: 18, flagEmoji: "🇯🇵" },
        { id: "wc-TUN", name: "Tunisia", abbreviation: "TUN", group: "F", confederation: "CAF", qualified: true, fifaRanking: 40, flagEmoji: "🇹🇳" },
        { id: "wc-F4", name: "Sweden", abbreviation: "SWE", group: "F", confederation: "UEFA", qualified: true, fifaRanking: 42, flagEmoji: "🇸🇪" },
        // Group G
        { id: "wc-BEL", name: "Belgium", abbreviation: "BEL", group: "G", confederation: "UEFA", qualified: true, fifaRanking: 8, flagEmoji: "🇧🇪" },
        { id: "wc-IRN", name: "Iran", abbreviation: "IRN", group: "G", confederation: "AFC", qualified: true, fifaRanking: 20, flagEmoji: "🇮🇷" },
        { id: "wc-EGY", name: "Egypt", abbreviation: "EGY", group: "G", confederation: "CAF", qualified: true, fifaRanking: 34, flagEmoji: "🇪🇬" },
        { id: "wc-NZL", name: "New Zealand", abbreviation: "NZL", group: "G", confederation: "OFC", qualified: true, fifaRanking: 86, flagEmoji: "🇳🇿" },
        // Group H
        { id: "wc-ESP", name: "Spain", abbreviation: "ESP", group: "H", confederation: "UEFA", qualified: true, fifaRanking: 1, flagEmoji: "🇪🇸" },
        { id: "wc-URU", name: "Uruguay", abbreviation: "URU", group: "H", confederation: "CONMEBOL", qualified: true, fifaRanking: 16, flagEmoji: "🇺🇾" },
        { id: "wc-KSA", name: "Saudi Arabia", abbreviation: "KSA", group: "H", confederation: "AFC", qualified: true, fifaRanking: 60, flagEmoji: "🇸🇦" },
        { id: "wc-CPV", name: "Cape Verde", abbreviation: "CPV", group: "H", confederation: "CAF", qualified: true, fifaRanking: 68, flagEmoji: "🇨🇻" },
        // Group I
        { id: "wc-FRA", name: "France", abbreviation: "FRA", group: "I", confederation: "UEFA", qualified: true, fifaRanking: 3, flagEmoji: "🇫🇷" },
        { id: "wc-SEN", name: "Senegal", abbreviation: "SEN", group: "I", confederation: "CAF", qualified: true, fifaRanking: 19, flagEmoji: "🇸🇳" },
        { id: "wc-NOR", name: "Norway", abbreviation: "NOR", group: "I", confederation: "UEFA", qualified: true, fifaRanking: 29, flagEmoji: "🇳🇴" },
        { id: "wc-IRQ", name: "Iraq", abbreviation: "IRQ", group: "I", confederation: "AFC", qualified: true, fifaRanking: 66, flagEmoji: "🇮🇶" },
        // Group J
        { id: "wc-ARG", name: "Argentina", abbreviation: "ARG", group: "J", confederation: "CONMEBOL", qualified: true, fifaRanking: 2, flagEmoji: "🇦🇷" },
        { id: "wc-AUT", name: "Austria", abbreviation: "AUT", group: "J", confederation: "UEFA", qualified: true, fifaRanking: 24, flagEmoji: "🇦🇹" },
        { id: "wc-ALG", name: "Algeria", abbreviation: "ALG", group: "J", confederation: "CAF", qualified: true, fifaRanking: 35, flagEmoji: "🇩🇿" },
        { id: "wc-JOR", name: "Jordan", abbreviation: "JOR", group: "J", confederation: "AFC", qualified: true, fifaRanking: 66, flagEmoji: "🇯🇴" },
        // Group K
        { id: "wc-POR", name: "Portugal", abbreviation: "POR", group: "K", confederation: "UEFA", qualified: true, fifaRanking: 6, flagEmoji: "🇵🇹" },
        { id: "wc-COL", name: "Colombia", abbreviation: "COL", group: "K", confederation: "CONMEBOL", qualified: true, fifaRanking: 13, flagEmoji: "🇨🇴" },
        { id: "wc-UZB", name: "Uzbekistan", abbreviation: "UZB", group: "K", confederation: "AFC", qualified: true, fifaRanking: 50, flagEmoji: "🇺🇿" },
        { id: "wc-K4", name: "DR Congo", abbreviation: "COD", group: "K", confederation: "CAF", qualified: true, fifaRanking: 48, flagEmoji: "🇨🇩" },
        // Group L
        { id: "wc-ENG", name: "England", abbreviation: "ENG", group: "L", confederation: "UEFA", qualified: true, fifaRanking: 4, flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
        { id: "wc-CRO", name: "Croatia", abbreviation: "CRO", group: "L", confederation: "UEFA", qualified: true, fifaRanking: 10, flagEmoji: "🇭🇷" },
        { id: "wc-GHA", name: "Ghana", abbreviation: "GHA", group: "L", confederation: "CAF", qualified: true, fifaRanking: 72, flagEmoji: "🇬🇭" },
        { id: "wc-PAN", name: "Panama", abbreviation: "PAN", group: "L", confederation: "CONCACAF", qualified: true, fifaRanking: 30, flagEmoji: "🇵🇦" },
      ];

      await db.insert(worldCupTeams).values(wcTeams);
      console.log("World Cup teams initialized");
    } catch (error) {
      console.error("Error initializing World Cup teams:", error);
    }
  }

  private async initializeWorldCupGames() {
    try {
      const season = "2026";

      const groupTeams: Record<string, [string, string, string, string]> = {
        A: ["wc-MEX", "wc-RSA", "wc-KOR", "wc-A4"],
        B: ["wc-CAN", "wc-SUI", "wc-QAT", "wc-B4"],
        C: ["wc-BRA", "wc-MAR", "wc-SCO", "wc-HAI"],
        D: ["wc-USA", "wc-PAR", "wc-AUS", "wc-D4"],
        E: ["wc-GER", "wc-ECU", "wc-CIV", "wc-CUW"],
        F: ["wc-NED", "wc-JPN", "wc-TUN", "wc-F4"],
        G: ["wc-BEL", "wc-IRN", "wc-EGY", "wc-NZL"],
        H: ["wc-ESP", "wc-URU", "wc-KSA", "wc-CPV"],
        I: ["wc-FRA", "wc-SEN", "wc-NOR", "wc-IRQ"],
        J: ["wc-ARG", "wc-AUT", "wc-ALG", "wc-JOR"],
        K: ["wc-POR", "wc-COL", "wc-UZB", "wc-K4"],
        L: ["wc-ENG", "wc-CRO", "wc-GHA", "wc-PAN"],
      };

      // Schedule per group: md1/md2 dates get 2 kickoff hours each; md3 is simultaneous (same hour for both games)
      const groupSchedule: Record<string, { md1: string; md2: string; md3: string; h1: number; h2: number; h3: number }> = {
        A: { md1: "2026-06-11", md2: "2026-06-17", md3: "2026-06-24", h1: 14, h2: 20, h3: 19 },
        B: { md1: "2026-06-11", md2: "2026-06-17", md3: "2026-06-24", h1: 17, h2: 23, h3: 22 },
        C: { md1: "2026-06-12", md2: "2026-06-18", md3: "2026-06-25", h1: 14, h2: 20, h3: 19 },
        D: { md1: "2026-06-12", md2: "2026-06-18", md3: "2026-06-25", h1: 17, h2: 23, h3: 22 },
        E: { md1: "2026-06-13", md2: "2026-06-19", md3: "2026-06-26", h1: 14, h2: 20, h3: 19 },
        F: { md1: "2026-06-13", md2: "2026-06-19", md3: "2026-06-26", h1: 17, h2: 23, h3: 22 },
        G: { md1: "2026-06-14", md2: "2026-06-20", md3: "2026-06-26", h1: 14, h2: 20, h3: 19 },
        H: { md1: "2026-06-14", md2: "2026-06-20", md3: "2026-06-26", h1: 17, h2: 23, h3: 22 },
        I: { md1: "2026-06-15", md2: "2026-06-21", md3: "2026-06-27", h1: 14, h2: 20, h3: 19 },
        J: { md1: "2026-06-15", md2: "2026-06-21", md3: "2026-06-27", h1: 17, h2: 23, h3: 22 },
        K: { md1: "2026-06-16", md2: "2026-06-22", md3: "2026-06-27", h1: 14, h2: 20, h3: 19 },
        L: { md1: "2026-06-16", md2: "2026-06-22", md3: "2026-06-27", h1: 17, h2: 23, h3: 22 },
      };

      const makeDate = (dateStr: string, hour: number): Date => {
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
      };

      const wcGames: InsertGame[] = [];

      for (const [group, sched] of Object.entries(groupSchedule)) {
        const [t1, t2, t3, t4] = groupTeams[group];
        const base = { sport: "WORLD_CUP", season, week: null, homeScore: null, awayScore: null, status: "scheduled", completedAt: null, period: null, wcRound: "group_stage", wcGroup: group } as const;

        // MD1: t1 v t4 (h1), t2 v t3 (h2)
        wcGames.push({ ...base, id: `wc-gs-${group}-md1-1`, homeTeamId: t1, awayTeamId: t4, gameDate: makeDate(sched.md1, sched.h1) });
        wcGames.push({ ...base, id: `wc-gs-${group}-md1-2`, homeTeamId: t2, awayTeamId: t3, gameDate: makeDate(sched.md1, sched.h2) });

        // MD2: t1 v t2 (h1), t3 v t4 (h2)
        wcGames.push({ ...base, id: `wc-gs-${group}-md2-1`, homeTeamId: t1, awayTeamId: t2, gameDate: makeDate(sched.md2, sched.h1) });
        wcGames.push({ ...base, id: `wc-gs-${group}-md2-2`, homeTeamId: t3, awayTeamId: t4, gameDate: makeDate(sched.md2, sched.h2) });

        // MD3: t1 v t3 (simultaneous h3), t2 v t4 (simultaneous h3)
        wcGames.push({ ...base, id: `wc-gs-${group}-md3-1`, homeTeamId: t1, awayTeamId: t3, gameDate: makeDate(sched.md3, sched.h3) });
        wcGames.push({ ...base, id: `wc-gs-${group}-md3-2`, homeTeamId: t2, awayTeamId: t4, gameDate: makeDate(sched.md3, sched.h3) });
      }

      await db.insert(games).values(wcGames).onConflictDoNothing();
      console.log(`World Cup group stage schedule seeded: ${wcGames.length} fixtures`);
    } catch (error) {
      console.error("Error initializing World Cup games:", error);
    }
  }

  async getAllWorldCupTeams(): Promise<WorldCupTeam[]> {
    return await db.select().from(worldCupTeams).orderBy(worldCupTeams.group, worldCupTeams.id);
  }

  async getWorldCupTeam(id: string): Promise<WorldCupTeam | undefined> {
    const [team] = await db.select().from(worldCupTeams).where(eq(worldCupTeams.id, id));
    return team || undefined;
  }

  async getWorldCupGames(): Promise<Game[]> {
    return await db.select().from(games).where(eq(games.sport, "WORLD_CUP")).orderBy(games.gameDate);
  }

  async getLeagueAnalytics(leagueId: string): Promise<{
    gamesProcessed: number;
    totalGames: number;
    players: Array<{ userId: string; displayName: string; currentWins: number; maxPossibleWins: number }>;
  }> {
    const league = await this.getLeague(leagueId);
    if (!league) return { gamesProcessed: 0, totalGames: 0, players: [] };

    // --- Games Processed ---
    // Full season totals: (numTeams × gamesPerTeam) / 2
    const SEASON_TOTAL_GAMES: Record<string, number> = { NFL: 272, MLB: 2430, NBA: 1230 };

    // Calendar-based season completion check — more reliable than team records
    // (team records can be stale if ESPN sync hasn't run for the final weeks).
    // NFL "YYYY-YY": season ends ~February of end year  → complete after March 1 of end year
    // MLB "YYYY":    season ends ~October of that year  → complete after November 1
    // NBA "YYYY-YY": season ends ~June of end year      → complete after August 1 of end year
    const isSeasonCalendarComplete = (sport: string, season: string): boolean => {
      const now = new Date();
      const startYear = parseInt(season.split('-')[0], 10);
      const endYear = season.includes('-') ? startYear + 1 : startYear;
      switch (sport) {
        case 'NFL': return now > new Date(endYear, 2, 1);   // after March 1 of end year
        case 'MLB': return now > new Date(endYear, 10, 1);  // after November 1 of season year
        case 'NBA': return now > new Date(endYear, 7, 1);   // after August 1 of end year
        default:    return false;
      }
    };
    const seasonComplete = isSeasonCalendarComplete(league.sport, league.season);

    let gamesProcessed = 0;
    let totalGames = 0;

    if (league.sport === 'WORLD_CUP') {
      // WC: use the games table (fully seeded and accurate)
      const allWCDbGames = await db.select({ id: games.id, status: games.status })
        .from(games)
        .where(and(eq(games.sport, 'WORLD_CUP'), eq(games.season, league.season)));
      totalGames = allWCDbGames.length;
      gamesProcessed = allWCDbGames.filter(g => g.status === 'completed').length;
    } else {
      totalGames = SEASON_TOTAL_GAMES[league.sport] || 0;
      if (seasonComplete) {
        gamesProcessed = totalGames; // season over → 100%
      } else if (league.sport === 'NFL') {
        const [row] = await db.select({ total: sql<number>`sum(wins + losses + ties)` }).from(nflTeams);
        gamesProcessed = Math.min(Math.floor((Number(row?.total) || 0) / 2), totalGames);
      } else if (league.sport === 'MLB') {
        const [row] = await db.select({ total: sql<number>`sum(wins + losses)` }).from(mlbTeams);
        gamesProcessed = Math.min(Math.floor((Number(row?.total) || 0) / 2), totalGames);
      } else if (league.sport === 'NBA') {
        const [row] = await db.select({ total: sql<number>`sum(wins + losses)` }).from(nbaTeams);
        gamesProcessed = Math.min(Math.floor((Number(row?.total) || 0) / 2), totalGames);
      }
    }

    const members = await db.select({ member: leagueMembers, user: users })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(eq(leagueMembers.leagueId, leagueId));

    const players: Array<{ userId: string; displayName: string; currentWins: number; maxPossibleWins: number }> = [];

    if (league.sport === 'WORLD_CUP') {
      const wcStandings = await this.getWorldCupPlayerStandings(leagueId);
      const allWCGames = (await this.getWorldCupGames()).filter(g => g.season === league.season);

      for (const s of wcStandings) {
        const picks = await this.getUserDraftPicks(leagueId, s.userId);
        const teamIds = picks.map(p => p.teamId!);

        let maxAdditional = 0;
        if (!seasonComplete) {
          for (const teamId of teamIds) {
            const teamIncompleteGames = allWCGames.filter(
              g => (g.homeTeamId === teamId || g.awayTeamId === teamId) && g.status !== 'completed'
            );
            for (const game of teamIncompleteGames) {
              if (game.wcRound === 'group_stage') {
                maxAdditional += 2;
              } else if (game.wcRound === 'third_place') {
                maxAdditional += 2;
              } else if (game.wcRound) {
                maxAdditional += 3;
              }
            }
          }
        }

        players.push({
          userId: s.userId,
          displayName: s.displayName,
          currentWins: s.fantasyPoints,
          maxPossibleWins: s.fantasyPoints + maxAdditional,
        });
      }
    } else {
      const gamesPerTeam: Record<string, number> = { NFL: 17, MLB: 162, NBA: 82 };
      const seasonTotal = gamesPerTeam[league.sport] || 0;

      for (const { user } of members) {
        const picks = await this.getUserDraftPicks(leagueId, user.id);
        const teams = await Promise.all(
          picks.map(pick => this.getTeamBySport(pick.teamId!, pick.sport!))
        );
        const validTeams = teams.filter((t): t is NFLTeam | MLBTeam | NBATeam => Boolean(t));

        const currentWins = validTeams.reduce((sum, t) => sum + (t.wins || 0), 0);

        let maxPossibleWins: number;
        if (seasonComplete) {
          // Season is over: no more games remain, max = current wins
          maxPossibleWins = currentWins;
        } else {
          maxPossibleWins = validTeams.reduce((sum, t) => {
            const gamesPlayed = (t.wins || 0) + (t.losses || 0) + ((t as NFLTeam).ties || 0);
            const remaining = Math.max(0, seasonTotal - gamesPlayed);
            return sum + (t.wins || 0) + remaining;
          }, 0);
        }

        players.push({ userId: user.id, displayName: user.displayName, currentWins, maxPossibleWins });
      }

      players.sort((a, b) => b.currentWins - a.currentWins);
    }

    return { gamesProcessed, totalGames, players };
  }

  async getWorldCupGroups(): Promise<Record<string, WCGroupStanding[]>> {
    const allTeams = await this.getAllWorldCupTeams();
    const allGames = await this.getWorldCupGames();
    const groupStageGames = allGames.filter((g) => g.wcRound === "group_stage" && g.status === "completed");

    const advancedTeamIds = new Set<string>();
    const knockoutGames = allGames.filter((g) => g.wcRound !== "group_stage" && g.wcRound !== null);
    for (const g of knockoutGames) {
      advancedTeamIds.add(g.homeTeamId);
      advancedTeamIds.add(g.awayTeamId);
    }

    const result: Record<string, WCGroupStanding[]> = {};

    for (const group of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
      const groupTeams = allTeams.filter((t) => t.group === group);
      const standings: WCGroupStanding[] = groupTeams.map((team) => {
        const teamGames = groupStageGames.filter(
          (g) => g.homeTeamId === team.id || g.awayTeamId === team.id
        );

        let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
        for (const g of teamGames) {
          const isHome = g.homeTeamId === team.id;
          const gf = isHome ? (g.homeScore || 0) : (g.awayScore || 0);
          const ga = isHome ? (g.awayScore || 0) : (g.homeScore || 0);
          goalsFor += gf;
          goalsAgainst += ga;
          if (gf > ga) wins++;
          else if (gf === ga) draws++;
          else losses++;
        }

        return {
          teamId: team.id,
          name: team.placeholder || team.name,
          abbreviation: team.abbreviation,
          flagEmoji: team.flagEmoji,
          played: wins + draws + losses,
          wins,
          draws,
          losses,
          goalsFor,
          goalsAgainst,
          goalDifference: goalsFor - goalsAgainst,
          points: wins * 3 + draws,
          advanced: advancedTeamIds.has(team.id),
        };
      });

      standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      });

      result[group] = standings;
    }

    return result;
  }

  async getWorldCupBracket(): Promise<Record<string, { homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null; status: string; gameDate: Date }[]>> {
    const allGames = await this.getWorldCupGames();
    const bracketRounds = ["round_of_32", "round_of_16", "quarterfinal", "semifinal", "third_place", "final"];
    const result: Record<string, any[]> = {};

    for (const round of bracketRounds) {
      const roundGames = allGames.filter((g) => g.wcRound === round);
      result[round] = roundGames.map((g) => ({
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status: g.status,
        gameDate: g.gameDate,
      }));
    }

    return result;
  }

  async calculateWorldCupPlayerPoints(): Promise<void> {
    try {
      const allLeagues = await db.select().from(leagues).where(eq(leagues.sport, "WORLD_CUP"));
      const allGames = await this.getWorldCupGames();

      for (const league of allLeagues) {
        const members = await this.getLeagueMembers(league.id);

        for (const member of members) {
          if (!member.userId) continue;
          const picks = await this.getUserDraftPicks(league.id, member.userId);
          const teamIds = picks.map((p) => p.teamId!);

          let points = 0;

          for (const teamId of teamIds) {
            const teamGames = allGames.filter(
              (g) => g.homeTeamId === teamId || g.awayTeamId === teamId
            );

            for (const g of teamGames) {
              if (g.status !== "completed") continue;
              const isHome = g.homeTeamId === teamId;
              const gf = isHome ? (g.homeScore || 0) : (g.awayScore || 0);
              const ga = isHome ? (g.awayScore || 0) : (g.homeScore || 0);

              if (g.wcRound === "group_stage") {
                if (gf > ga) points += 2;
                else if (gf === ga) points += 1;
              } else if (g.wcRound && g.wcRound !== "third_place") {
                if (gf > ga) points += 1 + 2;
                else if (g.wcRound === "round_of_32" || g.wcRound === "round_of_16" || g.wcRound === "quarterfinal" || g.wcRound === "semifinal" || g.wcRound === "final") {
                  points += 1;
                }
              }
            }
          }

          await db
            .update(leagueMembers)
            .set({ totalWins: points })
            .where(and(eq(leagueMembers.leagueId, league.id), eq(leagueMembers.userId, member.userId)));
        }
      }
    } catch (error) {
      console.error("Error calculating World Cup player points:", error);
    }
  }

  async getWorldCupPlayerStandings(leagueId: string): Promise<WCPlayerStanding[]> {
    const members = await db
      .select({ member: leagueMembers, user: users })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(eq(leagueMembers.leagueId, leagueId));

    const allGames = await this.getWorldCupGames();
    const completedGames = allGames.filter((g) => g.status === "completed");
    const knockoutGames = completedGames.filter((g) => g.wcRound && g.wcRound !== "group_stage" && g.wcRound !== "third_place");

    const standings: WCPlayerStanding[] = [];

    for (const { member, user } of members) {
      const picks = await this.getUserDraftPicks(leagueId, user.id);
      const teamIds = picks.map((p) => p.teamId!);

      const teams = await Promise.all(teamIds.map((id) => this.getWorldCupTeam(id)));
      const validTeams = teams.filter((t): t is WorldCupTeam => !!t);

      let fantasyPoints = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;
      let knockoutGoalsFor = 0;
      let knockoutGoalsAgainst = 0;

      for (const teamId of teamIds) {
        const teamGames = completedGames.filter(
          (g) => g.homeTeamId === teamId || g.awayTeamId === teamId
        );

        for (const g of teamGames) {
          const isHome = g.homeTeamId === teamId;
          const gf = isHome ? (g.homeScore || 0) : (g.awayScore || 0);
          const ga = isHome ? (g.awayScore || 0) : (g.homeScore || 0);

          goalsFor += gf;
          goalsAgainst += ga;

          const isKnockout = g.wcRound && g.wcRound !== "group_stage";
          if (isKnockout) {
            knockoutGoalsFor += gf;
            knockoutGoalsAgainst += ga;
          }

          if (g.wcRound === "group_stage") {
            if (gf > ga) fantasyPoints += 2;
            else if (gf === ga) fantasyPoints += 1;
          } else if (g.wcRound && g.wcRound !== "third_place") {
            fantasyPoints += 1;
            if (gf > ga) fantasyPoints += 2;
          }
        }
      }

      standings.push({
        userId: user.id,
        displayName: user.displayName,
        fantasyPoints,
        teams: validTeams,
        rank: 0,
        goalsFor,
        goalsAgainst,
        knockoutGoalsFor,
        knockoutGoalsAgainst,
      });
    }

    standings.sort((a, b) => {
      if (b.fantasyPoints !== a.fantasyPoints) return b.fantasyPoints - a.fantasyPoints;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (b.knockoutGoalsFor !== a.knockoutGoalsFor) return b.knockoutGoalsFor - a.knockoutGoalsFor;
      if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
      return a.knockoutGoalsAgainst - b.knockoutGoalsAgainst;
    });

    standings.forEach((s, i) => (s.rank = i + 1));

    return standings;
  }

  async getUpcomingGamesWithOwners(leagueId: string, limit: number, localDate?: string, tzOffset: number = 0): Promise<any[]> {
    // Get the league to determine sport
    const league = await this.getLeague(leagueId);
    if (!league) return [];
    
    // For MLB/NBA, get tomorrow's games only. For NFL, get upcoming scheduled games
    let upcomingGames;
    
    if (league.sport === 'WORLD_CUP') {
      // World Cup: tomorrow midnight → day+3 end-of-day (3-day window, date-based)
      // localDate is "tomorrow" sent by the frontend
      let windowStart: Date, windowEnd: Date;
      if (localDate) {
        const [year, month, day] = localDate.split('-').map(Number);
        const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
        windowStart = new Date(utcMidnight + tzOffset * 60 * 1000);
        windowEnd = new Date(windowStart.getTime() + 72 * 60 * 60 * 1000 - 1);
      } else {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        windowStart = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0));
        windowEnd = new Date(windowStart.getTime() + 72 * 60 * 60 * 1000 - 1);
      }
      upcomingGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.sport, "WORLD_CUP"),
          gte(games.gameDate, windowStart),
          lte(games.gameDate, windowEnd)
        ))
        .orderBy(games.gameDate)
        .limit(limit);
    } else if (league.sport === 'MLB' || league.sport === 'NBA') {
      // Compute the UTC window for the user's local "tomorrow"
      // localDate here is already tomorrow's date (YYYY-MM-DD) in user's timezone
      let tomorrowStart: Date, tomorrowEnd: Date;
      if (localDate) {
        const [year, month, day] = localDate.split('-').map(Number);
        const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
        tomorrowStart = new Date(utcMidnight + tzOffset * 60 * 1000);
        tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      } else {
        // Fallback: use server UTC date + 1 day
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        tomorrowStart = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0));
        tomorrowEnd = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 23, 59, 59));
      }
      
      upcomingGames = await db
        .select()
        .from(games)
        .where(and(
          eq(games.sport, league.sport),
          gte(games.gameDate, tomorrowStart),
          lte(games.gameDate, tomorrowEnd)
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