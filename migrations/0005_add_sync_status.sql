CREATE TABLE IF NOT EXISTS "sync_status" (
  "sport" varchar PRIMARY KEY NOT NULL,
  "last_sync_at" timestamp,
  "last_success_at" timestamp,
  "last_duration_ms" integer,
  "last_error" text
);
