-- ══════════════════════════════════════════════════════════════════════
-- MTO Generator — PostgreSQL Schema
-- Replaces all localStorage persistence
-- ══════════════════════════════════════════════════════════════════════

-- ── Users & Auth ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user'
                CHECK (role IN ('admin', 'user', 'client')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default users (passwords should be hashed in production)
INSERT INTO users (username, password_hash, role) VALUES
  ('Varad',  'Admin123',    'admin'),
  ('User',   'default123',  'user'),
  ('Client', 'client123',   'client')
ON CONFLICT (username) DO NOTHING;

-- ── Settings: Key/Value Store (PDF template, etc.) ─────────────────

CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- ── Settings: Master Items ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS master_items (
  id    VARCHAR(50) PRIMARY KEY,
  name  VARCHAR(255) NOT NULL
);

-- ── Settings: Master Type Configs ───────────────────────────────────

CREATE TABLE IF NOT EXISTS master_types (
  id        VARCHAR(50) PRIMARY KEY,
  type_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS master_type_items (
  id             SERIAL PRIMARY KEY,
  master_type_id VARCHAR(50) NOT NULL REFERENCES master_types(id) ON DELETE CASCADE,
  item_id        VARCHAR(50) NOT NULL,
  item_name      VARCHAR(255) NOT NULL,
  qty            VARCHAR(50) NOT NULL DEFAULT '',
  make           VARCHAR(255) NOT NULL DEFAULT '',
  model          VARCHAR(255) NOT NULL DEFAULT '',
  variants       JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE master_type_items ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]';
ALTER TABLE master_type_items ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE master_type_items ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE master_types ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE master_types ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Projects ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id             VARCHAR(50) PRIMARY KEY,
  client_name    VARCHAR(255) NOT NULL,
  created_by     VARCHAR(100) NOT NULL DEFAULT 'unknown',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  support_range  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT FALSE,
  table_rows     JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS table_rows JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Project PDF Versions (history of every Combined PDF generation) ─

CREATE TABLE IF NOT EXISTS project_pdf_versions (
  id            VARCHAR(50) PRIMARY KEY,
  project_id    VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by  VARCHAR(100) NOT NULL DEFAULT 'unknown',
  label         VARCHAR(255) NOT NULL DEFAULT '',
  row_count     INTEGER NOT NULL DEFAULT 0,
  type_count    INTEGER NOT NULL DEFAULT 0,
  rows_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  type_configs  JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_pdf_versions_project ON project_pdf_versions(project_id, generated_at DESC);

-- ── Project Support Types ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_support_types (
  id          SERIAL PRIMARY KEY,
  project_id  VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type_name   VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS project_type_items (
  id                      SERIAL PRIMARY KEY,
  project_support_type_id INTEGER NOT NULL REFERENCES project_support_types(id) ON DELETE CASCADE,
  item_id                 VARCHAR(50) NOT NULL,
  item_name               VARCHAR(255) NOT NULL,
  qty                     VARCHAR(50) NOT NULL DEFAULT '',
  make                    VARCHAR(255) NOT NULL DEFAULT '',
  model                   VARCHAR(255) NOT NULL DEFAULT '',
  variants                JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE project_type_items ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]';
ALTER TABLE project_type_items ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE project_type_items ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE project_support_types ADD COLUMN IF NOT EXISTS with_plate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE project_support_types ADD COLUMN IF NOT EXISTS without_plate BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Upload Records ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS uploads (
  id            VARCHAR(50) PRIMARY KEY,
  project_id    VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_count     INTEGER NOT NULL DEFAULT 0,
  types         JSONB NOT NULL DEFAULT '[]',
  support_keys  JSONB NOT NULL DEFAULT '[]',
  new_supports    INTEGER NOT NULL DEFAULT 0,
  revisions       INTEGER NOT NULL DEFAULT 0,
  classification  VARCHAR(20) NOT NULL DEFAULT 'internal'
                  CHECK (classification IN ('internal', 'external'))
);

-- ── Activity Log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_log (
  id          VARCHAR(50) PRIMARY KEY,
  project_id  VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username    VARCHAR(100) NOT NULL,
  action      VARCHAR(20) NOT NULL
              CHECK (action IN ('upload', 'approve', 'reject', 'bill', 'config', 'create')),
  detail      TEXT NOT NULL DEFAULT ''
);

-- ── Support Rows (parsed Excel data) ────────────────────────────────

CREATE TABLE IF NOT EXISTS support_rows (
  id               SERIAL PRIMARY KEY,
  project_id       VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  upload_id        VARCHAR(50) REFERENCES uploads(id) ON DELETE SET NULL,
  row_index        INTEGER NOT NULL,
  support_tag_name VARCHAR(255) NOT NULL DEFAULT '',
  discipline       VARCHAR(100) NOT NULL DEFAULT '',
  type             VARCHAR(100) NOT NULL DEFAULT '',
  a                VARCHAR(50) NOT NULL DEFAULT '',
  b                VARCHAR(50) NOT NULL DEFAULT '',
  c                VARCHAR(50) NOT NULL DEFAULT '',
  d                VARCHAR(50) NOT NULL DEFAULT '',
  total            VARCHAR(50) NOT NULL DEFAULT '0',
  items            JSONB NOT NULL DEFAULT '[]',
  x                VARCHAR(50) NOT NULL DEFAULT '',
  y                VARCHAR(50) NOT NULL DEFAULT '',
  z                VARCHAR(50) NOT NULL DEFAULT '',
  x_grid           VARCHAR(100) NOT NULL DEFAULT '',
  y_grid           VARCHAR(100) NOT NULL DEFAULT '',
  remarks          TEXT NOT NULL DEFAULT '',
  has_errors       BOOLEAN NOT NULL DEFAULT FALSE,
  missing_fields   JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_support_rows_project ON support_rows(project_id);
CREATE INDEX IF NOT EXISTS idx_support_rows_type ON support_rows(type);

-- ── PDF Approvals ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pdf_approvals (
  id             VARCHAR(50) PRIMARY KEY,
  project_id     VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_name   VARCHAR(255) NOT NULL,
  generated_by   VARCHAR(100) NOT NULL,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  support_count  INTEGER NOT NULL DEFAULT 0,
  types          JSONB NOT NULL DEFAULT '{}',
  support_keys   JSONB NOT NULL DEFAULT '[]',
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by    VARCHAR(100),
  reviewed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON pdf_approvals(status);

-- ── Billing ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_entries (
  id            VARCHAR(50) PRIMARY KEY,
  cycle_id      VARCHAR(50),
  date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_name     VARCHAR(255) NOT NULL,
  support_count INTEGER NOT NULL DEFAULT 0,
  support_keys  JSONB NOT NULL DEFAULT '[]',
  types         JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS billing_cycles (
  id              VARCHAR(50) PRIMARY KEY,
  billed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_supports  INTEGER NOT NULL DEFAULT 0,
  amount_due      NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Link entries to their cycle once billed (idempotent: only adds if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_cycle'
  ) THEN
    ALTER TABLE billing_entries
      ADD CONSTRAINT fk_billing_cycle
      FOREIGN KEY (cycle_id) REFERENCES billing_cycles(id) ON DELETE SET NULL;
  END IF;
END $$;
