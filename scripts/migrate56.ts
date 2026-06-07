import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS discord_standings_enabled boolean DEFAULT true`);
  await db.execute(sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS discord_draft_board_enabled boolean DEFAULT false`);
  await db.execute(sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS last_draft_board_posted_at timestamp`);
  console.log("Migration OK");
  process.exit(0);
}
migrate().catch(e => { console.error(e.message); process.exit(1); });
