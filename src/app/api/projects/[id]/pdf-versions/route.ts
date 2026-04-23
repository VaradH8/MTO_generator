import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// GET /api/projects/[id]/pdf-versions
// Returns every Combined PDF generation recorded for this project, newest first.
// Excludes the heavy snapshots so the list query stays cheap — fetch a single
// version via GET /api/projects/[id]/pdf-versions/[versionId] for the full blob.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
    const { id } = await params
    const { rows } = await pool.query(
      `SELECT id, generated_at, generated_by, label, row_count, type_count
       FROM project_pdf_versions
       WHERE project_id = $1
       ORDER BY generated_at DESC`,
      [id]
    )
    return NextResponse.json({
      versions: rows.map((r: { id: string; generated_at: string; generated_by: string; label: string; row_count: number; type_count: number }) => ({
        id: r.id,
        generatedAt: r.generated_at,
        generatedBy: r.generated_by,
        label: r.label,
        rowCount: r.row_count,
        typeCount: r.type_count,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/projects/[id]/pdf-versions
// Body: { rows: SupportRow[], typeConfigs?: SupportTypeConfig[], generatedBy?, label? }
// Records a new Combined PDF generation event with the exact rows used so that
// the PDF can be regenerated later from the same snapshot.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
    const { id } = await params
    const body = await req.json()
    const rows = Array.isArray(body?.rows) ? body.rows : null
    const typeConfigs = Array.isArray(body?.typeConfigs) ? body.typeConfigs : []
    const generatedBy = typeof body?.generatedBy === "string" ? body.generatedBy : "unknown"
    const label = typeof body?.label === "string" ? body.label : ""

    if (!rows) {
      return NextResponse.json({ error: "rows[] required" }, { status: 400 })
    }

    const { rows: projectExists } = await pool.query(
      `SELECT id FROM projects WHERE id = $1`,
      [id]
    )
    if (projectExists.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const versionId = generateId()
    const rowCount = rows.length
    const typeSet = new Set<string>()
    for (const r of rows) {
      if (r && typeof r === "object" && typeof (r as { type?: unknown }).type === "string") {
        const t = ((r as { type: string }).type).trim()
        if (t) typeSet.add(t)
      }
    }

    const { rows: inserted } = await pool.query(
      `INSERT INTO project_pdf_versions
         (id, project_id, generated_by, label, row_count, type_count, rows_snapshot, type_configs)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       RETURNING id, generated_at, generated_by, label, row_count, type_count`,
      [versionId, id, generatedBy, label, rowCount, typeSet.size, JSON.stringify(rows), JSON.stringify(typeConfigs)]
    )

    const r = inserted[0]
    return NextResponse.json({
      id: r.id,
      generatedAt: r.generated_at,
      generatedBy: r.generated_by,
      label: r.label,
      rowCount: r.row_count,
      typeCount: r.type_count,
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
