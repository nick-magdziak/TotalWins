import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sportsApi } from "./services/sportsApi";
import { insertUserSchema, insertLeagueSchema, insertDraftPickSchema } from "@shared/schema";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      const user = await storage.createUser(userData);
      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  // Users
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ ...user, password: undefined });
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // Leagues
  app.post("/api/leagues", async (req, res) => {
    try {
      const leagueData = insertLeagueSchema.parse(req.body);
      const league = await storage.createLeague(leagueData);
      
      // Add creator as first member and admin
      await storage.addLeagueMember({
        leagueId: league.id,
        userId: leagueData.createdBy!,
        draftPosition: 1,
        totalWins: 0
      });
      
      res.json(league);
    } catch (error) {
      res.status(400).json({ message: "Invalid league data" });
    }
  });

  app.get("/api/leagues/:id", async (req, res) => {
    const league = await storage.getLeague(req.params.id);
    if (!league) {
      return res.status(404).json({ message: "League not found" });
    }
    res.json(league);
  });

  app.patch("/api/leagues/:id", async (req, res) => {
    try {
      const updates = req.body;
      const league = await storage.updateLeague(req.params.id, updates);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      res.json(league);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.get("/api/users/:userId/leagues", async (req, res) => {
    const leagues = await storage.getUserLeagues(req.params.userId);
    res.json(leagues);
  });

  // League Members
  app.get("/api/leagues/:leagueId/members", async (req, res) => {
    const members = await storage.getLeagueMembers(req.params.leagueId);
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const user = await storage.getUser(member.userId!);
        return {
          ...member,
          user: user ? { ...user, password: undefined } : null
        };
      })
    );
    res.json(membersWithUsers);
  });

  app.post("/api/leagues/:leagueId/members", async (req, res) => {
    try {
      const { userId } = req.body;
      const member = await storage.addLeagueMember({
        leagueId: req.params.leagueId,
        userId,
        totalWins: 0
      });
      res.json(member);
    } catch (error) {
      res.status(400).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/leagues/:leagueId/members/:userId", async (req, res) => {
    const success = await storage.removeLeagueMember(req.params.leagueId, req.params.userId);
    if (!success) {
      return res.status(404).json({ message: "Member not found" });
    }
    res.json({ success: true });
  });

  // Standings
  app.get("/api/leagues/:leagueId/standings", async (req, res) => {
    const standings = await storage.getPlayerStandings(req.params.leagueId);
    res.json(standings);
  });

  // NFL Teams
  app.get("/api/teams", async (req, res) => {
    const teams = await storage.getAllNFLTeams();
    res.json(teams);
  });

  app.get("/api/teams/:id", async (req, res) => {
    const team = await storage.getNFLTeam(req.params.id);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json(team);
  });

  // Draft
  app.get("/api/leagues/:leagueId/draft/picks", async (req, res) => {
    const picks = await storage.getDraftPicks(req.params.leagueId);
    const picksWithDetails = await Promise.all(
      picks.map(async (pick) => {
        const user = await storage.getUser(pick.userId!);
        const team = await storage.getNFLTeam(pick.teamId!);
        return {
          ...pick,
          user: user ? { ...user, password: undefined } : null,
          team
        };
      })
    );
    res.json(picksWithDetails);
  });

  app.post("/api/leagues/:leagueId/draft/picks", async (req, res) => {
    try {
      const pickData = insertDraftPickSchema.parse({
        ...req.body,
        leagueId: req.params.leagueId
      });
      
      const pick = await storage.addDraftPick(pickData);
      res.json(pick);
    } catch (error) {
      res.status(400).json({ message: "Invalid draft pick data" });
    }
  });

  app.get("/api/leagues/:leagueId/draft/status", async (req, res) => {
    const status = await storage.getDraftStatus(req.params.leagueId);
    res.json(status);
  });

  app.get("/api/leagues/:leagueId/users/:userId/picks", async (req, res) => {
    const picks = await storage.getUserDraftPicks(req.params.leagueId, req.params.userId);
    const picksWithTeams = await Promise.all(
      picks.map(async (pick) => {
        const team = await storage.getNFLTeam(pick.teamId!);
        return { ...pick, team };
      })
    );
    res.json(picksWithTeams);
  });

  // Games
  app.get("/api/games", async (req, res) => {
    const week = req.query.week ? parseInt(req.query.week as string) : undefined;
    const season = req.query.season as string;
    const games = await storage.getGames(week, season);
    res.json(games);
  });

  app.get("/api/games/recent", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const games = await storage.getRecentCompletedGames(limit);
    res.json(games);
  });

  app.get("/api/leagues/:leagueId/games/recent", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const games = await storage.getRecentGamesWithOwners(req.params.leagueId, limit);
    res.json(games);
  });

  app.get("/api/leagues/:leagueId/games/upcoming", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const games = await storage.getUpcomingGamesWithOwners(req.params.leagueId, limit);
    res.json(games);
  });

  // Admin endpoints
  app.post("/api/admin/sync-scores", async (req, res) => {
    try {
      const { week = 18, season = "2024" } = req.body;
      await sportsApi.syncGamesForWeek(week, season);
      res.json({ message: "Scores synced successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync scores" });
    }
  });

  app.post("/api/admin/update-records", async (req, res) => {
    try {
      await sportsApi.updateTeamRecords();
      res.json({ message: "Team records updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update team records" });
    }
  });

  app.post("/api/admin/invite-player", async (req, res) => {
    try {
      const { email, leagueId } = req.body;
      const { sendLeagueInvitation } = await import("./services/emailService");
      
      // In a real app, you'd generate a proper invite link with a token
      const success = await sendLeagueInvitation(
        email,
        "League Admin", // You'd get this from the requesting user
        "2024 NFL Wins Pool Championship"
      );
      
      if (success) {
        res.json({ message: "Invitation sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send invitation" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  const httpServer = createServer(app);

  // Set up periodic score updates (every 30 minutes during season)
  setInterval(async () => {
    try {
      await sportsApi.syncGamesForWeek(18, "2024"); // Current week
      console.log("Automatic score sync completed");
    } catch (error) {
      console.error("Automatic score sync failed:", error);
    }
  }, 30 * 60 * 1000); // 30 minutes

  return httpServer;
}
