import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

// PUT /api/approvals/[id] — approve or reject
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
    const { id } = await params
    const body = await req.json()
    const { action, reviewerName } = body

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    const status = action === "approve" ? "approved" : "rejected"

    const { rows, rowCount } = await pool.query(
      `UPDATE pdf_approvals
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3
       RETURNING id, project_id, project_name, generated_by, support_count,
                 types, support_keys, status, reviewed_by, reviewed_at, generated_at`,
      [status, reviewerName || "unknown", id]
    )

    if (!rowCount) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 })
    }

    const r = rows[0]
    return NextResponse.json({
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
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
