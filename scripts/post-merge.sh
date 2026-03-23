#!/bin/bash
set -e

npm install

# Run database migrations to ensure all tables/columns exist
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
async function migrate() {
  await sql\`
    DO \$\$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='wc_round') THEN
        ALTER TABLE games ADD COLUMN wc_round text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='wc_group') THEN
        ALTER TABLE games ADD COLUMN wc_group text;
      END IF;
    END \$\$
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS world_cup_teams (
      id varchar PRIMARY KEY,
      name text NOT NULL,
      abbreviation text NOT NULL,
      \"group\" text NOT NULL,
      confederation text NOT NULL,
      qualified boolean DEFAULT true,
      placeholder text,
      fifa_ranking integer,
      flag_emoji text
    )
  \`;
  console.log('Database migration completed');
}
migrate().catch(console.error);
"
