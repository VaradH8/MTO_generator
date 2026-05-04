import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

async function requireAdmin(req: NextRequest): Promise<{ denied: NextResponse | null; requester: string }> {
  await ensureMigrations()
  const requester = req.headers.get("x-username")?.trim() ?? ""
  if (!requester) {
    return { denied: NextResponse.json({ error: "Missing x-username header" }, { status: 401 }), requester }
  }
  const { rows, rowCount } = await pool.query(
    `SELECT role FROM users WHERE username = $1`,
    [requester],
  )
  if (!rowCount || rows[0].role !== "admin") {
    return { denied: NextResponse.json({ error: "Admin access required" }, { status: 403 }), requester }
  }
  return { denied: null, requester }
}

/**
 * PATCH /api/password-reset/requests/[id]
 * Admin-only resolver. Body shapes:
 *   { action: "resolve", newPassword: "..." }   — sets the user's password
 *                                                 and marks the request resolved
 *   { action: "reject" }                         — marks the request rejected,
 *                                                 doesn't touch the user row
 *
 * Resolution is transactional: the password update and the status flip
 * happen together so a failed UPDATE on the users row leaves the request
 * pending instead of silently marking it done.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied, requester } = await requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? "").toLowerCase()

  if (action !== "resolve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'resolve' or 'reject'" }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const { rows: rqRows } = await client.query<{ username: string; status: string }>(
      `SELECT username, status FROM password_reset_requests WHERE id = $1 FOR UPDATE`,
      [id],
    )
    if (!rqRows.length) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "request not found" }, { status: 404 })
    }
    if (rqRows[0].status !== "pending") {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: `request already ${rqRows[0].status}` }, { status: 409 })
    }

    if (action === "resolve") {
      const newPassword = String(body?.newPassword ?? "")
      if (!newPassword) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "newPassword is required" }, { status: 400 })
      }
      if (newPassword.length < 4) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "newPassword must be at least 4 characters" }, { status: 400 })
      }
      const { rowCount: pwRows } = await client.query(
        `UPDATE users SET password_hash = $1 WHERE username = $2`,
        [newPassword, rqRows[0].username],
      )
      if (!pwRows) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "user no longer exists" }, { status: 404 })
      }
      await client.query(
        `UPDATE password_reset_requests
            SET status = 'resolved', resolved_at = NOW(), resolved_by = $1
          WHERE id = $2`,
        [requester, id],
      )
    } else {
      await client.query(
        `UPDATE password_reset_requests
            SET status = 'rejected', resolved_at = NOW(), resolved_by = $1
          WHERE id = $2`,
        [requester, id],
      )
    }
    await client.query("COMMIT")
    return NextResponse.json({ success: true })
  } catch (err) {
    await client.query("ROLLBACK")
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
