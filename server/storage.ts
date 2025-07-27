import { 
  type User, 
  type InsertUser, 
  type League, 
  type InsertLeague,
  type LeagueMember,
  type InsertLeagueMember,
  type NFLTeam,
  type DraftPick,
  type InsertDraftPick,
  type Game,
  type InsertGame,
  type PlayerStanding,
  type DraftStatus
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Leagues
  getLeague(id: string): Promise<League | undefined>;
  createLeague(league: InsertLeague): Promise<League>;
  updateLeague(id: string, updates: Partial<League>): Promise<League | undefined>;
  getUserLeagues(userId: string): Promise<League[]>;

  // League Members
  getLeagueMembers(leagueId: string): Promise<LeagueMember[]>;
  addLeagueMember(member: InsertLeagueMember): Promise<LeagueMember>;
  removeLeagueMember(leagueId: string, userId: string): Promise<boolean>;
  getPlayerStandings(leagueId: string): Promise<PlayerStanding[]>;

  // NFL Teams
  getAllNFLTeams(): Promise<NFLTeam[]>;
  getNFLTeam(id: string): Promise<NFLTeam | undefined>;
  updateTeamRecord(teamId: string, wins: number, losses: number, ties: number): Promise<void>;

  // Draft
  getDraftPicks(leagueId: string): Promise<DraftPick[]>;
  addDraftPick(pick: InsertDraftPick): Promise<DraftPick>;
  getDraftStatus(leagueId: string): Promise<DraftStatus>;
  getUserDraftPicks(leagueId: string, userId: string): Promise<DraftPick[]>;

  // Games
  getGames(week?: number, season?: string): Promise<Game[]>;
  updateGame(gameId: string, updates: Partial<Game>): Promise<Game | undefined>;
  addGame(game: InsertGame): Promise<Game>;
  getRecentCompletedGames(limit: number): Promise<Game[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private leagues: Map<string, League> = new Map();
  private leagueMembers: Map<string, LeagueMember> = new Map();
  private nflTeams: Map<string, NFLTeam> = new Map();
  private draftPicks: Map<string, DraftPick> = new Map();
  private games: Map<string, Game> = new Map();

  constructor() {
    this.initializeNFLTeams();
  }

  private initializeNFLTeams() {
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

    teams.forEach(team => {
      this.nflTeams.set(team.id, team);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date(),
      isAdmin: false,
      notifications: true
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getLeague(id: string): Promise<League | undefined> {
    return this.leagues.get(id);
  }

  async createLeague(insertLeague: InsertLeague): Promise<League> {
    const id = randomUUID();
    const league: League = {
      ...insertLeague,
      id,
      createdAt: new Date(),
      draftStatus: "pending",
      seasonStatus: "pre_season",
      sport: insertLeague.sport || "NFL",
      teamsPerPlayer: insertLeague.teamsPerPlayer || 4,
      maxPlayers: insertLeague.maxPlayers || 8
    };
    this.leagues.set(id, league);
    return league;
  }

  async updateLeague(id: string, updates: Partial<League>): Promise<League | undefined> {
    const league = this.leagues.get(id);
    if (!league) return undefined;
    
    const updatedLeague = { ...league, ...updates };
    this.leagues.set(id, updatedLeague);
    return updatedLeague;
  }

  async getUserLeagues(userId: string): Promise<League[]> {
    const userMemberships = Array.from(this.leagueMembers.values())
      .filter(member => member.userId === userId);
    
    return userMemberships
      .map(member => this.leagues.get(member.leagueId!))
      .filter(league => league !== undefined) as League[];
  }

  async getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
    return Array.from(this.leagueMembers.values())
      .filter(member => member.leagueId === leagueId);
  }

  async addLeagueMember(insertMember: InsertLeagueMember): Promise<LeagueMember> {
    const id = randomUUID();
    const member: LeagueMember = {
      ...insertMember,
      id,
      joinedAt: new Date(),
      totalWins: 0,
      userId: insertMember.userId || null,
      leagueId: insertMember.leagueId || null,
      draftPosition: insertMember.draftPosition || null
    };
    this.leagueMembers.set(id, member);
    return member;
  }

  async removeLeagueMember(leagueId: string, userId: string): Promise<boolean> {
    const member = Array.from(this.leagueMembers.values())
      .find(m => m.leagueId === leagueId && m.userId === userId);
    
    if (member) {
      this.leagueMembers.delete(member.id);
      return true;
    }
    return false;
  }

  async getPlayerStandings(leagueId: string): Promise<PlayerStanding[]> {
    const members = await this.getLeagueMembers(leagueId);
    const standings: PlayerStanding[] = [];

    for (const member of members) {
      const user = await this.getUser(member.userId!);
      const userPicks = await this.getUserDraftPicks(leagueId, member.userId!);
      const teams = userPicks.map(pick => this.nflTeams.get(pick.teamId!)).filter(Boolean) as NFLTeam[];
      const totalWins = teams.reduce((sum, team) => sum + (team.wins || 0), 0);

      if (user) {
        standings.push({
          userId: user.id,
          displayName: user.displayName,
          totalWins,
          teams,
          rank: 0 // Will be calculated after sorting
        });
      }
    }

    // Sort by total wins and assign ranks
    standings.sort((a, b) => b.totalWins - a.totalWins);
    standings.forEach((standing, index) => {
      standing.rank = index + 1;
    });

    return standings;
  }

  async getAllNFLTeams(): Promise<NFLTeam[]> {
    return Array.from(this.nflTeams.values());
  }

  async getNFLTeam(id: string): Promise<NFLTeam | undefined> {
    return this.nflTeams.get(id);
  }

  async updateTeamRecord(teamId: string, wins: number, losses: number, ties: number): Promise<void> {
    const team = this.nflTeams.get(teamId);
    if (team) {
      team.wins = wins;
      team.losses = losses;
      team.ties = ties;
      this.nflTeams.set(teamId, team);
    }
  }

  async getDraftPicks(leagueId: string): Promise<DraftPick[]> {
    return Array.from(this.draftPicks.values())
      .filter(pick => pick.leagueId === leagueId)
      .sort((a, b) => a.pickNumber - b.pickNumber);
  }

  async addDraftPick(insertPick: InsertDraftPick): Promise<DraftPick> {
    const id = randomUUID();
    const pick: DraftPick = {
      ...insertPick,
      id,
      pickedAt: new Date(),
      userId: insertPick.userId || null,
      leagueId: insertPick.leagueId || null,
      teamId: insertPick.teamId || null
    };
    this.draftPicks.set(id, pick);
    return pick;
  }

  async getDraftStatus(leagueId: string): Promise<DraftStatus> {
    const league = await this.getLeague(leagueId);
    const picks = await this.getDraftPicks(leagueId);
    const members = await this.getLeagueMembers(leagueId);
    
    const totalPicks = members.length * (league?.teamsPerPlayer || 4);
    const currentPick = picks.length + 1;
    const round = Math.ceil(currentPick / members.length);
    
    // Determine current player based on snake draft
    let currentPlayerIndex;
    if (round % 2 === 1) {
      // Odd rounds go 1, 2, 3, 4...
      currentPlayerIndex = ((currentPick - 1) % members.length);
    } else {
      // Even rounds go 4, 3, 2, 1...
      currentPlayerIndex = members.length - 1 - ((currentPick - 1) % members.length);
    }
    
    const currentPlayer = members[currentPlayerIndex];
    const currentUser = currentPlayer ? await this.getUser(currentPlayer.userId!) : null;

    return {
      isActive: league?.draftStatus === "active",
      currentPick,
      currentPlayer: currentUser?.displayName || "Unknown",
      round
    };
  }

  async getUserDraftPicks(leagueId: string, userId: string): Promise<DraftPick[]> {
    return Array.from(this.draftPicks.values())
      .filter(pick => pick.leagueId === leagueId && pick.userId === userId)
      .sort((a, b) => a.pickNumber - b.pickNumber);
  }

  async getGames(week?: number, season?: string): Promise<Game[]> {
    return Array.from(this.games.values())
      .filter(game => {
        if (week && game.week !== week) return false;
        if (season && game.season !== season) return false;
        return true;
      });
  }

  async updateGame(gameId: string, updates: Partial<Game>): Promise<Game | undefined> {
    const game = this.games.get(gameId);
    if (!game) return undefined;
    
    const updatedGame = { ...game, ...updates };
    this.games.set(gameId, updatedGame);
    return updatedGame;
  }

  async addGame(insertGame: InsertGame): Promise<Game> {
    const game: Game = { 
      ...insertGame,
      status: insertGame.status || "scheduled",
      homeTeamId: insertGame.homeTeamId || null,
      awayTeamId: insertGame.awayTeamId || null,
      homeScore: insertGame.homeScore || null,
      awayScore: insertGame.awayScore || null,
      completedAt: insertGame.completedAt || null
    };
    this.games.set(game.id, game);
    return game;
  }

  async getRecentCompletedGames(limit: number): Promise<Game[]> {
    return Array.from(this.games.values())
      .filter(game => game.status === "completed")
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
