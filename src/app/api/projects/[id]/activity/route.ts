import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// GET /api/projects/[id]/activity — list activity for project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const { rows } = await pool.query(
      `SELECT id, timestamp, username, action, detail
       FROM activity_log WHERE project_id = $1 ORDER BY timestamp DESC`,
      [projectId]
    )

    return NextResponse.json(
      rows.map((a: any) => ({
        id: a.id,
        timestamp: a.timestamp,
        user: a.username,
        action: a.action,
        detail: a.detail,
      }))
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/projects/[id]/activity — add activity entry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await req.json()
    const { user, action, detail } = body

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    // Check project exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM projects WHERE id = $1`,
      [projectId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const activityId = generateId()
    const { rows } = await pool.query(
      `INSERT INTO activity_log (id, project_id, username, action, detail)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, timestamp, username, action, detail`,
      [activityId, projectId, user || "unknown", action, detail || ""]
    )

    const a = rows[0]
    return NextResponse.json(
      {
        id: a.id,
        timestamp: a.timestamp,
        user: a.username,
        action: a.action,
        detail: a.detail,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
