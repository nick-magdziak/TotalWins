import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sportsApi } from "./services/sportsApi";
import { insertUserSchema, insertLeagueSchema, insertDraftPickSchema, leagues } from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
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
    const league = await storage.getLeague(req.params.leagueId);
    
    const picksWithDetails = await Promise.all(
      picks.map(async (pick) => {
        const user = await storage.getUser(pick.userId!);
        let team;
        
        // Get team based on league sport
        switch (league?.sport) {
          case 'MLB':
            team = await storage.getMLBTeam(pick.teamId!);
            break;
          case 'NBA':
            team = await storage.getNBATeam(pick.teamId!);
            break;
          default:
            team = await storage.getNFLTeam(pick.teamId!);
            break;
        }
        
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
    const league = await storage.getLeague(req.params.leagueId);
    
    const picksWithTeams = await Promise.all(
      picks.map(async (pick) => {
        let team;
        
        // Get team based on league sport
        switch (league?.sport) {
          case 'MLB':
            team = await storage.getMLBTeam(pick.teamId!);
            break;
          case 'NBA':
            team = await storage.getNBATeam(pick.teamId!);
            break;
          default:
            team = await storage.getNFLTeam(pick.teamId!);
            break;
        }
        
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
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const games = await storage.getRecentGamesWithOwners(req.params.leagueId, limit);
    res.json(games);
  });

  app.get("/api/leagues/:leagueId/games/upcoming", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
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

  app.post("/api/admin/sync-mlb-games", async (req, res) => {
    try {
      await sportsApi.syncMLBGames();
      res.json({ message: "MLB games synced successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync MLB games" });
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

  app.post("/api/admin/update-privileges", async (req, res) => {
    try {
      const { userId, isAdmin } = req.body;
      
      if (!userId || typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: "Invalid request data" });
      }
      
      await storage.updateUserPrivileges(userId, isAdmin);
      
      res.json({ success: true, message: "Privileges updated successfully" });
    } catch (error) {
      console.error("Error updating privileges:", error);
      res.status(500).json({ error: "Failed to update privileges" });
    }
  });

  app.post("/api/admin/remove-player", async (req, res) => {
    try {
      const { leagueId, userId } = req.body;
      
      if (!leagueId || !userId) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      
      const success = await storage.removeLeagueMember(leagueId, userId);
      
      if (success) {
        res.json({ success: true, message: "Player removed successfully" });
      } else {
        res.status(404).json({ error: "Player not found in league" });
      }
    } catch (error) {
      console.error("Error removing player:", error);
      res.status(500).json({ error: "Failed to remove player" });
    }
  });

  app.post("/api/admin/reset-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      
      await storage.resetDraft(leagueId);
      
      res.json({ success: true, message: "Draft reset successfully" });
    } catch (error) {
      console.error("Error resetting draft:", error);
      res.status(500).json({ error: "Failed to reset draft" });
    }
  });

  app.post("/api/admin/start-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }
      
      await storage.updateLeague(leagueId, { draftStatus: "active" });
      
      res.json({ success: true, message: "Draft started successfully" });
    } catch (error) {
      console.error("Error starting draft:", error);
      res.status(500).json({ error: "Failed to start draft" });
    }
  });

  app.post("/api/admin/stop-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }
      
      await storage.updateLeague(leagueId, { draftStatus: "pending" });
      
      res.json({ success: true, message: "Draft stopped successfully" });
    } catch (error) {
      console.error("Error stopping draft:", error);
      res.status(500).json({ error: "Failed to stop draft" });
    }
  });

  app.post("/api/admin/undo-last-pick", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      
      const success = await storage.undoLastDraftPick(leagueId);
      
      if (success) {
        res.json({ success: true, message: "Last pick undone successfully" });
      } else {
        res.status(404).json({ error: "No picks to undo" });
      }
    } catch (error) {
      console.error("Error undoing last pick:", error);
      res.status(500).json({ error: "Failed to undo last pick" });
    }
  });

  // Draft start endpoint for draft page
  app.post("/api/leagues/:leagueId/draft/start", async (req, res) => {
    try {
      const { leagueId } = req.params;
      
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }
      
      // Update league draft status to active
      await storage.updateLeague(leagueId, { draftStatus: "active" });
      
      res.json({ success: true, message: "Draft started successfully" });
    } catch (error) {
      console.error("Error starting draft:", error);
      res.status(500).json({ error: "Failed to start draft" });
    }
  });

  // Multi-sport team endpoints
  app.get("/api/nfl/teams", async (req, res) => {
    const teams = await storage.getAllNFLTeams();
    res.json(teams);
  });

  app.get("/api/mlb/teams", async (req, res) => {
    const teams = await storage.getAllMLBTeams();
    res.json(teams);
  });

  app.get("/api/nba/teams", async (req, res) => {
    const teams = await storage.getAllNBATeams();
    res.json(teams);
  });

  // ESPN API integration endpoints
  app.post("/api/admin/update-mlb-standings", async (req, res) => {
    try {
      const { SportsDataService } = await import("./sportsDataService");
      const sportsService = new SportsDataService(storage);
      const result = await sportsService.triggerMLBUpdate();
      
      if (result.success) {
        res.json({ message: result.message });
      } else {
        res.status(500).json({ message: result.message });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to update MLB standings" });
    }
  });

  // Live scoring system endpoint
  app.post("/api/admin/sync-live-scores", async (req, res) => {
    try {
      const { SportsDataService } = await import("./sportsDataService");
      const sportsService = new SportsDataService(storage);
      
      // Update MLB standings with live 2025 season data
      await sportsService.updateMLBStandings();
      
      res.json({ 
        message: "Live scores synced successfully",
        timestamp: new Date().toISOString(),
        season: "2025"
      });
    } catch (error) {
      console.error("Live scoring sync error:", error);
      res.status(500).json({ message: "Failed to sync live scores" });
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
