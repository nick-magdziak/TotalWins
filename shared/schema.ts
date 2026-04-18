import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const worldCupTeams = pgTable("world_cup_teams", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  group: text("group").notNull(), // A-L
  confederation: text("confederation").notNull(), // UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC
  qualified: boolean("qualified").default(true),
  placeholder: text("placeholder"), // e.g., "UEFA Path D Winner" if not yet qualified
  fifaRanking: integer("fifa_ranking"),
  flagEmoji: text("flag_emoji"),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  displayName: text("display_name").notNull(),
  isAdmin: boolean("is_admin").default(false),
  notifications: boolean("notifications").default(true),
  draftNotifications: boolean("draft_notifications").default(true),
  standingsNotifications: boolean("standings_notifications").default(true),
  pushSubscription: jsonb("push_subscription"), // Store push subscription data
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leagues = pgTable("leagues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  season: text("season").notNull(),
  sport: text("sport").notNull().default("NFL"),
  teamsPerPlayer: integer("teams_per_player").notNull().default(4),
  maxPlayers: integer("max_players").notNull().default(8),
  draftType: text("draft_type").notNull().default("snake"), // snake, linear, custom_10_30
  draftConfiguration: text("draft_configuration"), // e.g., "4_players_8_teams" for the new unified config
  draftScheduledAt: timestamp("draft_scheduled_at"), // optional scheduled draft date/time
  draftStatus: text("draft_status").notNull().default("pending"), // pending, active, completed
  seasonStatus: text("season_status").notNull().default("pre_season"), // pre_season, active, completed
  inviteCode: text("invite_code").unique(),
  createdBy: varchar("created_by").references(() => users.id),
  parentLeagueId: varchar("parent_league_id").references((): AnyPgColumn => leagues.id), // franchise parent; null = this IS the root
  createdAt: timestamp("created_at").defaultNow(),
});

export const leagueMembers = pgTable("league_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").references(() => leagues.id),
  userId: varchar("user_id").references(() => users.id),
  draftPosition: integer("draft_position"),
  totalWins: integer("total_wins").default(0),
  draftNotifications: boolean("draft_notifications").default(true),
  gameNotifications: boolean("game_notifications").default(false),
  invitationStatus: text("invitation_status").notNull().default("active"), // active, pending
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const nflTeams = pgTable("nfl_teams", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  abbreviation: text("abbreviation").notNull(),
  division: text("division").notNull(),
  conference: text("conference").notNull(),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  ties: integer("ties").default(0),
});

export const mlbTeams = pgTable("mlb_teams", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  abbreviation: text("abbreviation").notNull(),
  division: text("division").notNull(),
  league: text("league").notNull(), // AL or NL
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
});

export const nbaTeams = pgTable("nba_teams", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  abbreviation: text("abbreviation").notNull(),
  division: text("division").notNull(),
  conference: text("conference").notNull(),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
});

export const draftPicks = pgTable("draft_picks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").references(() => leagues.id),
  userId: varchar("user_id").references(() => users.id),
  teamId: varchar("team_id").notNull(), // Generic team reference based on sport
  sport: text("sport").default("NFL"), // NFL, MLB, NBA
  pickNumber: integer("pick_number").notNull(),
  round: integer("round").notNull(),
  pickedAt: timestamp("picked_at").defaultNow(),
});

export const games = pgTable("games", {
  id: varchar("id").primaryKey(),
  sport: text("sport").default("NFL"), // NFL, MLB, NBA, WORLD_CUP
  week: integer("week"), // For NFL, null for MLB/NBA/WORLD_CUP
  season: text("season").notNull(),
  homeTeamId: varchar("home_team_id").notNull(),
  awayTeamId: varchar("away_team_id").notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed
  gameDate: timestamp("game_date").notNull(),
  completedAt: timestamp("completed_at"),
  period: text("period"), // e.g., "Top 9", "Q4 2:45", "Bottom 7"
  seasonType: text("season_type").default("regular"), // 'regular' | 'postseason' | 'preseason' (MLB/NBA)
  wcRound: text("wc_round"), // group_stage, round_of_32, round_of_16, quarterfinal, semifinal, third_place, final
  wcGroup: text("wc_group"), // A-L for group stage games
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  displayName: z.string().min(1).max(16, "Display name must be 16 characters or less"),
});

export const updateUserProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  displayName: z.string().min(1).max(16, "Display name must be 16 characters or less"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const insertLeagueSchema = createInsertSchema(leagues).omit({
  id: true,
  createdAt: true,
});

export const insertLeagueMemberSchema = createInsertSchema(leagueMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertDraftPickSchema = createInsertSchema(draftPicks).omit({
  id: true,
  pickedAt: true,
});

export const insertGameSchema = createInsertSchema(games);

export const insertWorldCupTeamSchema = createInsertSchema(worldCupTeams);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type LeagueMember = typeof leagueMembers.$inferSelect;
export type InsertLeagueMember = z.infer<typeof insertLeagueMemberSchema>;
export type NFLTeam = typeof nflTeams.$inferSelect;
export type MLBTeam = typeof mlbTeams.$inferSelect;
export type NBATeam = typeof nbaTeams.$inferSelect;
export type WorldCupTeam = typeof worldCupTeams.$inferSelect;
export type InsertWorldCupTeam = z.infer<typeof insertWorldCupTeamSchema>;
export type DraftPick = typeof draftPicks.$inferSelect;
export type InsertDraftPick = z.infer<typeof insertDraftPickSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

// World Cup round type
export type WCRound = "group_stage" | "round_of_32" | "round_of_16" | "quarterfinal" | "semifinal" | "third_place" | "final";

// World Cup group standing for a team
export type WCGroupStanding = {
  teamId: string;
  name: string;
  abbreviation: string;
  flagEmoji: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  advanced: boolean;
};

// World Cup player standing with tiebreaker data
export type WCPlayerStanding = {
  userId: string;
  displayName: string;
  fantasyPoints: number;
  teams: (WorldCupTeam & { wins: number })[];
  rank: number;
  goalsFor: number;
  goalsAgainst: number;
  knockoutGoalsFor: number;
  knockoutGoalsAgainst: number;
};

// Extended types for frontend
export type PlayerStanding = {
  userId: string;
  displayName: string;
  totalWins: number;
  teams: (NFLTeam | MLBTeam | NBATeam)[];
  rank: number;
};

export type DraftStatus = {
  isActive: boolean;
  isPaused: boolean;
  currentPick: number;
  currentPlayer: string;
  round: number;
};
