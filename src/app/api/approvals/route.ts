import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// GET /api/approvals — list all approvals
export async function GET(_req: NextRequest) {
  try {
    await ensureMigrations()
    const { rows } = await pool.query(
      `SELECT id, project_id, project_name, generated_by, support_count,
              types, support_keys, status, reviewed_by, reviewed_at, generated_at
       FROM pdf_approvals ORDER BY generated_at DESC`
    )

    const result = rows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name,
      generatedBy: r.generated_by,
      supportCount: r.support_count,
      types: typeof r.types === "string" ? JSON.parse(r.types) : r.types,
      supportKeys: typeof r.support_keys === "string" ? JSON.parse(r.support_keys) : r.support_keys,
      status: r.status,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      generatedAt: r.generated_at,
    }))

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/approvals — submit new approval
export async function POST(req: NextRequest) {
  try {
    await ensureMigrations()
    const body = await req.json()
    const { projectId, projectName, generatedBy, supportCount, types, supportKeys } = body

    if (!projectId || !projectName) {
      return NextResponse.json({ error: "projectId and projectName are required" }, { status: 400 })
    }

    const id = generateId()
    const { rows } = await pool.query(
      `INSERT INTO pdf_approvals (id, project_id, project_name, generated_by, support_count, types, support_keys, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id, project_id, project_name, generated_by, support_count, types, support_keys, status, reviewed_by, reviewed_at, generated_at`,
      [id, projectId, projectName, generatedBy || "unknown", supportCount || 0, JSON.stringify(types || []), JSON.stringify(supportKeys || [])]
    )

    const r = rows[0]
    return NextResponse.json(
      {
        id: r.id,
        projectId: r.project_id,
        projectName: r.project_name,
        generatedBy: r.generated_by,
        supportCount: r.support_count,
        types: typeof r.types === "string" ? JSON.parse(r.types) : r.types,
        supportKeys: typeof r.support_keys === "string" ? JSON.parse(r.support_keys) : r.support_keys,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
        generatedAt: r.generated_at,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
