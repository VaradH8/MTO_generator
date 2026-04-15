import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// GET /api/projects/[id] — single project with all relations
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { rows: projects } = await pool.query(
      `SELECT id, client_name, created_by, created_at, support_range, is_active
       FROM projects WHERE id = $1`,
      [id]
    )

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const p = projects[0]

    // Support types with items
    const { rows: types } = await pool.query(
      `SELECT id, type_name FROM project_support_types WHERE project_id = $1`,
      [id]
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
          items: items.map((i) => ({
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
      [id]
    )

    // Activity log
    const { rows: activity } = await pool.query(
      `SELECT id, timestamp, username, action, detail
       FROM activity_log WHERE project_id = $1 ORDER BY timestamp DESC`,
      [id]
    )

    return NextResponse.json({
      id: p.id,
      clientName: p.client_name,
      createdBy: p.created_by,
      createdAt: p.created_at,
      supportRange: p.support_range ?? 0,
      isActive: p.is_active,
      supportTypes,
      uploads: uploads.map((u) => ({
        id: u.id,
        fileName: u.file_name,
        uploadedAt: u.uploaded_at,
        rowCount: u.row_count,
        types: u.types,
        supportKeys: u.support_keys,
        newSupports: u.new_supports,
        revisions: u.revisions,
      })),
      activityLog: activity.map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        user: a.username,
        action: a.action,
        detail: a.detail,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/projects/[id] — update project
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { clientName, supportRange, supportTypes } = body

    // Check project exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM projects WHERE id = $1`,
      [id]
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Update basic fields if provided
    if (clientName !== undefined || supportRange !== undefined) {
      const setClauses: string[] = []
      const values: unknown[] = []
      let idx = 1

      if (clientName !== undefined) {
        setClauses.push(`client_name = $${idx++}`)
        values.push(clientName)
      }
      if (supportRange !== undefined) {
        setClauses.push(`support_range = $${idx++}`)
        values.push(supportRange)
      }

      values.push(id)
      await pool.query(
        `UPDATE projects SET ${setClauses.join(", ")} WHERE id = $${idx}`,
        values
      )
    }

    // Replace support types if provided
    if (supportTypes !== undefined && Array.isArray(supportTypes)) {
      // Delete existing support types (cascades to items)
      await pool.query(
        `DELETE FROM project_support_types WHERE project_id = $1`,
        [id]
      )

      // Insert new support types and their items
      for (const st of supportTypes) {
        const { rows: inserted } = await pool.query(
          `INSERT INTO project_support_types (project_id, type_name)
           VALUES ($1, $2) RETURNING id`,
          [id, st.typeName]
        )
        const typeId = inserted[0].id

        if (st.items && Array.isArray(st.items)) {
          for (const item of st.items) {
            await pool.query(
              `INSERT INTO project_type_items (project_support_type_id, item_id, item_name, qty, make, model)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [typeId, item.itemId, item.itemName, item.qty || "", item.make || "", item.model || ""]
            )
          }
        }
      }
    }

    return NextResponse.json({ success: true, id })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/projects/[id] — delete project (cascades)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { rowCount } = await pool.query(
      `DELETE FROM projects WHERE id = $1`,
      [id]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, id })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
