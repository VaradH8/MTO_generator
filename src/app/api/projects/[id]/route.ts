import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// GET /api/projects/[id] — single project with all relations
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
    const { id } = await params

    const { rows: projects } = await pool.query(
      `SELECT id, client_name, created_by, created_at, support_range, is_active, mapping
       FROM projects WHERE id = $1`,
      [id]
    )

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const p = projects[0]

    // Support types with items
    const { rows: types } = await pool.query(
      `SELECT id, type_name, classification, with_plate, without_plate, with_plate_qty, without_plate_qty, nut_qty, bolt_qty FROM project_support_types WHERE project_id = $1`,
      [id]
    )
    const supportTypes = await Promise.all(
      types.map(async (t: any) => {
        const { rows: items } = await pool.query(
          `SELECT item_id, item_name, qty, make, model, variants, with_plate, without_plate
           FROM project_type_items WHERE project_support_type_id = $1`,
          [t.id]
        )
        return {
          typeName: t.type_name,
          classification: t.classification ?? "internal",
          withPlate: t.with_plate_qty || (t.with_plate ? "1" : ""),
          withoutPlate: t.without_plate_qty || (t.without_plate ? "1" : ""),
          nutQty: t.nut_qty || "",
          boltQty: t.bolt_qty || "",
          items: items.map((i: any) => ({
            itemId: i.item_id,
            itemName: i.item_name,
            qty: i.qty,
            make: i.make,
            model: i.model,
            variants: Array.isArray(i.variants) && i.variants.length > 0 ? i.variants : undefined,
            withPlate: !!i.with_plate,
            withoutPlate: !!i.without_plate,
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
      mapping: p.mapping && typeof p.mapping === "object" ? p.mapping : {},
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
  await ensureMigrations()
  const { id } = await params
  const body = await req.json()
  const { clientName, supportRange, supportTypes, mapping } = body

  // Check project exists
  const { rows: existing } = await pool.query(
    `SELECT id FROM projects WHERE id = $1`,
    [id]
  )
  if (existing.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  // Wrap the whole update in a transaction so a partial failure
  // (e.g. a single bad item_id causing the second INSERT to throw)
  // doesn't leave the project with the old types DELETEd and the new
  // ones never inserted — the previous code path's silent data-loss
  // bug. With ROLLBACK on any error, an aborted save preserves the
  // prior state verbatim.
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // Update basic fields if provided
    if (clientName !== undefined || supportRange !== undefined || mapping !== undefined) {
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
      if (mapping !== undefined) {
        setClauses.push(`mapping = $${idx++}::jsonb`)
        values.push(JSON.stringify(mapping || {}))
      }

      values.push(id)
      await client.query(
        `UPDATE projects SET ${setClauses.join(", ")} WHERE id = $${idx}`,
        values
      )
    }

    // Replace support types if provided (transactional)
    if (supportTypes !== undefined && Array.isArray(supportTypes)) {
      await client.query(
        `DELETE FROM project_support_types WHERE project_id = $1`,
        [id]
      )

      for (const st of supportTypes) {
        const wp = String(st?.withPlate ?? "")
        const wop = String(st?.withoutPlate ?? "")
        const nq = String(st?.nutQty ?? "")
        const bq = String(st?.boltQty ?? "")
        const { rows: inserted } = await client.query(
          `INSERT INTO project_support_types (project_id, type_name, classification, with_plate, without_plate, with_plate_qty, without_plate_qty, nut_qty, bolt_qty)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            id,
            String(st?.typeName ?? "").trim(),
            String(st?.classification ?? "internal") === "external" ? "external" : "internal",
            wp !== "",
            wop !== "",
            wp,
            wop,
            nq,
            bq,
          ]
        )
        const typeId = inserted[0].id

        if (st?.items && Array.isArray(st.items)) {
          for (const item of st.items) {
            // Coalesce every field to a safe default so a master item
            // missing one (e.g. itemId undefined) still inserts cleanly
            // instead of tripping the NOT NULL constraint and rolling
            // the whole save back.
            const variantsJson = Array.isArray(item?.variants) ? JSON.stringify(item.variants) : "[]"
            await client.query(
              `INSERT INTO project_type_items (project_support_type_id, item_id, item_name, qty, make, model, variants, with_plate, without_plate)
               VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
              [
                typeId,
                String(item?.itemId ?? ""),
                String(item?.itemName ?? ""),
                String(item?.qty ?? ""),
                String(item?.make ?? ""),
                String(item?.model ?? ""),
                variantsJson,
                !!item?.withPlate,
                !!item?.withoutPlate,
              ]
            )
          }
        }
      }
    }

    await client.query("COMMIT")
    return NextResponse.json({ success: true, id })
  } catch (error: unknown) {
    await client.query("ROLLBACK").catch(() => { /* swallow rollback errors */ })
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}

// DELETE /api/projects/[id] — delete project (cascades)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
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
