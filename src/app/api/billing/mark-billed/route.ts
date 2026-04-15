import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function calculateAmount(totalSupports: number, totalRevisions: number): number {
  // First 100 supports = $200 flat
  // After 100 = $1 each
  // Each revision = $50
  let amount = 0
  if (totalSupports <= 100) {
    amount = 200
  } else {
    amount = 200 + (totalSupports - 100) * 1
  }
  amount += totalRevisions * 50
  return amount
}

// POST /api/billing/mark-billed — create cycle from unbilled entries
export async function POST(_req: NextRequest) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // Get all unbilled entries
    const { rows: unbilled } = await client.query(
      `SELECT id, support_count, support_keys, types
       FROM billing_entries WHERE cycle_id IS NULL`
    )

    if (unbilled.length === 0) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "No unbilled entries found" }, { status: 400 })
    }

    // Calculate totals
    let totalSupports = 0
    let totalRevisions = 0
    for (const entry of unbilled) {
      totalSupports += entry.support_count || 0
      // Count revisions from support_keys if available
      const keys = typeof entry.support_keys === "string"
        ? JSON.parse(entry.support_keys)
        : entry.support_keys || []
      for (const key of keys) {
        if (typeof key === "string" && /rev/i.test(key)) {
          totalRevisions++
        }
      }
    }

    const amount = calculateAmount(totalSupports, totalRevisions)
    const cycleId = generateId()

    // Create billing cycle
    const { rows: cycleRows } = await client.query(
      `INSERT INTO billing_cycles (id, total_supports, total_revisions, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id, total_supports, total_revisions, amount, created_at`,
      [cycleId, totalSupports, totalRevisions, amount]
    )

    // Move entries into the cycle
    await client.query(
      `UPDATE billing_entries SET cycle_id = $1 WHERE cycle_id IS NULL`,
      [cycleId]
    )

    await client.query("COMMIT")

    const c = cycleRows[0]
    return NextResponse.json({
      id: c.id,
      totalSupports: c.total_supports,
      totalRevisions: c.total_revisions,
      amount: c.amount,
      createdAt: c.created_at,
    })
  } catch (error: unknown) {
    await client.query("ROLLBACK")
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
