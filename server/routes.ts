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

  // Update user profile
  app.put("/api/users/:id/profile", async (req, res) => {
    try {
      const profileData = req.body;
      const user = await storage.updateUser(req.params.id, profileData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid profile data" });
    }
  });

  // Change password
  app.put("/api/users/:id/password", async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Get current user to verify password
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      if (user.password !== currentPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Update password
      const updatedUser = await storage.updateUser(req.params.id, { password: newPassword });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid password change request" });
    }
  });

  // Change email
  app.put("/api/users/:id/email", async (req, res) => {
    try {
      const { currentPassword, newEmail } = req.body;
      
      // Get current user to verify password
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password for security
      if (user.password !== currentPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(newEmail);
      if (existingUser && existingUser.id !== req.params.id) {
        return res.status(400).json({ message: "This email address is already in use" });
      }
      
      // Update email
      const updatedUser = await storage.updateUser(req.params.id, { email: newEmail });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update email" });
      }
      
      res.json({ ...updatedUser, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid email change request" });
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
    try {
      // Check if league exists and get its draft status
      const league = await storage.getLeague(req.params.leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Prevent removing players once draft has started
      if (league.draftStatus === "active") {
        return res.status(400).json({ 
          message: "Cannot remove players from league once the draft has started" 
        });
      }

      const success = await storage.removeLeagueMember(req.params.leagueId, req.params.userId);
      if (!success) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member from league" });
    }
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
      
      // Send draft notification to the next player
      try {
        const draftStatus = await storage.getDraftStatus(req.params.leagueId);
        if (draftStatus.isActive && draftStatus.currentPlayer) {
          const league = await storage.getLeague(req.params.leagueId);
          const members = await storage.getLeagueMembers(req.params.leagueId);
          
          // Find the current player based on draft status
          const picks = await storage.getDraftPicks(req.params.leagueId);
          const currentPickNumber = picks.length + 1;
          const round = Math.ceil(currentPickNumber / members.length);
          const positionInRound = ((currentPickNumber - 1) % members.length) + 1;
          const isSnakeRound = round % 2 === 0;
          const draftPosition = isSnakeRound ? members.length - positionInRound + 1 : positionInRound;
          
          const currentMember = members.find(m => m.draftPosition === draftPosition);
          if (currentMember) {
            const currentUser = await storage.getUser(currentMember.userId!);
            if (currentUser && currentUser.draftNotifications) {
              console.log(`Sending draft notification to ${currentUser.email} for league ${league?.name}`);
              
              // Send email notification
              const { EmailService } = await import('./services/emailService.js');
              const emailService = new EmailService();
              await emailService.sendDraftNotification(
                currentUser.email!,
                currentUser.displayName!,
                league?.name || 'League',
                draftStatus.currentPick,
                draftStatus.round,
                req.params.leagueId
              );

              // Send push notification
              const { pushNotificationService } = await import('./services/pushNotificationService.js');
              await pushNotificationService.sendDraftTurnNotification(
                currentUser.id,
                league?.name || 'League',
                req.params.leagueId
              );
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send draft notification:', emailError);
        // Don't fail the pick if email fails
      }
      
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
    const localDate = req.query.localDate as string | undefined;
    const tzOffset = req.query.tzOffset ? parseInt(req.query.tzOffset as string) : 0;
    const games = await storage.getRecentGamesWithOwners(req.params.leagueId, limit, localDate, tzOffset);
    res.json(games);
  });

  app.get("/api/leagues/:leagueId/games/upcoming", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const localDate = req.query.localDate as string | undefined;
    const tzOffset = req.query.tzOffset ? parseInt(req.query.tzOffset as string) : 0;
    const games = await storage.getUpcomingGamesWithOwners(req.params.leagueId, limit, localDate, tzOffset);
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

  // Import email route handlers
  const { 
    sendLeagueInvite, 
    sendDraftNotification, 
    updateNotificationPreferences, 
    getNotificationPreferences,
    testEmail
  } = await import("./routes/email");

  // Email routes
  app.post("/api/email/invite", sendLeagueInvite);
  app.post("/api/email/draft-notification", sendDraftNotification);
  // League-specific notification preferences
  app.get("/api/leagues/:leagueId/members/:userId/notification-preferences", async (req, res) => {
    try {
      const member = await storage.getLeagueMember(req.params.leagueId, req.params.userId);
      if (!member) {
        return res.status(404).json({ message: "League member not found" });
      }
      
      res.json({
        draftNotifications: member.draftNotifications ?? true,
        gameNotifications: member.gameNotifications ?? false,
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to get notification preferences" });
    }
  });

  app.put("/api/leagues/:leagueId/members/:userId/notification-preferences", async (req, res) => {
    try {
      const updates = req.body;
      const success = await storage.updateLeagueMemberPreferences(
        req.params.leagueId, 
        req.params.userId, 
        updates
      );
      
      if (!success) {
        return res.status(404).json({ message: "League member not found" });
      }
      
      const member = await storage.getLeagueMember(req.params.leagueId, req.params.userId);
      res.json({
        draftNotifications: member?.draftNotifications ?? true,
        gameNotifications: member?.gameNotifications ?? false,
      });
    } catch (error) {
      res.status(400).json({ message: "Failed to update notification preferences" });
    }
  });

  app.put("/api/users/:userId/notification-preferences", async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(userId, preferences);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update preferences" });
      }

      res.json({
        draftNotifications: updatedUser.draftNotifications,
        standingsNotifications: updatedUser.standingsNotifications,
      });
    } catch (error) {
      console.error("Error updating user notification preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });
  
  app.get("/api/users/:userId/notification-preferences", getNotificationPreferences);
  app.post("/api/admin/test-email", testEmail);

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

  // League-specific draft start endpoint (called by client)
  app.post("/api/leagues/:leagueId/draft/start", async (req, res) => {
    try {
      const { leagueId } = req.params;
      
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }
      
      // Validate player count matches draft configuration
      const league = await storage.getLeague(leagueId);
      if (league?.draftConfiguration) {
        const { getDraftConfigByKey } = await import('../shared/draftConfig.js');
        const config = getDraftConfigByKey(league.draftConfiguration);
        if (config) {
          const members = await storage.getLeagueMembers(leagueId);
          const expectedPlayerCount = config.players;
          const actualPlayerCount = members.length;
          
          if (expectedPlayerCount !== actualPlayerCount) {
            return res.status(400).json({ 
              error: `Player count mismatch: Expected ${expectedPlayerCount} players for "${config.label}" but found ${actualPlayerCount} players in league. Please adjust the player count or change the draft configuration.` 
            });
          }
        }
      }
      
      await storage.updateLeague(leagueId, { draftStatus: "active" });

      // Send draft notification to the first player
      try {
        const draftStatus = await storage.getDraftStatus(leagueId);
        if (draftStatus.isActive && draftStatus.currentPlayer) {
          const members = await storage.getLeagueMembers(leagueId);
          const currentMember = members.find(m => m.draftPosition === 1);
          if (currentMember) {
            const currentUser = await storage.getUser(currentMember.userId!);
            if (currentUser && currentUser.draftNotifications) {
              console.log(`Sending draft notification to ${currentUser.email} for league ${league?.name}`);
              
              // Send email notification
              const { EmailService } = await import('./services/emailService.js');
              const emailService = new EmailService();
              await emailService.sendDraftNotification(
                currentUser.email!,
                currentUser.displayName!,
                league?.name || 'League',
                draftStatus.currentPick,
                draftStatus.round,
                leagueId
              );

              // Send push notification
              const { pushNotificationService } = await import('./services/pushNotificationService.js');
              await pushNotificationService.sendDraftTurnNotification(
                currentUser.id,
                league?.name || 'League',
                leagueId
              );
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send draft start notification:', emailError);
        // Don't fail the draft start if email fails
      }
      
      res.json({ success: true, message: "Draft started successfully" });
    } catch (error) {
      console.error("Error starting draft:", error);
      res.status(500).json({ error: "Failed to start draft" });
    }
  });

  app.post("/api/admin/start-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }
      
      // Validate player count matches draft configuration
      const league = await storage.getLeague(leagueId);
      if (league?.draftConfiguration) {
        const { getDraftConfigByKey } = await import('../shared/draftConfig.js');
        const config = getDraftConfigByKey(league.draftConfiguration);
        if (config) {
          const members = await storage.getLeagueMembers(leagueId);
          const expectedPlayerCount = config.players;
          const actualPlayerCount = members.length;
          
          if (expectedPlayerCount !== actualPlayerCount) {
            return res.status(400).json({ 
              error: `Player count mismatch: Expected ${expectedPlayerCount} players for "${config.label}" but found ${actualPlayerCount} players in league. Please adjust the player count or change the draft configuration.` 
            });
          }
        }
      }
      
      await storage.updateLeague(leagueId, { draftStatus: "active" });
      
      // Send draft notification to the first player
      try {
        const draftStatus = await storage.getDraftStatus(leagueId);
        if (draftStatus.isActive && draftStatus.currentPlayer) {
          const league = await storage.getLeague(leagueId);
          const members = await storage.getLeagueMembers(leagueId);
          const currentMember = members.find(m => m.draftPosition === 1);
          if (currentMember) {
            const currentUser = await storage.getUser(currentMember.userId!);
            if (currentUser && currentUser.draftNotifications) {
              console.log(`Sending draft notification to ${currentUser.email} for league ${league?.name}`);
              
              // Send email notification
              const { EmailService } = await import('./services/emailService.js');
              const emailService = new EmailService();
              await emailService.sendDraftNotification(
                currentUser.email!,
                currentUser.displayName!,
                league?.name || 'League',
                draftStatus.currentPick,
                draftStatus.round,
                leagueId
              );

              // Send push notification
              const { pushNotificationService } = await import('./services/pushNotificationService.js');
              await pushNotificationService.sendDraftTurnNotification(
                currentUser.id,
                league?.name || 'League',
                leagueId
              );
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send draft start notification:', emailError);
        // Don't fail the draft start if email fails
      }
      
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
      await sportsService.updateMLBStandings();
      const result = { success: true, message: "MLB standings updated successfully" };
      
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

  // Push notification routes
  app.get("/api/push/vapid-key", async (req, res) => {
    const { pushNotificationService } = await import("./services/pushNotificationService");
    res.json({ 
      publicKey: pushNotificationService.getVapidPublicKey() 
    });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { userId, subscription } = req.body;
      
      if (!userId || !subscription) {
        return res.status(400).json({ message: "User ID and subscription required" });
      }

      const { pushNotificationService } = await import("./services/pushNotificationService");
      await pushNotificationService.subscribeUser(userId, subscription);
      
      res.json({ message: "Successfully subscribed to push notifications" });
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      res.status(500).json({ message: "Failed to subscribe to push notifications" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const { pushNotificationService } = await import("./services/pushNotificationService");
      await pushNotificationService.unsubscribeUser(userId);
      
      res.json({ message: "Successfully unsubscribed from push notifications" });
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      res.status(500).json({ message: "Failed to unsubscribe from push notifications" });
    }
  });

  const httpServer = createServer(app);

  // Set up periodic score updates (every 30 minutes during season)
  setInterval(async () => {
    try {
      await sportsApi.syncGamesForWeek(3, "2025"); // Current week - 2025-26 NFL season
      console.log("Automatic NFL score sync completed");
    } catch (error) {
      console.error("Automatic NFL score sync failed:", error);
    }
  }, 30 * 60 * 1000); // 30 minutes

  return httpServer;
}
