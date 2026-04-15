import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

const DEFAULT_PDF_CONFIG = {
  pageSize: "A4",
  orientation: "landscape",
  fontSize: 10,
  headerFontSize: 14,
  showLogo: true,
  showPageNumbers: true,
}

// GET /api/settings — return master items, types, and pdf config
export async function GET(_req: NextRequest) {
  try {
    // Master items
    const { rows: itemRows } = await pool.query(
      `SELECT id, item_name, category FROM master_items ORDER BY item_name`
    )
    const masterItems = itemRows.map((r: any) => ({
      id: r.id,
      itemName: r.item_name,
      category: r.category,
    }))

    // Master types with their items
    const { rows: typeRows } = await pool.query(
      `SELECT id, type_name FROM master_types ORDER BY type_name`
    )
    const masterTypes = await Promise.all(
      typeRows.map(async (t) => {
        const { rows: typeItems } = await pool.query(
          `SELECT id, item_name FROM master_type_items WHERE master_type_id = $1 ORDER BY item_name`,
          [t.id]
        )
        return {
          id: t.id,
          typeName: t.type_name,
          items: typeItems.map((i: any) => ({
            id: i.id,
            itemName: i.item_name,
          })),
        }
      })
    )

    // PDF config — try to read from settings table, fall back to defaults
    let pdfConfig = { ...DEFAULT_PDF_CONFIG }
    try {
      const { rows: configRows } = await pool.query(
        `SELECT key, value FROM settings WHERE key LIKE 'pdf.%'`
      )
      if (configRows.length > 0) {
        for (const row of configRows) {
          const shortKey = row.key.replace("pdf.", "")
          const val = row.value
          // Parse booleans and numbers
          if (val === "true") (pdfConfig as Record<string, unknown>)[shortKey] = true
          else if (val === "false") (pdfConfig as Record<string, unknown>)[shortKey] = false
          else if (!isNaN(Number(val))) (pdfConfig as Record<string, unknown>)[shortKey] = Number(val)
          else (pdfConfig as Record<string, unknown>)[shortKey] = val
        }
      }
    } catch {
      // Settings table may not exist yet — use defaults
    }

    return NextResponse.json({ masterItems, masterTypes, pdfConfig })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/settings — save all settings (delete + re-insert in transaction)
export async function PUT(req: NextRequest) {
  const client = await pool.connect()
  try {
    const body = await req.json()
    const { masterItems, masterTypes, pdfConfig } = body

    await client.query("BEGIN")

    // Re-insert master items
    if (masterItems) {
      await client.query(`DELETE FROM master_items`)
      for (const item of masterItems) {
        const id = item.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))
        await client.query(
          `INSERT INTO master_items (id, item_name, category) VALUES ($1, $2, $3)`,
          [id, item.itemName, item.category || null]
        )
      }
    }

    // Re-insert master types with items
    if (masterTypes) {
      await client.query(`DELETE FROM master_type_items`)
      await client.query(`DELETE FROM master_types`)
      for (const type of masterTypes) {
        const typeId = type.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))
        await client.query(
          `INSERT INTO master_types (id, type_name) VALUES ($1, $2)`,
          [typeId, type.typeName]
        )
        if (type.items) {
          for (const item of type.items) {
            const itemId = item.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))
            await client.query(
              `INSERT INTO master_type_items (id, master_type_id, item_name) VALUES ($1, $2, $3)`,
              [itemId, typeId, item.itemName]
            )
          }
        }
      }
    }

    // Re-insert PDF config
    if (pdfConfig) {
      await client.query(`DELETE FROM settings WHERE key LIKE 'pdf.%'`)
      for (const [key, value] of Object.entries(pdfConfig)) {
        await client.query(
          `INSERT INTO settings (key, value) VALUES ($1, $2)`,
          [`pdf.${key}`, String(value)]
        )
      }
    }

    await client.query("COMMIT")

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    await client.query("ROLLBACK")
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
