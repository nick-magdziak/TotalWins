import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  displayName: text("display_name").notNull(),
  isAdmin: boolean("is_admin").default(false),
  notifications: boolean("notifications").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leagues = pgTable("leagues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  season: text("season").notNull(),
  sport: text("sport").notNull().default("NFL"),
  teamsPerPlayer: integer("teams_per_player").notNull().default(4),
  maxPlayers: integer("max_players").notNull().default(8),
  draftStatus: text("draft_status").notNull().default("pending"), // pending, active, completed
  seasonStatus: text("season_status").notNull().default("pre_season"), // pre_season, active, completed
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leagueMembers = pgTable("league_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").references(() => leagues.id),
  userId: varchar("user_id").references(() => users.id),
  draftPosition: integer("draft_position"),
  totalWins: integer("total_wins").default(0),
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

export const draftPicks = pgTable("draft_picks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").references(() => leagues.id),
  userId: varchar("user_id").references(() => users.id),
  teamId: varchar("team_id").references(() => nflTeams.id),
  pickNumber: integer("pick_number").notNull(),
  round: integer("round").notNull(),
  pickedAt: timestamp("picked_at").defaultNow(),
});

export const games = pgTable("games", {
  id: varchar("id").primaryKey(),
  week: integer("week").notNull(),
  season: text("season").notNull(),
  homeTeamId: varchar("home_team_id").references(() => nflTeams.id),
  awayTeamId: varchar("away_team_id").references(() => nflTeams.id),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed
  gameDate: timestamp("game_date").notNull(),
  completedAt: timestamp("completed_at"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type LeagueMember = typeof leagueMembers.$inferSelect;
export type InsertLeagueMember = z.infer<typeof insertLeagueMemberSchema>;
export type NFLTeam = typeof nflTeams.$inferSelect;
export type DraftPick = typeof draftPicks.$inferSelect;
export type InsertDraftPick = z.infer<typeof insertDraftPickSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

// Extended types for frontend
export type PlayerStanding = {
  userId: string;
  displayName: string;
  totalWins: number;
  teams: NFLTeam[];
  rank: number;
};

export type DraftStatus = {
  isActive: boolean;
  currentPick: number;
  currentPlayer: string;
  round: number;
};
