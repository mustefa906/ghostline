import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Db | null = null;

export async function tryPostgres(connectionString: string): Promise<Db> {
  if (db) return db;
  const candidate = new Pool({ connectionString, max: 5 });
  try {
    await candidate.query("SELECT 1");
    await ensureSchema(candidate);
  } catch (error) {
    await candidate.end().catch(() => undefined);
    throw error;
  }
  pool = candidate;
  db = drizzle(pool, { schema });
  return db;
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS founders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      linkedin_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS fingerprint_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
      transcript TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'recording',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS interview_turns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS drafts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
      founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      source_note TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT 'original',
      edited_body TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_for TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
