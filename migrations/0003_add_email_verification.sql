CREATE TABLE "email_verification_tokens" (
"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"user_id" varchar NOT NULL,
"token_hash" text NOT NULL,
"expires_at" timestamp NOT NULL,
"consumed_at" timestamp,
"created_at" timestamp DEFAULT now(),
CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified_at" timestamp;
--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- One-time grandfather backfill: every account that existed before
-- the email-verification feature shipped is treated as verified.
UPDATE "users" SET "verified_at" = COALESCE("created_at", NOW()) WHERE "verified_at" IS NULL;
