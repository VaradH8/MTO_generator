import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

// GET /api/projects/[id]/table — returns { rows: SupportRow[] }
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
    const { id } = await params
    const { rows } = await pool.query(
      `SELECT table_rows FROM projects WHERE id = $1`,
      [id]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    const arr = Array.isArray(rows[0].table_rows) ? rows[0].table_rows : []
    return NextResponse.json({ rows: arr })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/projects/[id]/table — body: { rows: SupportRow[] }
// Overwrites the stored table snapshot for this project. Upload records and
// other project data are untouched.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
    const { id } = await params
    const body = await req.json()
    const rows = Array.isArray(body?.rows) ? body.rows : null
    if (!rows) {
      return NextResponse.json({ error: "rows[] required" }, { status: 400 })
    }

    const { rowCount } = await pool.query(
      `UPDATE projects SET table_rows = $1::jsonb WHERE id = $2`,
      [JSON.stringify(rows), id]
    )
    if (rowCount === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, rowCount: rows.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
