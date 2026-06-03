import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { sportsApi } from "./services/sportsApi";
import { insertUserSchema, insertLeagueSchema, insertDraftPickSchema, leagues, type NFLTeam, type MLBTeam, type NBATeam, type League } from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { hashPassword, comparePassword, PENDING_PLACEHOLDER } from "./lib/auth.js";
import { notifyUser } from "./lib/realtime";
import { logAudit } from "./lib/audit.js";

// Rate limiter: aggressive throttle for auth endpoints to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  message: { message: "Too many attempts. Please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter: gentler throttle for signup/forgot-password
const accountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 per hour per IP
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().optional().default(false),
});

// Middleware: require authenticated session
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

// Middleware: require a verified email. Use AFTER an auth check has set userId.
async function requireVerified(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const user = await storage.getUser(userId);
    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    if (!user.verifiedAt) {
      res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before doing this. Check your inbox for the verification link, or request a new one from your profile.",
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Helper: hash a verification token for storage (we never store plaintext tokens)
async function hashVerificationToken(token: string): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Helper: generate a token, store its hash, and email a verification link.
// Errors are logged but do not throw — signup must not fail if email is down.
async function issueVerificationEmail(
  user: { id: string; email: string; displayName: string },
  options: { swallowErrors?: boolean } = {},
): Promise<void> {
  try {
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hashVerificationToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await storage.createEmailVerificationToken(user.id, tokenHash, expiresAt);

    const verifyUrl = `${process.env.APP_URL || "https://totalwins.app"}/verify-email?token=${token}`;
    const { EmailService } = await import("./services/emailService.js");
    const emailService = new EmailService();
    await emailService.sendVerificationEmail(user.email, user.displayName, verifyUrl);
  } catch (err) {
    console.error("Failed to issue verification email:", err);
    if (!options.swallowErrors) throw err;
  }
}

// Middleware: require authenticated admin session
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Helper: authorize a league-scoped action for a league commissioner (the
// creator OR any member with isCommissioner = true) or a platform Super Admin.
// Returns the league when authorized, otherwise sends the appropriate
// 401/403/404 response and returns null. Caller must short-circuit when null
// is returned.
async function authorizeLeagueCommissioner(
  req: Request,
  res: Response,
  leagueId: string | undefined,
): Promise<{ league: League } | null> {
  if (!req.session.userId) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  if (!leagueId) {
    res.status(400).json({ message: "League ID required" });
    return null;
  }
  const league = await storage.getLeague(leagueId);
  if (!league) {
    res.status(404).json({ message: "League not found" });
    return null;
  }
  const user = await storage.getUser(req.session.userId);
  if (user?.isAdmin || league.createdBy === req.session.userId) {
    return { league };
  }
  const member = await storage.getLeagueMember(leagueId, req.session.userId);
  if (member?.isCommissioner) {
    return { league };
  }
  res.status(403).json({ message: "Only a league commissioner can perform this action" });
  return null;
}

async function buildDraftEmailData(leagueId: string, sport: string) {
  const picks = await storage.getDraftPicks(leagueId);

  let allTeams: Array<{ id: string; name: string; abbreviation: string }> = [];
  switch (sport) {
    case 'MLB': allTeams = await storage.getAllMLBTeams(); break;
    case 'NBA': allTeams = await storage.getAllNBATeams(); break;
    case 'WORLD_CUP': allTeams = (await storage.getAllWorldCupTeams()).filter(t => t.qualified); break;
    default: allTeams = await storage.getAllNFLTeams(); break;
  }

  const draftedTeamIds = new Set(picks.map(p => p.teamId));

  const draftedPicks = await Promise.all(
    picks.map(async (p) => {
      const user = await storage.getUser(p.userId!);
      const team = allTeams.find(t => t.id === p.teamId);
      return {
        pickNumber: p.pickNumber!,
        teamName: team?.name || p.teamId || 'Unknown',
        teamAbbr: team?.abbreviation || '???',
        draftedBy: user?.displayName || 'Unknown',
      };
    })
  );

  const availableTeams = allTeams
    .filter(t => !draftedTeamIds.has(t.id))
    .map(t => ({ name: t.name, abbreviation: t.abbreviation }));

  return { draftedPicks, availableTeams };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Protect all /api/admin/* endpoints with admin authentication
  app.use("/api/admin", requireAdmin);

  // Authentication
  app.post("/api/auth/signup", accountLimiter, async (req, res) => {
    try {
      const { inviteCode, ...rawUserData } = req.body;
      // Strip server-managed fields so a malicious client cannot
      // mass-assign them through the public signup endpoint
      // (e.g. setting verifiedAt or isAdmin to bypass controls).
      const signupSchema = insertUserSchema.omit({
        verifiedAt: true,
        isAdmin: true,
        resetToken: true,
        resetTokenExpiresAt: true,
        pushSubscription: true,
      });
      const userData = signupSchema.parse(rawUserData);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({ ...userData, password: hashedPassword });

      // We never auto-join a league at signup time anymore: the new
      // user has not proven email ownership yet, and joining a league
      // is a verification-gated action. We surface a friendly message
      // pointing them at verification instead, and they can finish the
      // join from the same invite link after verifying.
      let joinedLeagueId: string | null = null;
      let joinWarning: string | null = null;
      if (inviteCode) {
        try {
          const league = await storage.getLeagueByInviteCode(inviteCode);
          if (!league) {
            joinWarning = "Invite code not found — you can join later from the invite link.";
          } else {
            joinWarning = `Verify your email, then return to the invite link to join ${league.name}.`;
          }
        } catch (joinError) {
          console.error("Failed to look up league after signup:", joinError);
          joinWarning = "Could not look up the league — you can try again from the invite link after verifying your email.";
        }
      }

      req.session.userId = user.id;
      // Fire off a verification email (do not block on its success)
      issueVerificationEmail({ id: user.id, email: user.email, displayName: user.displayName }, { swallowErrors: true });
      res.json({ user: { ...user, password: undefined }, joinedLeagueId, joinWarning });
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password, rememberMe } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      let valid = false;
      if (user.password === PENDING_PLACEHOLDER) {
        // Invited user who has not yet set a real password — cannot log in
        valid = false;
      } else if (user.password.startsWith("$2")) {
        // Modern bcrypt hash
        valid = await comparePassword(password, user.password);
      } else {
        // Legacy plain-text password — compare directly and upgrade on success
        valid = password === user.password;
        if (valid) {
          const upgraded = await hashPassword(password);
          await storage.updateUser(user.id, { password: upgraded });
        }
      }

      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      // Honour "Remember me": 90 days when checked, 30 days otherwise
      req.session.cookie.maxAge = rememberMe
        ? 90 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  // Forgot password — generates a reset token and emails it
  app.post("/api/auth/forgot-password", accountLimiter, async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      // Always return 200 to avoid leaking whether an email is registered
      if (!user) return res.json({ message: "If that email is registered, a reset link has been sent." });

      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.updateUser(user.id, { resetToken: token, resetTokenExpiresAt: expiresAt });

      const resetUrl = `${process.env.APP_URL || "https://totalwins.app"}/reset-password?token=${token}`;
      const { EmailService } = await import("./services/emailService.js");
      const emailService = new EmailService();
      await emailService.sendPasswordResetEmail(user.email, user.displayName, resetUrl);

      res.json({ message: "If that email is registered, a reset link has been sent." });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Reset password — validates token and sets new password
  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);

      const user = await storage.getUserByResetToken(token);
      if (!user) return res.status(400).json({ message: "Invalid or expired reset link." });
      if (!user.resetTokenExpiresAt || new Date() > user.resetTokenExpiresAt) {
        await storage.updateUser(user.id, { resetToken: null, resetTokenExpiresAt: null });
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }

      const hashed = await hashPassword(password);
      // Successfully resetting via the email link also proves email ownership,
      // so grandfather invited users (PENDING_PLACEHOLDER) into a verified state.
      const updates: Record<string, unknown> = {
        password: hashed,
        resetToken: null,
        resetTokenExpiresAt: null,
      };
      if (!user.verifiedAt) updates.verifiedAt = new Date();
      await storage.updateUser(user.id, updates);
      res.json({ message: "Password updated successfully. You can now log in." });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Verify email — public; consumes a verification token, marks user verified, logs them in
  app.post("/api/auth/verify-email", authLimiter, async (req, res) => {
    try {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
      const tokenHash = await hashVerificationToken(token);
      const row = await storage.getEmailVerificationTokenByHash(tokenHash);
      if (!row) {
        return res.status(400).json({ message: "Invalid or expired verification link." });
      }
      if (row.consumedAt) {
        return res.status(400).json({ message: "This verification link has already been used." });
      }
      if (new Date() > row.expiresAt) {
        return res.status(400).json({ message: "This verification link has expired. Please request a new one." });
      }
      const user = await storage.getUser(row.userId);
      if (!user) {
        return res.status(400).json({ message: "Invalid verification link." });
      }
      await storage.consumeEmailVerificationToken(row.id);
      const updatedUser = user.verifiedAt
        ? user
        : (await storage.updateUser(user.id, { verifiedAt: new Date() })) || user;
      // Log the user in so they land in-app verified
      req.session.userId = user.id;
      res.json({ user: { ...updatedUser, password: undefined } });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Resend verification email — authenticated; rate-limited per user (max 3 per 15min)
  app.post("/api/auth/resend-verification", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.verifiedAt) {
        return res.status(400).json({ message: "Your email is already verified." });
      }
      const since = new Date(Date.now() - 15 * 60 * 1000);
      const recent = await storage.countRecentVerificationTokens(userId, since);
      if (recent >= 3) {
        return res.status(429).json({ message: "Too many verification emails sent. Please wait a few minutes and try again." });
      }
      try {
        await issueVerificationEmail({ id: user.id, email: user.email, displayName: user.displayName });
      } catch (sendErr) {
        return res.status(502).json({ message: "We could not send the verification email right now. Please try again in a moment." });
      }
      res.json({ message: "Verification email sent. Please check your inbox." });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Auth refresh — returns fresh user data by ID (for stale localStorage sessions)
  app.get("/api/auth/me/:id", requireAuth, async (req, res) => {
    // Users may only fetch their own session profile via this endpoint
    if (req.session.userId !== req.params.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ ...user, password: undefined });
  });

  // Get pending league invitations for the logged-in user.
  // IMPORTANT: this must be registered BEFORE the `/api/users/:id` route
  // below, otherwise Express treats "pending-invitations" as an :id.
  app.get("/api/users/pending-invitations", async (req, res) => {
    try {
      const sessionUserId = req.session.userId;
      if (!sessionUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const invitations = await storage.getUserPendingInvitations(sessionUserId);
      res.json(invitations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Users — any authenticated user may look up another user's basic public profile
  // (display name, etc.) for member lists; sensitive fields are stripped.
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const requesterId = req.session.userId;
    const requester = requesterId ? await storage.getUser(requesterId) : null;
    const isSelfOrAdmin = requesterId === user.id || !!requester?.isAdmin;

    // Also expose email to league commissioners/creators who share a league with this user.
    // We iterate the REQUESTER's leagues (they are always "active" in their own leagues)
    // and check whether the target user is a member of any of those leagues — including
    // "pending" members who were just added via "Add & Invite Later".
    let isLeagueCommissioner = false;
    if (requesterId && !isSelfOrAdmin) {
      const requesterLeagues = await storage.getUserLeagues(requesterId);
      for (const league of requesterLeagues) {
        const isCreator = league.createdBy === requesterId;
        let hasCommissionerRole = isCreator;
        if (!isCreator) {
          const requesterMembership = await storage.getLeagueMember(league.id, requesterId);
          hasCommissionerRole = !!requesterMembership?.isCommissioner;
        }
        if (hasCommissionerRole) {
          // Check if the target user is in this league (any invitation status, including pending)
          const targetMembership = await storage.getLeagueMember(league.id, user.id);
          if (targetMembership) {
            isLeagueCommissioner = true;
            break;
          }
        }
      }
    }

    // Strip sensitive fields when the requester is not the user themselves, a global admin,
    // or a commissioner of a shared league
    const safeUser = (isSelfOrAdmin || isLeagueCommissioner)
      ? { ...user, password: undefined }
      : {
          ...user,
          password: undefined,
          email: undefined,
          resetToken: undefined,
          resetTokenExpiresAt: undefined,
        };
    res.json(safeUser);
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      // Strip all auth/security fields — these must only be updated via
      // dedicated routes (/password, /email, forgot-password, etc.)
      const { password, resetToken, resetTokenExpiresAt, isAdmin, ...safeUpdates } = req.body;
      const user = await storage.updateUser(req.params.id, safeUpdates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // Update user profile
  app.put("/api/users/:id/profile", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      // Only allow safe profile fields — never password or auth fields
      const { password, resetToken, resetTokenExpiresAt, isAdmin, ...safeProfile } = req.body;
      const user = await storage.updateUser(req.params.id, safeProfile);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid profile data" });
    }
  });

  // Change password
  app.put("/api/users/:id/password", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { currentPassword, newPassword } = req.body;
      
      // Get current user to verify password
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password (handle legacy plain-text passwords)
      let passwordValid = false;
      if (user.password.startsWith("$2")) {
        passwordValid = await comparePassword(currentPassword, user.password);
      } else {
        passwordValid = currentPassword === user.password;
      }
      if (!passwordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Update password
      const newPasswordHash = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(req.params.id, { password: newPasswordHash });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid password change request" });
    }
  });

  // Change email
  app.put("/api/users/:id/email", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { currentPassword, newEmail } = req.body;
      
      // Get current user to verify password
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password for security (handle legacy plain-text passwords)
      let emailPasswordValid = false;
      if (user.password.startsWith("$2")) {
        emailPasswordValid = await comparePassword(currentPassword, user.password);
      } else {
        emailPasswordValid = currentPassword === user.password;
      }
      if (!emailPasswordValid) {
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

  // League preview by invite code (public — no auth required)
  app.get("/api/leagues/preview", async (req, res) => {
    try {
      const code = z.string().min(1).parse(req.query.code);
      const league = await storage.getLeagueByInviteCode(code);
      if (!league) {
        return res.status(404).json({ message: "Invalid invite code" });
      }
      const members = await storage.getLeagueMembers(league.id);
      res.json({
        id: league.id,
        name: league.name,
        sport: league.sport,
        maxPlayers: league.maxPlayers,
        memberCount: members.length,
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Join a league by invite code — identity derived from server-side session
  app.post("/api/leagues/join", requireVerified, async (req, res) => {
    try {
      // Require an authenticated session
      const sessionUserId = req.session.userId;
      if (!sessionUserId) {
        return res.status(401).json({ message: "You must be logged in to join a league" });
      }

      const { inviteCode } = z.object({
        inviteCode: z.string().min(1),
      }).parse(req.body);

      const league = await storage.getLeagueByInviteCode(inviteCode);
      if (!league) {
        return res.status(404).json({ message: "Invalid invite code" });
      }

      const members = await storage.getLeagueMembers(league.id);

      const alreadyMember = members.some(m => m.userId === sessionUserId);
      if (alreadyMember) {
        return res.status(400).json({ message: "You are already a member of this league" });
      }

      if (members.length >= league.maxPlayers) {
        return res.status(400).json({ message: "This league is full" });
      }

      const nextDraftPosition = members.length + 1;
      const member = await storage.addLeagueMember({
        leagueId: league.id,
        userId: sessionUserId,
        draftPosition: nextDraftPosition,
        totalWins: 0,
        invitationStatus: "active",
      });

      res.json({ member, league });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Accept a pending league invitation
  // Commissioner manually approves a pending member
  app.post("/api/leagues/:leagueId/members/:userId/approve", requireAuth, async (req, res) => {
    try {
      const { leagueId, userId } = req.params;
      const requesterId = req.session.userId!;
      const league = await storage.getLeague(leagueId);
      if (!league) return res.status(404).json({ message: "League not found" });
      const requester = await storage.getUser(requesterId);
      const requesterMembership = await storage.getLeagueMember(leagueId, requesterId);
      const isAuthorized =
        requester?.isAdmin ||
        league.createdBy === requesterId ||
        requesterMembership?.isCommissioner;
      if (!isAuthorized) return res.status(403).json({ message: "Commissioner access required" });
      const member = await storage.getLeagueMember(leagueId, userId);
      if (!member || member.invitationStatus !== "pending") {
        return res.status(404).json({ message: "No pending invitation found" });
      }
      const ok = await storage.acceptLeagueInvitation(leagueId, userId);
      if (!ok) return res.status(500).json({ message: "Failed to approve member" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to approve member" });
    }
  });

  app.post("/api/leagues/:id/accept-invitation", requireVerified, async (req, res) => {
    try {
      const sessionUserId = req.session.userId;
      if (!sessionUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const leagueId = req.params.id;
      const member = await storage.getLeagueMember(leagueId, sessionUserId);
      if (!member || member.invitationStatus !== "pending") {
        return res.status(404).json({ message: "No pending invitation found" });
      }
      const ok = await storage.acceptLeagueInvitation(leagueId, sessionUserId);
      if (!ok) {
        return res.status(500).json({ message: "Failed to accept invitation" });
      }
      const league = await storage.getLeague(leagueId);
      res.json({ success: true, league });
    } catch (error) {
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Leagues
  app.post("/api/leagues", requireVerified, async (req, res) => {
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
    const auth = await authorizeLeagueCommissioner(req, res, req.params.id);
    if (!auth) return;
    try {
      const updates = req.body;
      // Convert draftScheduledAt string to Date if provided
      if (updates.draftScheduledAt && typeof updates.draftScheduledAt === "string") {
        updates.draftScheduledAt = new Date(updates.draftScheduledAt);
      }

      // Validate leagueStartDate updates: must be on/after the league's draft
      // date and the sport's actual season start. Once the draft is completed
      // and the saved start date has already passed, the date is locked to
      // prevent retroactively excluding games that have already counted.
      if (Object.prototype.hasOwnProperty.call(updates, "leagueStartDate")) {
        const existing = auth.league;

        const todayUtcMidnight = (() => {
          const n = new Date();
          return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
        })();

        if (existing.leagueStartDate && existing.draftStatus === "completed") {
          const stored = existing.leagueStartDate;
          const storedFloor = new Date(Date.UTC(stored.getUTCFullYear(), stored.getUTCMonth(), stored.getUTCDate()));
          if (todayUtcMidnight.getTime() >= storedFloor.getTime()) {
            return res.status(400).json({ message: "League start date is locked because the league has already started" });
          }
        }

        if (updates.leagueStartDate) {
          const proposed = new Date(updates.leagueStartDate);
          if (isNaN(proposed.getTime())) {
            return res.status(400).json({ message: "Invalid league start date" });
          }
          const proposedFloor = new Date(Date.UTC(proposed.getUTCFullYear(), proposed.getUTCMonth(), proposed.getUTCDate()));

          if (proposedFloor.getTime() < todayUtcMidnight.getTime()) {
            return res.status(400).json({ message: "League start date cannot be in the past" });
          }

          const draftAt = existing.draftScheduledAt;
          if (draftAt) {
            const draftFloor = new Date(Date.UTC(draftAt.getUTCFullYear(), draftAt.getUTCMonth(), draftAt.getUTCDate()));
            if (proposedFloor.getTime() < draftFloor.getTime()) {
              return res.status(400).json({ message: "League start date must be on or after the draft date" });
            }
          }

          const seasonStart = await storage.getSportSeasonStart(existing.sport, existing.season);
          if (seasonStart && proposedFloor.getTime() < seasonStart.getTime()) {
            return res.status(400).json({ message: "League start date must be on or after the sport's season start" });
          }

          updates.leagueStartDate = proposedFloor;
        } else {
          updates.leagueStartDate = null;
        }
      }

      const before = await storage.getLeague(req.params.id);
      const league = await storage.updateLeague(req.params.id, updates);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId: league.id,
        action: "league.settings.update",
        targetType: "league",
        targetId: league.id,
        metadata: { changedKeys: Object.keys(updates), before, after: league },
      });
      res.json(league);
    } catch (error) {
      console.error("PATCH /api/leagues/:id error:", error);
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // Used by the admin League Settings UI to know the earliest valid date for
  // the "League Start Date" field (the sport's actual season start, derived
  // from the earliest synced game date for that sport+season).
  app.get("/api/leagues/:id/season-start-floor", requireAdmin, async (req, res) => {
    try {
      const league = await storage.getLeague(req.params.id);
      if (!league) return res.status(404).json({ message: "League not found" });
      const floor = await storage.getSportSeasonStart(league.sport, league.season);
      res.json({ seasonStart: floor ? floor.toISOString() : null });
    } catch (error) {
      res.status(500).json({ message: "Failed to load season start" });
    }
  });

  // Season history — all seasons in a franchise chain
  // Requires auth; caller must be a member of the league or a global admin
  app.get("/api/leagues/:id/seasons", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const [user, league] = await Promise.all([
        storage.getUser(userId),
        storage.getLeague(req.params.id),
      ]);
      if (!league) return res.status(404).json({ message: "League not found" });

      if (!user?.isAdmin) {
        const member = await storage.getLeagueMember(req.params.id, userId);
        if (!member) {
          // Also allow access if user is a member of any season in the franchise
          const history = await storage.getSeasonHistory(req.params.id);
          const isMemberOfFranchise = await Promise.all(
            history.map(s => storage.getLeagueMember(s.id, userId))
          );
          if (!isMemberOfFranchise.some(Boolean)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      const seasons = await storage.getSeasonHistory(req.params.id);
      res.json(seasons);
    } catch (err) {
      res.status(500).json({ message: "Failed to load season history" });
    }
  });

  // Roll over to a new season — global admin OR league creator
  app.post("/api/leagues/:id/rollover", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;

      // Authorise: global admin or league creator
      const [user, league] = await Promise.all([
        storage.getUser(userId),
        storage.getLeague(req.params.id),
      ]);
      if (!league) return res.status(404).json({ message: "League not found" });
      if (!user?.isAdmin && league.createdBy !== userId) {
        return res.status(403).json({ message: "Only a league admin can roll over to a new season" });
      }

      const { newSeason, memberUserIds } = z.object({
        newSeason: z.string().min(1),
        memberUserIds: z.array(z.string()).optional(),
      }).parse(req.body);

      // Server-side guard: at least one member must be carried over
      if (memberUserIds !== undefined && memberUserIds.length === 0) {
        return res.status(400).json({ message: "At least one member must be carried over to the new season" });
      }
      // Ensure the league creator is always included when a list is provided
      if (memberUserIds !== undefined && league.createdBy && !memberUserIds.includes(league.createdBy)) {
        memberUserIds.push(league.createdBy);
      }

      const newLeague = await storage.rolloverLeague(req.params.id, newSeason, userId, memberUserIds);
      logAudit({
        actorUserId: userId,
        leagueId: req.params.id,
        action: "league.rollover",
        targetType: "league",
        targetId: newLeague?.id ?? req.params.id,
        metadata: { newSeason, memberCount: memberUserIds?.length ?? null, newLeagueId: newLeague?.id ?? null },
      });
      res.json(newLeague);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Rollover failed";
      res.status(400).json({ message });
    }
  });

  // Season completion status — checks if all games for the sport are processed
  app.get("/api/leagues/:id/season-complete", requireAuth, async (req, res) => {
    try {
      const status = await storage.getLeagueSeasonGameStatus(req.params.id);
      res.json(status);
    } catch (err) {
      res.status(500).json({ message: "Failed to check season status" });
    }
  });

  app.get("/api/leagues/:leagueId/export", async (req, res) => {
    try {
      const { leagueId } = req.params;
      const league = await storage.getLeague(leagueId);
      if (!league) return res.status(404).json({ message: "League not found" });

      const standings = await storage.getPlayerStandings(leagueId);

      const rows: string[] = ["Rank,Player,Teams,Total Wins"];
      for (const standing of standings) {
        const teamsCell = (standing.teams as (NFLTeam | MLBTeam | NBATeam)[])
          .map((t) => `${t.city ? t.city + " " : ""}${t.name} (${t.wins ?? 0}W)`)
          .join("; ");
        const escapedPlayer = `"${standing.displayName.replace(/"/g, '""')}"`;
        const escapedTeams = `"${teamsCell.replace(/"/g, '""')}"`;
        rows.push(`${standing.rank},${escapedPlayer},${escapedTeams},${standing.totalWins}`);
      }

      const csv = rows.join("\n");
      const filename = `${league.name.replace(/[^a-z0-9]/gi, "_")}_standings.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error generating export:", error);
      res.status(500).json({ message: "Failed to generate export" });
    }
  });

  app.post("/api/leagues/:leagueId/send-updates", requireAuth, async (req, res) => {
    try {
      const { leagueId } = req.params;
      const { message } = req.body;

      const league = await storage.getLeague(leagueId);
      if (!league) return res.status(404).json({ message: "League not found" });

      const requestingUser = await storage.getUser(req.session.userId!);
      const isLeagueAdmin = requestingUser?.isAdmin || league.createdBy === req.session.userId;
      if (!isLeagueAdmin) return res.status(403).json({ message: "Admin access required" });

      const { emailService } = await import("./services/emailService.js");
      const standings = await storage.getPlayerStandings(leagueId);
      const members = await storage.getLeagueMembers(leagueId);

      let sent = 0;
      for (const member of members) {
        if (!member.userId) continue;
        const user = await storage.getUser(member.userId);
        if (!user || !user.email || user.password === "__pending__") continue;
        const success = await emailService.sendLeagueUpdate(
          user.email,
          user.displayName,
          league.name,
          league.sport || "NFL",
          standings,
          message || undefined,
          leagueId,
          false
        );
        if (success) sent++;
      }

      res.json({ sent });
    } catch (error) {
      console.error("Error sending league updates:", error);
      res.status(500).json({ message: "Failed to send updates" });
    }
  });

  app.post("/api/leagues/:leagueId/send-updates/test", requireAuth, async (req, res) => {
    try {
      const { leagueId } = req.params;

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const league = await storage.getLeague(leagueId);
      if (!league) return res.status(404).json({ message: "League not found" });

      const member = await storage.getLeagueMember(leagueId, req.session.userId!);
      const isLeagueAdmin = user.isAdmin || league.createdBy === req.session.userId;
      if (!member && !isLeagueAdmin) return res.status(403).json({ message: "You are not a member of this league" });

      const { emailService } = await import("./services/emailService.js");
      const standings = await storage.getPlayerStandings(leagueId);

      const success = await emailService.sendLeagueUpdate(
        user.email,
        user.displayName,
        league.name,
        league.sport || "NFL",
        standings,
        undefined,
        leagueId,
        true
      );

      res.json({ sent: success ? 1 : 0 });
    } catch (error) {
      console.error("Error sending test update:", error);
      res.status(500).json({ message: "Failed to send test update" });
    }
  });

  app.get("/api/users/:userId/leagues", requireAuth, async (req, res) => {
    // A user may only list their own leagues; admins may list anyone's
    const requester = await storage.getUser(req.session.userId!);
    if (req.session.userId !== req.params.userId && !requester?.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    const leagues = await storage.getUserLeagues(req.params.userId);
    res.json(leagues);
  });

  // League Members
  app.get("/api/leagues/:leagueId/members", requireAuth, async (req, res) => {
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

  app.post("/api/leagues/:leagueId/members", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      const member = await storage.addLeagueMember({
        leagueId: req.params.leagueId,
        userId,
        totalWins: 0
      });
      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId: req.params.leagueId,
        action: "league.member.add",
        targetType: "user",
        targetId: userId,
        metadata: { method: "admin.add-member" },
      });
      res.json(member);
    } catch (error) {
      res.status(400).json({ message: "Failed to add member" });
    }
  });

  // Remove a member from a league.
  //  - Site admins and the league creator can remove anyone (existing behaviour).
  //  - A regular member can remove themselves ("leave league").
  //  - The league creator cannot leave their own league (must hand it off first).
  //  - Removal is blocked once the draft is active.
  app.delete("/api/leagues/:leagueId/members/:userId", requireAuth, async (req, res) => {
    try {
      const requesterId = req.session.userId!;
      const requester = await storage.getUser(requesterId);
      const league = await storage.getLeague(req.params.leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const isSelfRemoval = requesterId === req.params.userId;
      const isLeagueAdmin = !!requester?.isAdmin || league.createdBy === requesterId;
      if (!isSelfRemoval && !isLeagueAdmin) {
        return res.status(403).json({ message: "You don't have permission to remove this member" });
      }

      // The league creator cannot leave their own league
      if (isSelfRemoval && league.createdBy === requesterId) {
        return res.status(400).json({
          message: "League creators cannot leave their own league. Hand off ownership first or delete the league.",
        });
      }

      // Prevent removing players once draft has started
      if (league.draftStatus === "active") {
        return res.status(400).json({
          message: "Cannot remove players from league once the draft has started",
        });
      }

      const success = await storage.removeLeagueMember(req.params.leagueId, req.params.userId);
      if (!success) {
        return res.status(404).json({ message: "Member not found" });
      }
      logAudit({
        actorUserId: requesterId,
        leagueId: req.params.leagueId,
        action: isSelfRemoval ? "league.member.leave" : "league.member.remove",
        targetType: "user",
        targetId: req.params.userId,
        metadata: { isSelfRemoval },
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member from league" });
    }
  });

  // Platform-wide audit log — restricted to platform admins (mounted under /api/admin).
  // Lists global entries (default: leagueId IS NULL) such as user.privileges.update,
  // sport.scores.sync, sport.records.update, sport.mlb.sync, etc. Use scope=all to
  // include league-scoped entries too. Supports filtering by action substring,
  // actorUserId, and a created-at date range.
  app.get("/api/admin/audit-log", async (req, res) => {
    try {
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 500)
        : 100;
      const scopeParam = String(req.query.scope ?? "global");
      const scope: "global" | "all" = scopeParam === "all" ? "all" : "global";
      const action = typeof req.query.action === "string" && req.query.action.trim()
        ? req.query.action.trim()
        : undefined;
      const actorUserId = typeof req.query.actor === "string" && req.query.actor.trim()
        ? req.query.actor.trim()
        : undefined;
      const parseDate = (v: unknown): Date | undefined => {
        if (typeof v !== "string" || !v) return undefined;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? undefined : d;
      };
      const since = parseDate(req.query.since);
      const until = parseDate(req.query.until);

      const entries = await storage.getGlobalAuditLog({
        scope,
        action,
        actorUserId,
        since,
        until,
        limit,
      });
      res.json(entries);
    } catch (error) {
      console.error("GET /api/admin/audit-log error:", error);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  // Audit log — restricted to platform admins and the league creator.
  // Returns the most recent N entries with the actor's display name joined in.
  app.get("/api/leagues/:leagueId/audit-log", requireAuth, async (req, res) => {
    try {
      const requesterId = req.session.userId!;
      const [requester, league] = await Promise.all([
        storage.getUser(requesterId),
        storage.getLeague(req.params.leagueId),
      ]);
      if (!league) return res.status(404).json({ message: "League not found" });
      const isAllowed = !!requester?.isAdmin || league.createdBy === requesterId;
      if (!isAllowed) {
        return res.status(403).json({ message: "Only league admins can view the audit log" });
      }
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 100;
      const entries = await storage.getLeagueAuditLog(req.params.leagueId, limit);
      res.json(entries);
    } catch (error) {
      console.error("GET /api/leagues/:leagueId/audit-log error:", error);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  // Standings
  app.get("/api/leagues/:leagueId/standings", async (req, res) => {
    const standings = await storage.getPlayerStandings(req.params.leagueId);
    res.json(standings);
  });

  // Effective league start date used to filter games into standings.
  // Returns the explicit league start date if set, otherwise falls back to
  // the sport's earliest synced game date for the season. `source` indicates
  // which produced the value; both fields are null if neither is available.
  app.get("/api/leagues/:leagueId/start-date", async (req, res) => {
    try {
      const league = await storage.getLeague(req.params.leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      const result = await storage.getLeagueEffectiveStartDate(req.params.leagueId);
      const seasonStart = await storage.getSportSeasonStart(league.sport, league.season);
      res.json({
        startDate: result.startDate ? result.startDate.toISOString() : null,
        source: result.source,
        seasonStart: seasonStart ? seasonStart.toISOString() : null,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch league start date" });
    }
  });

  app.get("/api/leagues/:leagueId/analytics", async (req, res) => {
    try {
      const analytics = await storage.getLeagueAnalytics(req.params.leagueId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching league analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
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

  // Draft — viewing picks requires being a league member or admin
  app.get("/api/leagues/:leagueId/draft/picks", requireAuth, async (req, res) => {
    const requester = await storage.getUser(req.session.userId!);
    const member = await storage.getLeagueMember(req.params.leagueId, req.session.userId!);
    const league = await storage.getLeague(req.params.leagueId);
    const isLeagueAdmin = !!requester?.isAdmin || (league && league.createdBy === req.session.userId);
    if (!member && !isLeagueAdmin) {
      return res.status(403).json({ message: "You are not a member of this league" });
    }
    const picks = await storage.getDraftPicks(req.params.leagueId);

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
          case 'WORLD_CUP':
            team = await storage.getWorldCupTeam(pick.teamId!);
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

  app.post("/api/leagues/:leagueId/draft/picks", requireAuth, async (req, res) => {
    try {
      // Reject picks when draft is paused
      const league = await storage.getLeague(req.params.leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      if (league.draftStatus === "paused") {
        return res.status(403).json({ message: "The draft is currently paused. Please wait for the commissioner to resume." });
      }

      // Default userId to the authenticated session user when the client
      // omits it (the live draft page never supplies it). This avoids the
      // class of bug where a stale localStorage `currentUser` on the client
      // disagrees with the server session and triggers a spurious 403.
      const requestingUserId = req.session.userId!;
      const resolvedUserId =
        (typeof req.body?.userId === "string" && req.body.userId.length > 0)
          ? req.body.userId
          : requestingUserId;
      // Always derive `sport` from the league, never the client. Trusting the
      // client here means an MLB/NBA/World Cup pick can land in the table
      // tagged "NFL" (the schema default) if a stale build sends the wrong
      // value, which then breaks standings filtering by sport.
      const pickData = insertDraftPickSchema.parse({
        ...req.body,
        userId: resolvedUserId,
        leagueId: req.params.leagueId,
        sport: league.sport,
      });
      // Belt-and-suspenders: never allow a pick with no owner to land in the
      // table, even if Zod parsing somehow lets a falsy userId through. A
      // NULL user_id orphans the team and silently hides it from standings.
      if (!pickData.userId) {
        return res.status(400).json({ message: "Draft pick is missing a user. Please refresh and try again." });
      }

      // Authorisation: site admins and the league creator may submit picks for any
      // user (manual entry / commissioner override). All other callers must be a
      // member of the league and may only draft for themselves.
      const requestingUser = await storage.getUser(requestingUserId);
      const isLeagueAdmin = !!requestingUser?.isAdmin || league.createdBy === requestingUserId;
      if (!isLeagueAdmin) {
        const member = await storage.getLeagueMember(req.params.leagueId, requestingUserId);
        if (!member) {
          return res.status(403).json({ message: "You are not a member of this league" });
        }
        if (pickData.userId !== requestingUserId) {
          return res.status(403).json({ message: "You can only draft for yourself" });
        }
      }

      const pick = await storage.addDraftPick(pickData);

      // Audit only commissioner-on-behalf-of-other picks; self-picks are
      // already captured implicitly in the draft_picks table.
      if (pickData.userId !== requestingUserId) {
        logAudit({
          actorUserId: requestingUserId,
          leagueId: req.params.leagueId,
          action: "league.draft.pick_for_other",
          targetType: "user",
          targetId: pickData.userId ?? null,
          metadata: {
            teamId: pickData.teamId,
            pickNumber: pickData.pickNumber,
            round: pickData.round,
            sport: pickData.sport,
          },
        });
      }

      // Auto-complete: mark the draft as "completed" in the DB when all picks are done
      try {
        const completionStatus = await storage.getDraftStatus(req.params.leagueId);
        const leagueForCompletion = await storage.getLeague(req.params.leagueId);
        if (!completionStatus.isActive && !completionStatus.isPaused && leagueForCompletion?.draftStatus === 'active') {
          await storage.updateLeague(req.params.leagueId, { draftStatus: 'completed' });
          console.log(`✅ Draft auto-completed for league ${req.params.leagueId}`);
        }
      } catch (completionError) {
        console.error('Failed to auto-complete draft:', completionError);
      }
      
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
              console.log(`Sending draft notification for league ${league?.name}`);
              
              // Send email notification
              const { EmailService } = await import('./services/emailService.js');
              const emailService = new EmailService();
              const emailData = await buildDraftEmailData(req.params.leagueId, league?.sport || 'NFL');
              await emailService.sendDraftNotification(
                currentUser.email!,
                currentUser.displayName!,
                league?.name || 'League',
                draftStatus.currentPick,
                draftStatus.round,
                req.params.leagueId,
                emailData.draftedPicks,
                emailData.availableTeams
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

  app.get("/api/leagues/:leagueId/draft/status", requireAuth, async (req, res) => {
    const requester = await storage.getUser(req.session.userId!);
    const member = await storage.getLeagueMember(req.params.leagueId, req.session.userId!);
    const league = await storage.getLeague(req.params.leagueId);
    const isLeagueAdmin = !!requester?.isAdmin || (league && league.createdBy === req.session.userId);
    if (!member && !isLeagueAdmin) {
      return res.status(403).json({ message: "You are not a member of this league" });
    }
    const status = await storage.getDraftStatus(req.params.leagueId);
    res.json(status);
  });

  app.post("/api/leagues/:leagueId/draft/pause", requireAuth, async (req, res) => {
    try {
      const { leagueId } = req.params;
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ error: "League not found" });
      }
      const requestingUser = await storage.getUser(req.session.userId!);
      const isLeagueAdmin = requestingUser?.isAdmin || league.createdBy === req.session.userId;
      if (!isLeagueAdmin) {
        return res.status(403).json({ error: "Only league admins can pause the draft" });
      }
      if (league.draftStatus !== "active") {
        return res.status(400).json({ error: "Draft is not currently active" });
      }
      await storage.updateLeague(leagueId, { draftStatus: "paused" });
      logAudit({ actorUserId: req.session.userId ?? null, leagueId, action: "league.draft.pause", targetType: "league", targetId: leagueId });
      res.json({ success: true, message: "Draft paused successfully" });
    } catch (error) {
      console.error("Error pausing draft:", error);
      res.status(500).json({ error: "Failed to pause draft" });
    }
  });

  app.post("/api/leagues/:leagueId/draft/resume", requireAuth, async (req, res) => {
    try {
      const { leagueId } = req.params;
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ error: "League not found" });
      }
      const requestingUser = await storage.getUser(req.session.userId!);
      const isLeagueAdmin = requestingUser?.isAdmin || league.createdBy === req.session.userId;
      if (!isLeagueAdmin) {
        return res.status(403).json({ error: "Only league admins can resume the draft" });
      }
      if (league.draftStatus !== "paused") {
        return res.status(400).json({ error: "Draft is not currently paused" });
      }
      await storage.updateLeague(leagueId, { draftStatus: "active" });
      logAudit({ actorUserId: req.session.userId ?? null, leagueId, action: "league.draft.resume", targetType: "league", targetId: leagueId });
      res.json({ success: true, message: "Draft resumed successfully" });
    } catch (error) {
      console.error("Error resuming draft:", error);
      res.status(500).json({ error: "Failed to resume draft" });
    }
  });

  app.get("/api/leagues/:leagueId/users/:userId/picks", requireAuth, async (req, res) => {
    const requester = await storage.getUser(req.session.userId!);
    const member = await storage.getLeagueMember(req.params.leagueId, req.session.userId!);
    const leagueForAuth = await storage.getLeague(req.params.leagueId);
    const isLeagueAdmin = !!requester?.isAdmin || (leagueForAuth && leagueForAuth.createdBy === req.session.userId);
    if (!member && !isLeagueAdmin) {
      return res.status(403).json({ message: "You are not a member of this league" });
    }
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
          case 'WORLD_CUP':
            team = await storage.getWorldCupTeam(pick.teamId!);
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

  // Has the regular season ended for this league's sport+season?
  // Frontend uses this to swap the daily games sections for an "over" message
  // (relevant for MLB/NBA — we don't track playoff games).
  app.get("/api/leagues/:leagueId/season-status", async (req, res) => {
    const status = await storage.getRegularSeasonStatus(req.params.leagueId);
    res.json(status);
  });

  // Admin endpoints
  app.post("/api/admin/sync-scores", async (req, res) => {
    try {
      const now = new Date();
      const currentSeason = (now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1).toString();
      const { week = 18, season = currentSeason } = req.body;
      await sportsApi.syncGamesForWeek(week, season);
      logAudit({ actorUserId: req.session.userId ?? null, action: "sport.scores.sync", metadata: { week, season } });
      res.json({ message: "Scores synced successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync scores" });
    }
  });

  app.post("/api/admin/update-records", async (req, res) => {
    try {
      // Use the multi-sport ESPN standings syncer so NFL/MLB/NBA records all
      // get refreshed into their sport-specific tables. The legacy
      // updateTeamRecords() only touched the NFL table, which silently left
      // MLB/NBA records stale on every "Update Records" admin click.
      const result = await sportsApi.syncTeamStandingsFromESPN();
      logAudit({
        actorUserId: req.session.userId ?? null,
        action: "sport.records.update",
        metadata: { updated: result.updated, errors: result.errors },
      });
      res.json({
        message: "Team records updated successfully",
        updated: result.updated,
        errors: result.errors,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update team records" });
    }
  });

  app.post("/api/admin/sync-mlb-games", async (req, res) => {
    try {
      await sportsApi.syncMLBGames();
      logAudit({ actorUserId: req.session.userId ?? null, action: "sport.mlb.sync" });
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

  // Add player without sending invite email.
  // NOTE: mounted outside /api/admin so league commissioners (createdBy) can use it
  // without being platform Super Admins. Authorization is enforced inline.
  app.post("/api/leagues/add-player-no-invite", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(1),
        leagueId: z.string(),
      });
      const { email, name, leagueId } = schema.parse(req.body);

      const league = await storage.getLeague(leagueId);
      if (!league) return res.status(404).json({ message: "League not found" });

      const requestingUser = await storage.getUser(req.session.userId);
      const isAuthorized = requestingUser?.isAdmin || league.createdBy === req.session.userId;
      if (!isAuthorized) {
        return res.status(403).json({ message: "Only the league commissioner can add players" });
      }

      // Check if user already exists
      let user = await storage.getUserByEmail(email);
      if (!user) {
        // Create placeholder user account (no real password — they'll set one when they join)
        const nameParts = name.trim().split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || nameParts[0];
        user = await storage.createUser({
          email,
          password: PENDING_PLACEHOLDER,
          firstName,
          lastName,
          displayName: name.trim(),
          isAdmin: false,
        });
      }

      // Check if already a member
      const existingMember = await storage.getLeagueMember(leagueId, user.id);
      if (existingMember) {
        return res.status(409).json({ message: "Player is already in this league" });
      }

      // Add to league with pending status
      await storage.addLeagueMember({
        leagueId,
        userId: user.id,
        draftPosition: null,
        totalWins: 0,
        draftNotifications: true,
        gameNotifications: false,
        invitationStatus: "pending",
      });

      notifyUser(user.id, "pending-invitations:changed");

      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId,
        action: "league.member.add",
        targetType: "user",
        targetId: user.id,
        metadata: { email, name, status: "pending", method: "no-invite" },
      });

      res.json({ message: "Player added successfully", userId: user.id });
    } catch (error) {
      console.error("Add player no invite error:", error);
      res.status(400).json({ message: "Failed to add player" });
    }
  });

  // Toggle league commissioner status for a member.
  // The league creator (createdBy) is always a commissioner and cannot be demoted.
  app.post("/api/leagues/set-commissioner", async (req, res) => {
    try {
      const schema = z.object({
        leagueId: z.string(),
        userId: z.string(),
        isCommissioner: z.boolean(),
      });
      const { leagueId, userId, isCommissioner } = schema.parse(req.body);
      const auth = await authorizeLeagueCommissioner(req, res, leagueId);
      if (!auth) return;
      const { league } = auth;

      if (league.createdBy === userId && !isCommissioner) {
        return res.status(400).json({ message: "The league creator cannot be removed as commissioner" });
      }

      const success = await storage.setLeagueMemberCommissioner(leagueId, userId, isCommissioner);
      if (!success) {
        return res.status(404).json({ message: "Player not found in league" });
      }

      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId,
        action: isCommissioner ? "league.commissioner.grant" : "league.commissioner.revoke",
        targetType: "user",
        targetId: userId,
      });

      res.json({ success: true, isCommissioner });
    } catch (error) {
      console.error("Set commissioner error:", error);
      res.status(400).json({ message: "Failed to update commissioner status" });
    }
  });

  app.post("/api/leagues/save-draft-order", async (req, res) => {
    try {
      const schema = z.object({
        leagueId: z.string(),
        orderedUserIds: z.array(z.string()).min(1),
      });
      const { leagueId, orderedUserIds } = schema.parse(req.body);
      if (!(await authorizeLeagueCommissioner(req, res, leagueId))) return;
      await storage.saveDraftOrder(leagueId, orderedUserIds);
      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId,
        action: "league.draft.save_order",
        targetType: "league",
        targetId: leagueId,
        metadata: { orderedUserIds },
      });
      res.json({ message: "Draft order saved successfully" });
    } catch (error) {
      console.error("Save draft order error:", error);
      res.status(400).json({ message: "Failed to save draft order" });
    }
  });

  // League-specific notification preferences — only the owner or admin
  app.get("/api/leagues/:leagueId/members/:userId/notification-preferences", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.userId) {
        const caller = await storage.getUser(req.session.userId!);
        if (!caller?.isAdmin) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
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

  app.put("/api/leagues/:leagueId/members/:userId/notification-preferences", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.userId) {
        const caller = await storage.getUser(req.session.userId!);
        if (!caller?.isAdmin) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
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

  app.put("/api/users/:userId/notification-preferences", requireAuth, async (req, res) => {
    try {
      if (req.session.userId !== req.params.userId) {
        const caller = await storage.getUser(req.session.userId!);
        if (!caller?.isAdmin) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
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
  
  app.get("/api/users/:userId/notification-preferences", requireAuth, async (req, res) => {
    if (req.session.userId !== req.params.userId) {
      const caller = await storage.getUser(req.session.userId!);
      if (!caller?.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    return getNotificationPreferences(req, res);
  });
  app.post("/api/admin/test-email", testEmail);

  app.post("/api/admin/update-privileges", async (req, res) => {
    try {
      const { userId, isAdmin } = req.body;
      
      if (!userId || typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: "Invalid request data" });
      }
      
      await storage.updateUserPrivileges(userId, isAdmin);

      logAudit({
        actorUserId: req.session.userId ?? null,
        action: "user.privileges.update",
        targetType: "user",
        targetId: userId,
        metadata: { isAdmin },
      });

      res.json({ success: true, message: "Privileges updated successfully" });
    } catch (error) {
      console.error("Error updating privileges:", error);
      res.status(500).json({ error: "Failed to update privileges" });
    }
  });

  app.post("/api/leagues/remove-player", async (req, res) => {
    try {
      const { leagueId, userId } = req.body;
      
      if (!leagueId || !userId) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      if (!(await authorizeLeagueCommissioner(req, res, leagueId))) return;
      
      const success = await storage.removeLeagueMember(leagueId, userId);
      
      if (success) {
        logAudit({
          actorUserId: req.session.userId ?? null,
          leagueId,
          action: "league.member.remove",
          targetType: "user",
          targetId: userId,
          metadata: { via: "admin.remove-player" },
        });
        res.json({ success: true, message: "Player removed successfully" });
      } else {
        res.status(404).json({ error: "Player not found in league" });
      }
    } catch (error) {
      console.error("Error removing player:", error);
      res.status(500).json({ error: "Failed to remove player" });
    }
  });

  app.post("/api/leagues/reset-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      if (!(await authorizeLeagueCommissioner(req, res, leagueId))) return;
      
      await storage.resetDraft(leagueId);
      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId,
        action: "league.draft.reset",
        targetType: "league",
        targetId: leagueId,
      });
      res.json({ success: true, message: "Draft reset successfully" });
    } catch (error) {
      console.error("Error resetting draft:", error);
      res.status(500).json({ error: "Failed to reset draft" });
    }
  });

  // League-specific draft start endpoint (called by client) — commissioner or Super Admin
  app.post("/api/leagues/:leagueId/draft/start", async (req, res) => {
    try {
      const { leagueId } = req.params;
      
      if (!(await authorizeLeagueCommissioner(req, res, leagueId))) return;
      
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
      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId,
        action: "league.draft.start",
        targetType: "league",
        targetId: leagueId,
        metadata: { via: "league-scoped" },
      });

      // Send draft notification to the first player
      try {
        const draftStatus = await storage.getDraftStatus(leagueId);
        if (draftStatus.isActive && draftStatus.currentPlayer) {
          const members = await storage.getLeagueMembers(leagueId);
          const currentMember = members.find(m => m.draftPosition === 1);
          if (currentMember) {
            const currentUser = await storage.getUser(currentMember.userId!);
            if (currentUser && currentUser.draftNotifications) {
              console.log(`Sending draft notification for league ${league?.name}`);
              
              // Send email notification
              const { EmailService } = await import('./services/emailService.js');
              const emailService = new EmailService();
              const emailData = await buildDraftEmailData(leagueId, league?.sport || 'NFL');
              await emailService.sendDraftNotification(
                currentUser.email!,
                currentUser.displayName!,
                league?.name || 'League',
                draftStatus.currentPick,
                draftStatus.round,
                leagueId,
                emailData.draftedPicks,
                emailData.availableTeams
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

  app.post("/api/leagues/start-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }
      if (!(await authorizeLeagueCommissioner(req, res, leagueId))) return;
      
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
      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId,
        action: "league.draft.start",
        targetType: "league",
        targetId: leagueId,
        metadata: { via: "admin.start-draft" },
      });
      
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
              console.log(`Sending draft notification for league ${league?.name}`);
              
              // Send email notification
              const { EmailService } = await import('./services/emailService.js');
              const emailService = new EmailService();
              const emailData = await buildDraftEmailData(leagueId, league?.sport || 'NFL');
              await emailService.sendDraftNotification(
                currentUser.email!,
                currentUser.displayName!,
                league?.name || 'League',
                draftStatus.currentPick,
                draftStatus.round,
                leagueId,
                emailData.draftedPicks,
                emailData.availableTeams
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

  app.post("/api/leagues/stop-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "League ID required" });
      }
      if (!(await authorizeLeagueCommissioner(req, res, leagueId))) return;
      
      await storage.updateLeague(leagueId, { draftStatus: "pending" });
      logAudit({
        actorUserId: req.session.userId ?? null,
        leagueId,
        action: "league.draft.stop",
        targetType: "league",
        targetId: leagueId,
      });
      res.json({ success: true, message: "Draft stopped successfully" });
    } catch (error) {
      console.error("Error stopping draft:", error);
      res.status(500).json({ error: "Failed to stop draft" });
    }
  });

  // Pause/resume — commissioner or Super Admin;
  // league-scoped routes at /api/leagues/:leagueId/draft/{pause|resume} also exist
  app.post("/api/leagues/pause-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      const auth = await authorizeLeagueCommissioner(req, res, leagueId);
      if (!auth) return;
      const { league } = auth;
      if (league.draftStatus !== "active") return res.status(400).json({ error: "Draft is not currently active" });
      await storage.updateLeague(leagueId, { draftStatus: "paused" });
      logAudit({ actorUserId: req.session.userId ?? null, leagueId, action: "league.draft.pause", targetType: "league", targetId: leagueId });
      res.json({ success: true, message: "Draft paused successfully" });
    } catch (error) {
      console.error("Error pausing draft:", error);
      res.status(500).json({ error: "Failed to pause draft" });
    }
  });

  app.post("/api/leagues/resume-draft", async (req, res) => {
    try {
      const { leagueId } = req.body;
      const auth = await authorizeLeagueCommissioner(req, res, leagueId);
      if (!auth) return;
      const { league } = auth;
      if (league.draftStatus !== "paused") return res.status(400).json({ error: "Draft is not currently paused" });
      await storage.updateLeague(leagueId, { draftStatus: "active" });
      logAudit({ actorUserId: req.session.userId ?? null, leagueId, action: "league.draft.resume", targetType: "league", targetId: leagueId });
      res.json({ success: true, message: "Draft resumed successfully" });
    } catch (error) {
      console.error("Error resuming draft:", error);
      res.status(500).json({ error: "Failed to resume draft" });
    }
  });

  app.post("/api/leagues/undo-last-pick", async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      if (!(await authorizeLeagueCommissioner(req, res, leagueId))) return;
      
      const success = await storage.undoLastDraftPick(leagueId);
      
      if (success) {
        logAudit({
          actorUserId: req.session.userId ?? null,
          leagueId,
          action: "league.draft.undo_pick",
          targetType: "league",
          targetId: leagueId,
        });
        res.json({ success: true, message: "Last pick undone successfully" });
      } else {
        res.status(404).json({ error: "No picks to undo" });
      }
    } catch (error) {
      console.error("Error undoing last pick:", error);
      res.status(500).json({ error: "Failed to undo last pick" });
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

  // World Cup endpoints
  app.get("/api/world-cup/teams", async (req, res) => {
    try {
      const teams = await storage.getAllWorldCupTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: "Failed to get World Cup teams" });
    }
  });

  app.get("/api/world_cup/teams", async (req, res) => {
    try {
      const teams = await storage.getAllWorldCupTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: "Failed to get World Cup teams" });
    }
  });

  app.get("/api/world-cup/groups", async (req, res) => {
    try {
      const groups = await storage.getWorldCupGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "Failed to get World Cup groups" });
    }
  });

  app.get("/api/world-cup/bracket", async (req, res) => {
    try {
      const bracket = await storage.getWorldCupBracket();
      res.json(bracket);
    } catch (error) {
      res.status(500).json({ message: "Failed to get World Cup bracket" });
    }
  });

  app.get("/api/world-cup/games", async (req, res) => {
    try {
      const games = await storage.getWorldCupGames();
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to get World Cup games" });
    }
  });

  app.get("/api/leagues/:leagueId/world-cup/standings", async (req, res) => {
    try {
      const standings = await storage.getWorldCupPlayerStandings(req.params.leagueId);
      res.json(standings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get World Cup standings" });
    }
  });

  app.post("/api/admin/sync-world-cup", async (req, res) => {
    try {
      const { worldCupDataService } = await import("./services/worldCupService");
      await worldCupDataService.syncWorldCupGames();
      logAudit({ actorUserId: req.session.userId ?? null, action: "sport.worldcup.sync" });
      res.json({ message: "World Cup games synced successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync World Cup games" });
    }
  });

  // ESPN API integration endpoints
  app.post("/api/admin/update-mlb-standings", async (req, res) => {
    try {
      const { SportsDataService } = await import("./sportsDataService");
      const sportsService = new SportsDataService(storage);
      await sportsService.updateMLBStandings();
      logAudit({ actorUserId: req.session.userId ?? null, action: "sport.mlb.standings.update" });
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
  // Accepts optional { sport: "NFL" | "MLB" | "NBA" } body to limit the sync to one sport.
  // When sport is omitted the legacy full-sync (MLB standings + ESPN team standings) runs.
  app.post("/api/admin/sync-live-scores", async (req, res) => {
    try {
      const { SportsDataService } = await import("./sportsDataService");
      const sportsService = new SportsDataService(storage);
      const { sportsApi } = await import("./services/sportsApi");

      const sport = (req.body?.sport as string | undefined)?.toUpperCase();
      const validSports = ["NFL", "MLB", "NBA"];

      if (sport && !validSports.includes(sport)) {
        return res.status(400).json({ message: `Invalid sport. Must be one of: ${validSports.join(", ")}` });
      }

      let message = "Live scores synced successfully";

      if (sport === "MLB") {
        await sportsService.updateMLBStandings();
        await sportsApi.syncMLBGames();
        message = "MLB standings and games synced successfully";
      } else if (sport === "NBA") {
        await sportsService.updateNBAStandings();
        await sportsApi.syncNBAGames();
        message = "NBA standings and games synced successfully";
      } else if (sport === "NFL") {
        await sportsService.updateNFLStandings();
        await sportsApi.syncTeamStandingsFromESPN();
        message = "NFL standings synced successfully";
      } else {
        // Legacy full-sync (no sport specified)
        await sportsService.updateMLBStandings();
        await sportsApi.syncTeamStandingsFromESPN();
      }

      logAudit({
        actorUserId: req.session.userId ?? null,
        action: "sport.live_scores.sync",
        metadata: { sport: sport ?? "all" },
      });

      res.json({
        message,
        timestamp: new Date().toISOString(),
        sport: sport ?? "all",
      });
    } catch (error) {
      console.error("Live scoring sync error:", error);
      res.status(500).json({ message: "Failed to sync live scores" });
    }
  });

  // Per-sport sync status for the admin dashboard. Reads the
  // metadata written by scripts/live-score-worker.ts and combines
  // it with the same in-season / live-game logic the worker uses
  // so admins can see the current cadence + last sync at a glance.
  app.get("/api/admin/sync-status", async (_req, res) => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const inQuietHours = hour >= 2 && hour < 6;

      const inCalendarSeason = (sport: "MLB" | "NBA" | "NFL") => {
        const m = now.getMonth();
        if (sport === "MLB") return m >= 2 && m <= 8;
        if (sport === "NBA") return m >= 9 || m <= 3;
        return m >= 8 || m === 0;
      };

      const statuses = await storage.getAllSyncStatuses();
      const bySport = new Map(statuses.map(s => [s.sport, s]));

      const sports = ["MLB", "NBA", "NFL"] as const;
      const result = await Promise.all(sports.map(async (sport) => {
        const [live, hasUpcoming] = await Promise.all([
          storage.hasGamesInProgressBySport(sport),
          storage.hasUpcomingRegularSeasonGames(sport, 14),
        ]);
        const inSeason = inCalendarSeason(sport) || hasUpcoming;

        let cadence: "live" | "idle" | "quiet" | "off_season";
        let intervalLabel: string;
        if (!inSeason) {
          cadence = "off_season";
          intervalLabel = "Off-season";
        } else if (inQuietHours) {
          cadence = "quiet";
          intervalLabel = "Quiet (1h)";
        } else if (live) {
          cadence = "live";
          intervalLabel = "Live (2m)";
        } else {
          cadence = "idle";
          intervalLabel = "Idle (15m)";
        }

        const row = bySport.get(sport);
        return {
          sport,
          cadence,
          intervalLabel,
          liveGameInProgress: live,
          inSeason,
          lastSyncAt: row?.lastSyncAt ?? null,
          lastSuccessAt: row?.lastSuccessAt ?? null,
          lastDurationMs: row?.lastDurationMs ?? null,
          lastError: row?.lastError ?? null,
        };
      }));

      res.json({ now: now.toISOString(), sports: result });
    } catch (error) {
      console.error("GET /api/admin/sync-status error:", error);
      res.status(500).json({ message: "Failed to load sync status" });
    }
  });

  // Super Admin dashboard — single endpoint returning platform-wide read-only snapshot
  app.get("/api/admin/super-dashboard", async (_req, res) => {
    try {
      const data = await storage.getSuperDashboardData();
      // Strip sensitive fields from user objects before sending to client
      const safeUsers = data.users.map(({ password, resetToken, resetTokenExpiresAt, ...u }) => u);
      res.json({ ...data, users: safeUsers });
    } catch (error) {
      console.error("GET /api/admin/super-dashboard error:", error);
      res.status(500).json({ message: "Failed to load super dashboard data" });
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
      const { userId, endpoint } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const { pushNotificationService } = await import("./services/pushNotificationService");
      if (endpoint) {
        await pushNotificationService.unsubscribeEndpoint(endpoint);
      } else {
        await pushNotificationService.unsubscribeUser(userId);
      }
      
      res.json({ message: "Successfully unsubscribed from push notifications" });
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      res.status(500).json({ message: "Failed to unsubscribe from push notifications" });
    }
  });

  const httpServer = createServer(app);

  // Background score syncing has been moved to scripts/live-score-worker.ts
  // so the web server can be deployed as Autoscale without spawning sync
  // loops in every instance. Run `npm run worker:live-scores` to start it.

  return httpServer;
}
