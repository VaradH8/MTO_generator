import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// GET /api/billing — return current entries and history
export async function GET(_req: NextRequest) {
  try {
    // Current unbilled entries
    const { rows: currentRows } = await pool.query(
      `SELECT id, file_name, support_count, support_keys, types, created_at
       FROM billing_entries WHERE cycle_id IS NULL ORDER BY created_at DESC`
    )

    const currentEntries = currentRows.map((r) => ({
      id: r.id,
      fileName: r.file_name,
      supportCount: r.support_count,
      supportKeys: typeof r.support_keys === "string" ? JSON.parse(r.support_keys) : r.support_keys,
      types: typeof r.types === "string" ? JSON.parse(r.types) : r.types,
      createdAt: r.created_at,
    }))

    // Billing cycles (history)
    const { rows: cycles } = await pool.query(
      `SELECT id, total_supports, total_revisions, amount, created_at
       FROM billing_cycles ORDER BY created_at DESC`
    )

    const history = await Promise.all(
      cycles.map(async (c) => {
        const { rows: entries } = await pool.query(
          `SELECT id, file_name, support_count, support_keys, types, created_at
           FROM billing_entries WHERE cycle_id = $1 ORDER BY created_at DESC`,
          [c.id]
        )

        return {
          id: c.id,
          totalSupports: c.total_supports,
          totalRevisions: c.total_revisions,
          amount: c.amount,
          createdAt: c.created_at,
          entries: entries.map((r) => ({
            id: r.id,
            fileName: r.file_name,
            supportCount: r.support_count,
            supportKeys: typeof r.support_keys === "string" ? JSON.parse(r.support_keys) : r.support_keys,
            types: typeof r.types === "string" ? JSON.parse(r.types) : r.types,
            createdAt: r.created_at,
          })),
        }
      })
    )

    return NextResponse.json({ currentEntries, history })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/billing — add billing entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fileName, supportCount, supportKeys, types } = body

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 })
    }

    const id = generateId()
    const { rows } = await pool.query(
      `INSERT INTO billing_entries (id, file_name, support_count, support_keys, types)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, file_name, support_count, support_keys, types, cycle_id, created_at`,
      [id, fileName, supportCount || 0, JSON.stringify(supportKeys || []), JSON.stringify(types || [])]
    )

    const r = rows[0]
    return NextResponse.json(
      {
        id: r.id,
        fileName: r.file_name,
        supportCount: r.support_count,
        supportKeys: typeof r.support_keys === "string" ? JSON.parse(r.support_keys) : r.support_keys,
        types: typeof r.types === "string" ? JSON.parse(r.types) : r.types,
        cycleId: r.cycle_id,
        createdAt: r.created_at,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
