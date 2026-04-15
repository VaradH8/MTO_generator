import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// GET /api/projects — list all projects with relations
export async function GET(_req: NextRequest) {
  try {
    const { rows: projects } = await pool.query(
      `SELECT id, client_name, created_by, created_at, support_range, is_active
       FROM projects ORDER BY created_at DESC`
    )

    const result = await Promise.all(
      projects.map(async (p) => {
        // Support types with items
        const { rows: types } = await pool.query(
          `SELECT id, type_name FROM project_support_types WHERE project_id = $1`,
          [p.id]
        )
        const supportTypes = await Promise.all(
          types.map(async (t) => {
            const { rows: items } = await pool.query(
              `SELECT item_id, item_name, qty, make, model
               FROM project_type_items WHERE project_support_type_id = $1`,
              [t.id]
            )
            return {
              typeName: t.type_name,
              items: items.map((i: any) => ({
                itemId: i.item_id,
                itemName: i.item_name,
                qty: i.qty,
                make: i.make,
                model: i.model,
              })),
            }
          })
        )

        // Uploads
        const { rows: uploads } = await pool.query(
          `SELECT id, file_name, uploaded_at, row_count, types, support_keys, new_supports, revisions
           FROM uploads WHERE project_id = $1 ORDER BY uploaded_at DESC`,
          [p.id]
        )

        // Activity log
        const { rows: activity } = await pool.query(
          `SELECT id, timestamp, username, action, detail
           FROM activity_log WHERE project_id = $1 ORDER BY timestamp DESC`,
          [p.id]
        )

        return {
          id: p.id,
          clientName: p.client_name,
          createdBy: p.created_by,
          createdAt: p.created_at,
          supportRange: p.support_range ?? 0,
          isActive: p.is_active,
          supportTypes,
          uploads: uploads.map((u: any) => ({
            id: u.id,
            fileName: u.file_name,
            uploadedAt: u.uploaded_at,
            rowCount: u.row_count,
            types: u.types,
            supportKeys: u.support_keys,
            newSupports: u.new_supports,
            revisions: u.revisions,
          })),
          activityLog: activity.map((a: any) => ({
            id: a.id,
            timestamp: a.timestamp,
            user: a.username,
            action: a.action,
            detail: a.detail,
          })),
        }
      })
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/projects — create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientName, createdBy, supportRange } = body

    if (!clientName) {
      return NextResponse.json({ error: "clientName is required" }, { status: 400 })
    }

    const id = generateId()
    const { rows } = await pool.query(
      `INSERT INTO projects (id, client_name, created_by, support_range)
       VALUES ($1, $2, $3, $4)
       RETURNING id, client_name, created_by, created_at, support_range, is_active`,
      [id, clientName, createdBy || "unknown", supportRange ?? 0]
    )

    // Insert initial activity log entry
    const activityId = generateId()
    await pool.query(
      `INSERT INTO activity_log (id, project_id, username, action, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [activityId, id, createdBy || "unknown", "create", `Project "${clientName}" created`]
    )

    const p = rows[0]
    return NextResponse.json(
      {
        id: p.id,
        clientName: p.client_name,
        createdBy: p.created_by,
        createdAt: p.created_at,
        supportRange: p.support_range ?? 0,
        isActive: p.is_active,
        supportTypes: [],
        uploads: [],
        activityLog: [],
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
