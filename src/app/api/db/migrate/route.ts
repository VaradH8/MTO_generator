import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"
import fs from "fs"
import path from "path"

export async function GET(_req: NextRequest) {
  const results: { step: string; ok: boolean; error?: string }[] = []

  // 1) Run the incremental idempotent migrations FIRST so the new columns
  //    get added even if init.sql later fails on some legacy statement.
  try {
    await ensureMigrations()
    results.push({ step: "ensureMigrations", ok: true })
  } catch (e) {
    results.push({ step: "ensureMigrations", ok: false, error: e instanceof Error ? e.message : String(e) })
  }

  // 2) Re-run init.sql for any tables that don't exist yet. All statements
  //    use IF NOT EXISTS / DO blocks, so this is idempotent.
  try {
    const sqlPath = path.join(process.cwd(), "db/init.sql")
    const sql = fs.readFileSync(sqlPath, "utf-8")
    await pool.query(sql)
    results.push({ step: "init.sql", ok: true })
  } catch (e) {
    results.push({ step: "init.sql", ok: false, error: e instanceof Error ? e.message : String(e) })
  }

  const allOk = results.every((r) => r.ok)
  return NextResponse.json({ success: allOk, results }, { status: allOk ? 200 : 500 })
}
