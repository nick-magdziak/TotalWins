CREATE TABLE "draft_picks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" varchar,
	"user_id" varchar,
	"team_id" varchar NOT NULL,
	"sport" text DEFAULT 'NFL',
	"pick_number" integer NOT NULL,
	"round" integer NOT NULL,
	"picked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" varchar PRIMARY KEY NOT NULL,
	"sport" text DEFAULT 'NFL',
	"week" integer,
	"season" text NOT NULL,
	"home_team_id" varchar NOT NULL,
	"away_team_id" varchar NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"game_date" timestamp NOT NULL,
	"completed_at" timestamp,
	"period" text,
	"wc_round" text,
	"wc_group" text
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" varchar,
	"user_id" varchar,
	"draft_position" integer,
	"total_wins" integer DEFAULT 0,
	"draft_notifications" boolean DEFAULT true,
	"game_notifications" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"season" text NOT NULL,
	"sport" text DEFAULT 'NFL' NOT NULL,
	"teams_per_player" integer DEFAULT 4 NOT NULL,
	"max_players" integer DEFAULT 8 NOT NULL,
	"draft_type" text DEFAULT 'snake' NOT NULL,
	"draft_configuration" text,
	"draft_status" text DEFAULT 'pending' NOT NULL,
	"season_status" text DEFAULT 'pre_season' NOT NULL,
	"invite_code" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "leagues_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "mlb_teams" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"abbreviation" text NOT NULL,
	"division" text NOT NULL,
	"league" text NOT NULL,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "nba_teams" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"abbreviation" text NOT NULL,
	"division" text NOT NULL,
	"conference" text NOT NULL,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "nfl_teams" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"abbreviation" text NOT NULL,
	"division" text NOT NULL,
	"conference" text NOT NULL,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0,
	"ties" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text NOT NULL,
	"is_admin" boolean DEFAULT false,
	"notifications" boolean DEFAULT true,
	"draft_notifications" boolean DEFAULT true,
	"standings_notifications" boolean DEFAULT true,
	"push_subscription" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "world_cup_teams" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"group" text NOT NULL,
	"confederation" text NOT NULL,
	"qualified" boolean DEFAULT true,
	"placeholder" text,
	"fifa_ranking" integer,
	"flag_emoji" text
);
--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;