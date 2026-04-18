import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
})

/**
 * Idempotent runtime migrations. Runs on every process start. Every statement
 * must be safe to re-run (IF NOT EXISTS, etc.). Keep small — heavyweight
 * migrations belong in a proper migration tool.
 */
let migrationPromise: Promise<void> | null = null
async function runMigrations(): Promise<void> {
  const statements = [
    `ALTER TABLE master_type_items ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE project_type_items ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb`,
  ]
  for (const sql of statements) {
    try {
      await pool.query(sql)
    } catch (err) {
      console.error("[db] migration failed:", sql, err)
    }
  }
}

export function ensureMigrations(): Promise<void> {
  if (!migrationPromise) migrationPromise = runMigrations()
  return migrationPromise
}

// Fire-and-forget on module load so the pool is ready before the first query.
ensureMigrations().catch((err) => console.error("[db] migration error:", err))

export default pool
