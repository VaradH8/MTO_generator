import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

// GET /api/projects/[id]/pdf-versions/[versionId]
// Returns the full snapshot (rows + typeConfigs + metadata) so the client can
// regenerate the exact Combined PDF that was produced at this moment in time.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    await ensureMigrations()
    const { id, versionId } = await params
    const { rows } = await pool.query(
      `SELECT id, generated_at, generated_by, label, row_count, type_count, rows_snapshot, type_configs
       FROM project_pdf_versions
       WHERE project_id = $1 AND id = $2`,
      [id, versionId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }
    const r = rows[0]
    return NextResponse.json({
      id: r.id,
      generatedAt: r.generated_at,
      generatedBy: r.generated_by,
      label: r.label,
      rowCount: r.row_count,
      typeCount: r.type_count,
      rows: Array.isArray(r.rows_snapshot) ? r.rows_snapshot : [],
      typeConfigs: Array.isArray(r.type_configs) ? r.type_configs : [],
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/pdf-versions/[versionId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    await ensureMigrations()
    const { id, versionId } = await params
    const { rowCount } = await pool.query(
      `DELETE FROM project_pdf_versions WHERE project_id = $1 AND id = $2`,
      [id, versionId]
    )
    if (rowCount === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, id: versionId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
