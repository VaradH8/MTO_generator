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
    // Plate flags moved to the type level (one pair per type, not per item).
    // Boolean columns kept for backward compat — superseded by the qty TEXT
    // columns below, which are the new source of truth.
    `ALTER TABLE master_types ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE master_types ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE project_support_types ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE project_support_types ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE`,
    // Plate qty TEXT columns: empty string = off, non-empty = displayed
    // quantity for the row-level With Plate / Without Plate column.
    `ALTER TABLE master_types ADD COLUMN IF NOT EXISTS with_plate_qty TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE master_types ADD COLUMN IF NOT EXISTS without_plate_qty TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE project_support_types ADD COLUMN IF NOT EXISTS with_plate_qty TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE project_support_types ADD COLUMN IF NOT EXISTS without_plate_qty TEXT NOT NULL DEFAULT ''`,
    // One-time backfill: lift any per-item plate ticks up to the type level
    // so existing configs aren't visually reset to "all false". Gated by a
    // settings-row flag so subsequent ensureMigrations calls don't re-run
    // and clobber a user who has explicitly unticked a type-level flag.
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'migration.type_plate_flags_v1') THEN
         UPDATE master_types mt SET
           with_plate = COALESCE((SELECT BOOL_OR(with_plate) FROM master_type_items WHERE master_type_id = mt.id), FALSE),
           without_plate = COALESCE((SELECT BOOL_OR(without_plate) FROM master_type_items WHERE master_type_id = mt.id), FALSE);
         UPDATE project_support_types pst SET
           with_plate = COALESCE((SELECT BOOL_OR(with_plate) FROM project_type_items WHERE project_support_type_id = pst.id), FALSE),
           without_plate = COALESCE((SELECT BOOL_OR(without_plate) FROM project_type_items WHERE project_support_type_id = pst.id), FALSE);
         INSERT INTO settings (key, value) VALUES ('migration.type_plate_flags_v1', 'done')
           ON CONFLICT (key) DO NOTHING;
       END IF;
     END $$`,
    // Once-only backfill from BOOLEAN flag → qty TEXT. TRUE rows seed "1"
    // so the previously-ticked type stays "on" with a placeholder quantity
    // the user can adjust. Gated by a separate settings flag.
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'migration.type_plate_qty_v1') THEN
         UPDATE master_types SET with_plate_qty = '1'
           WHERE with_plate = TRUE AND COALESCE(with_plate_qty, '') = '';
         UPDATE master_types SET without_plate_qty = '1'
           WHERE without_plate = TRUE AND COALESCE(without_plate_qty, '') = '';
         UPDATE project_support_types SET with_plate_qty = '1'
           WHERE with_plate = TRUE AND COALESCE(with_plate_qty, '') = '';
         UPDATE project_support_types SET without_plate_qty = '1'
           WHERE without_plate = TRUE AND COALESCE(without_plate_qty, '') = '';
         INSERT INTO settings (key, value) VALUES ('migration.type_plate_qty_v1', 'done')
           ON CONFLICT (key) DO NOTHING;
       END IF;
     END $$`,
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

  await syncProjectTypesToMasterOnce()
}

/** One-time backfill: copy every project-defined support type that is NOT
 *  already present in master_types (matched by name + classification) up to
 *  master_types, including its items. Idempotent — gated by a settings-row
 *  flag so subsequent boots skip the work. Strictly additive: never deletes
 *  or modifies an existing master_type row. */
async function syncProjectTypesToMasterOnce(): Promise<void> {
  const flagKey = "migration.master_types_from_projects_v1"
  try {
    const { rows: flagRows } = await pool.query(
      `SELECT 1 FROM settings WHERE key = $1`,
      [flagKey],
    )
    if (flagRows.length > 0) return

    const { rows: projTypes } = await pool.query(
      `SELECT id, type_name, classification, with_plate, without_plate, with_plate_qty, without_plate_qty
         FROM project_support_types`,
    )
    if (projTypes.length === 0) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, 'done') ON CONFLICT (key) DO NOTHING`,
        [flagKey],
      )
      return
    }

    const { rows: masterRows } = await pool.query(
      `SELECT type_name, classification FROM master_types`,
    )
    const masterKey = (n: string, c: string) => `${(n || "").trim().toLowerCase()}::${c || "internal"}`
    const masterKeys = new Set<string>(
      masterRows.map((m: { type_name: string; classification: string }) =>
        masterKey(m.type_name, m.classification),
      ),
    )

    const seen = new Set<string>()
    const toCopy: typeof projTypes = []
    for (const pt of projTypes) {
      const key = masterKey(pt.type_name, pt.classification)
      if (masterKeys.has(key) || seen.has(key)) continue
      seen.add(key)
      toCopy.push(pt)
    }

    let added = 0
    for (const pt of toCopy) {
      const newId = "mig_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      await pool.query(
        `INSERT INTO master_types (id, type_name, classification, with_plate, without_plate, with_plate_qty, without_plate_qty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newId,
          pt.type_name,
          pt.classification || "internal",
          !!pt.with_plate,
          !!pt.without_plate,
          pt.with_plate_qty || "",
          pt.without_plate_qty || "",
        ],
      )
      const { rows: items } = await pool.query(
        `SELECT item_id, item_name, qty, make, model, variants, with_plate, without_plate
           FROM project_type_items WHERE project_support_type_id = $1`,
        [pt.id],
      )
      for (const it of items) {
        const variantsJson =
          Array.isArray(it.variants) ? JSON.stringify(it.variants)
          : typeof it.variants === "string" ? it.variants
          : "[]"
        await pool.query(
          `INSERT INTO master_type_items (master_type_id, item_id, item_name, qty, make, model, variants, with_plate, without_plate)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
          [
            newId,
            it.item_id || "",
            it.item_name || "",
            it.qty || "",
            it.make || "",
            it.model || "",
            variantsJson,
            !!it.with_plate,
            !!it.without_plate,
          ],
        )
      }
      added++
    }

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, 'done') ON CONFLICT (key) DO NOTHING`,
      [flagKey],
    )
    if (added > 0) {
      console.log(`[db] synced ${added} project types into master_types`)
    }
  } catch (err) {
    console.error("[db] syncProjectTypesToMasterOnce failed:", err)
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
