CREATE INDEX IF NOT EXISTS "draft_picks_league_user_idx" ON "draft_picks" ("league_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_sport_season_status_idx" ON "games" ("sport", "season", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_game_date_idx" ON "games" ("game_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_members_user_invitation_idx" ON "league_members" ("user_id", "invitation_status");
