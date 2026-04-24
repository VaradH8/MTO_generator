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
    `CREATE TABLE IF NOT EXISTS settings (
       key   VARCHAR(100) PRIMARY KEY,
       value TEXT NOT NULL DEFAULT ''
     )`,
    `ALTER TABLE master_type_items ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE project_type_items ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE master_types ADD COLUMN IF NOT EXISTS classification VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (classification IN ('internal','external'))`,
    `ALTER TABLE project_support_types ADD COLUMN IF NOT EXISTS classification VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (classification IN ('internal','external'))`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS mapping JSONB NOT NULL DEFAULT '{}'::jsonb`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS table_rows JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE master_type_items ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE master_type_items ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE project_type_items ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE project_type_items ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS project_pdf_versions (
       id               VARCHAR(50) PRIMARY KEY,
       project_id       VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
       generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       generated_by     VARCHAR(100) NOT NULL DEFAULT 'unknown',
       label            VARCHAR(255) NOT NULL DEFAULT '',
       row_count        INTEGER NOT NULL DEFAULT 0,
       type_count       INTEGER NOT NULL DEFAULT 0,
       rows_snapshot    JSONB NOT NULL DEFAULT '[]'::jsonb,
       type_configs     JSONB NOT NULL DEFAULT '[]'::jsonb
     )`,
    `CREATE INDEX IF NOT EXISTS idx_pdf_versions_project ON project_pdf_versions(project_id, generated_at DESC)`,
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

// Migrations are triggered lazily on the first DB-using API request
// (see wrapping in API routes), NOT at module load. Running them here
// would fail at build time when DATABASE_URL points to an unreachable host.

export default pool
