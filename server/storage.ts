import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "./db";
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
  type DraftStatus,
  users,
  leagues,
  leagueMembers,
  nflTeams,
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
    this.initializeDemoLeagues();
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

  private async initializeDemoLeagues() {
    try {
      // Check if demo leagues already exist
      const existingLeagues = await db.select().from(leagues).limit(1);
      if (existingLeagues.length > 0) {
        return; // Leagues already initialized
      }

      // Create demo leagues
      const demoLeagues = [
        {
          id: "demo-league-1",
          name: "Champions League",
          season: "2024-25",
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
          season: "2024-25",
          sport: "NFL",
          teamsPerPlayer: 4,
          maxPlayers: 6,
          draftStatus: "completed",
          seasonStatus: "active",
          createdBy: "62f5c618-a04f-4b08-92e6-f7266c4ed7be",
        },
        {
          id: "demo-league-3",
          name: "Fantasy Friends",
          season: "2024-25", 
          sport: "NFL",
          teamsPerPlayer: 3,
          maxPlayers: 10,
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
        { id: "player-8", email: "steve@demo.com", password: "demo", firstName: "Steve", lastName: "Rodriguez", displayName: "Steve R" }
      ];

      await db.insert(users).values(additionalPlayers);

      // Add these players to the Champions League
      const additionalMemberships = additionalPlayers.map((player, index) => ({
        leagueId: "demo-league-1",
        userId: player.id,
        draftPosition: index + 2,
        totalWins: 0
      }));

      await db.insert(leagueMembers).values(additionalMemberships);

      // Add realistic draft picks for each player (4 teams each)
      const demoDraftPicks = [
        // Player 1 (main user) - High performing teams
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "DET", pickNumber: 1, round: 1 },
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "MIN", pickNumber: 16, round: 2 },
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "BUF", pickNumber: 17, round: 3 },
        { leagueId: "demo-league-1", userId: "62f5c618-a04f-4b08-92e6-f7266c4ed7be", teamId: "WAS", pickNumber: 32, round: 4 },

        // Player 2 - Mike J
        { leagueId: "demo-league-1", userId: "player-2", teamId: "KC", pickNumber: 2, round: 1 },
        { leagueId: "demo-league-1", userId: "player-2", teamId: "PHI", pickNumber: 15, round: 2 },
        { leagueId: "demo-league-1", userId: "player-2", teamId: "HOU", pickNumber: 18, round: 3 },
        { leagueId: "demo-league-1", userId: "player-2", teamId: "GB", pickNumber: 31, round: 4 },

        // Player 3 - Sarah D
        { leagueId: "demo-league-1", userId: "player-3", teamId: "PIT", pickNumber: 3, round: 1 },
        { leagueId: "demo-league-1", userId: "player-3", teamId: "BAL", pickNumber: 14, round: 2 },
        { leagueId: "demo-league-1", userId: "player-3", teamId: "TB", pickNumber: 19, round: 3 },
        { leagueId: "demo-league-1", userId: "player-3", teamId: "LAR", pickNumber: 30, round: 4 },

        // Player 4 - Tom W
        { leagueId: "demo-league-1", userId: "player-4", teamId: "LAC", pickNumber: 4, round: 1 },
        { leagueId: "demo-league-1", userId: "player-4", teamId: "SEA", pickNumber: 13, round: 2 },
        { leagueId: "demo-league-1", userId: "player-4", teamId: "DEN", pickNumber: 20, round: 3 },
        { leagueId: "demo-league-1", userId: "player-4", teamId: "ATL", pickNumber: 29, round: 4 },

        // Player 5 - Lisa B
        { leagueId: "demo-league-1", userId: "player-5", teamId: "CIN", pickNumber: 5, round: 1 },
        { leagueId: "demo-league-1", userId: "player-5", teamId: "ARI", pickNumber: 12, round: 2 },
        { leagueId: "demo-league-1", userId: "player-5", teamId: "MIA", pickNumber: 21, round: 3 },
        { leagueId: "demo-league-1", userId: "player-5", teamId: "IND", pickNumber: 28, round: 4 },

        // Player 6 - James M
        { leagueId: "demo-league-1", userId: "player-6", teamId: "NYJ", pickNumber: 6, round: 1 },
        { leagueId: "demo-league-1", userId: "player-6", teamId: "SF", pickNumber: 11, round: 2 },
        { leagueId: "demo-league-1", userId: "player-6", teamId: "LV", pickNumber: 22, round: 3 },
        { leagueId: "demo-league-1", userId: "player-6", teamId: "NE", pickNumber: 27, round: 4 },

        // Player 7 - Amy G
        { leagueId: "demo-league-1", userId: "player-7", teamId: "CLE", pickNumber: 7, round: 1 },
        { leagueId: "demo-league-1", userId: "player-7", teamId: "CHI", pickNumber: 10, round: 2 },
        { leagueId: "demo-league-1", userId: "player-7", teamId: "CAR", pickNumber: 23, round: 3 },
        { leagueId: "demo-league-1", userId: "player-7", teamId: "NYG", pickNumber: 26, round: 4 },

        // Player 8 - Steve R
        { leagueId: "demo-league-1", userId: "player-8", teamId: "DAL", pickNumber: 8, round: 1 },
        { leagueId: "demo-league-1", userId: "player-8", teamId: "NO", pickNumber: 9, round: 2 },
        { leagueId: "demo-league-1", userId: "player-8", teamId: "TEN", pickNumber: 24, round: 3 },
        { leagueId: "demo-league-1", userId: "player-8", teamId: "JAX", pickNumber: 25, round: 4 }
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

  async getPlayerStandings(leagueId: string): Promise<PlayerStanding[]> {
    const members = await db
      .select({
        member: leagueMembers,
        user: users,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(eq(leagueMembers.leagueId, leagueId));

    const standings: PlayerStanding[] = [];

    for (const { member, user } of members) {
      const userPicks = await this.getUserDraftPicks(leagueId, user.id);
      const teams = await Promise.all(
        userPicks.map(pick => this.getNFLTeam(pick.teamId!))
      );
      const validTeams = teams.filter(Boolean) as NFLTeam[];
      const totalWins = validTeams.reduce((sum, team) => sum + (team.wins || 0), 0);

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

  // NFL team methods
  async getAllNFLTeams(): Promise<NFLTeam[]> {
    return await db.select().from(nflTeams);
  }

  async getNFLTeam(id: string): Promise<NFLTeam | undefined> {
    const [team] = await db.select().from(nflTeams).where(eq(nflTeams.id, id));
    return team || undefined;
  }

  async updateTeamRecord(teamId: string, wins: number, losses: number, ties: number = 0): Promise<void> {
    await db.update(nflTeams).set({ wins, losses, ties }).where(eq(nflTeams.id, teamId));
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
    const [game] = await db.insert(games).values(insertGame).returning();
    return game;
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
    const recentGames = await this.getRecentCompletedGames(limit);
    
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
    const upcomingGames = await db
      .select()
      .from(games)
      .where(eq(games.status, "scheduled"))
      .orderBy(games.gameDate)
      .limit(limit);
    
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