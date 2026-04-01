import { Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { users, leagues, leagueMembers, draftPicks } from "@shared/schema";
// Draft order calculation helper
function getDraftOrder(configuration: string): number[] {
  // For now, return a simple sequential order - this can be enhanced later
  switch (configuration) {
    case "4_players_8_teams":
      return Array.from({ length: 32 }, (_, i) => i + 1);
    case "6_players_5_teams":
      return Array.from({ length: 30 }, (_, i) => i + 1);
    case "8_players_3_teams":
      return Array.from({ length: 24 }, (_, i) => i + 1);
    default:
      return Array.from({ length: 32 }, (_, i) => i + 1);
  }
}
import { nanoid } from "nanoid";

// Send league invitation
export async function sendLeagueInvite(req: Request, res: Response) {
  try {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      leagueId: z.string(),
    });

    const { email, name, leagueId } = schema.parse(req.body);

    // Get league info
    const league = await storage.getLeague(leagueId);
    if (!league) {
      return res.status(404).json({ message: "League not found" });
    }

    // Get admin user
    const admin = await storage.getUser(league.createdBy!);
    if (!admin) {
      return res.status(404).json({ message: "League admin not found" });
    }

    // Generate invite code if none exists
    let inviteCode = league.inviteCode;
    if (!inviteCode) {
      inviteCode = nanoid(8).toUpperCase();
      await storage.updateLeague(leagueId, { inviteCode });
    }

    // Send invitation email
    const success = await emailService.sendLeagueInvitation(
      email,
      name,
      league.name,
      admin.displayName,
      inviteCode,
      league.sport
    );

    if (success) {
      res.json({ message: "Invitation sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send invitation" });
    }
  } catch (error) {
    console.error("Send invite error:", error);
    res.status(400).json({ message: "Invalid request" });
  }
}

// Send draft notification
export async function sendDraftNotification(req: Request, res: Response) {
  try {
    const schema = z.object({
      leagueId: z.string(),
      userId: z.string(),
    });

    const { leagueId, userId } = schema.parse(req.body);

    // Get league info
    const league = await storage.getLeague(leagueId);
    if (!league) {
      return res.status(404).json({ message: "League not found" });
    }

    // Get user info
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user wants draft notifications
    if (!user.draftNotifications) {
      return res.json({ message: "User has disabled draft notifications" });
    }

    // Get current draft status
    const picks = await storage.getDraftPicks(leagueId);
    const members = await storage.getLeagueMembers(leagueId);
    const draftOrder = getDraftOrder(league.draftConfiguration || "4_players_8_teams");
    
    const currentPickNumber = picks.length + 1;
    const roundNumber = Math.ceil(currentPickNumber / members.length);

    // Send draft notification email
    const success = await emailService.sendDraftNotification(
      user.email,
      user.displayName,
      league.name,
      roundNumber,
      currentPickNumber,
      leagueId
    );

    if (success) {
      res.json({ message: "Draft notification sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send draft notification" });
    }
  } catch (error) {
    console.error("Send draft notification error:", error);
    res.status(400).json({ message: "Invalid request" });
  }
}

// Update user notification preferences
export async function updateNotificationPreferences(req: Request, res: Response) {
  try {
    const schema = z.object({
      draftNotifications: z.boolean().optional(),
      gameNotifications: z.boolean().optional(),
    });

    const { draftNotifications, gameNotifications } = schema.parse(req.body);
    const userId = req.params.userId;

    // Get current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update preferences
    const updateData: any = {};
    if (draftNotifications !== undefined) updateData.draftNotifications = draftNotifications;
    if (gameNotifications !== undefined) updateData.gameNotifications = gameNotifications;

    await storage.updateUser(userId, updateData);

    res.json({ message: "Notification preferences updated successfully" });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res.status(400).json({ message: "Invalid request" });
  }
}

// Get user notification preferences
export async function getNotificationPreferences(req: Request, res: Response) {
  try {
    const userId = req.params.userId;

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      draftNotifications: user.draftNotifications ?? true,
      gameNotifications: user.gameNotifications ?? false,
    });
  } catch (error) {
    console.error("Get notification preferences error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Test email functionality (admin only)
export async function testEmail(req: Request, res: Response) {
  try {
    const schema = z.object({
      type: z.enum(["invitation", "draft", "game"]),
      email: z.string().email(),
      leagueId: z.string().optional(),
    });

    const { type, email, leagueId } = schema.parse(req.body);

    let success = false;
    
    // Get league information if leagueId is provided
    let leagueName = "Test League";
    let leagueSport = "MLB";
    
    if (leagueId) {
      try {
        const league = await storage.getLeague(leagueId);
        if (league) {
          leagueName = league.name;
          leagueSport = league.sport || "MLB";
        }
      } catch (error) {
        console.log("Could not fetch league info for test email:", error);
      }
    }
    
    switch (type) {
      case "invitation":
        success = await emailService.sendLeagueInvitation(
          email,
          "Test User",
          leagueName,
          "Admin",
          "TEST123",
          leagueSport
        );
        break;
      case "draft":
        success = await emailService.sendDraftNotification(
          email,
          "Test User",
          leagueName,
          1,
          1,
          leagueId || "test-league-id"
        );
        break;
      case "game":
        success = await emailService.sendGameUpdateNotification(
          email,
          "Test User",
          "Yankees",
          "New York",
          true,
          "Yankees 8 - Red Sox 3",
          "Red Sox",
          leagueId || "test-league-id"
        );
        break;
    }

    if (success) {
      res.json({ message: `Test ${type} email sent successfully` });
    } else {
      res.status(500).json({ message: `Failed to send test ${type} email` });
    }
  } catch (error) {
    console.error("Test email error:", error);
    res.status(400).json({ message: "Invalid request" });
  }
}