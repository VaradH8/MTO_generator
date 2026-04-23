import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

// GET /api/projects/tables — returns { [projectId]: SupportRow[] } for every
// project that has a persisted table snapshot. Used by ProjectTableContext to
// hydrate all project tables in a single round trip.
export async function GET(_req: NextRequest) {
  try {
    await ensureMigrations()
    const { rows } = await pool.query(
      `SELECT id, table_rows FROM projects`
    )
    const map: Record<string, unknown> = {}
    for (const r of rows) {
      const arr = Array.isArray(r.table_rows) ? r.table_rows : []
      if (arr.length > 0) map[r.id] = arr
    }
    return NextResponse.json(map)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
