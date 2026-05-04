import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/**
 * POST /api/password-reset
 * Public endpoint — anyone can submit a reset request for any username.
 * The request lands in `password_reset_requests` with status='pending';
 * an admin then resolves it via PATCH /api/password-reset/requests/[id].
 *
 * To avoid a username-enumeration leak, this endpoint always returns 200
 * regardless of whether the username exists, and never confirms or denies
 * the user's existence. Admin sees all incoming requests; only a real
 * username can be resolved (resolution updates the matching users row),
 * so phantom requests have no effect on real accounts.
 */
export async function POST(req: NextRequest) {
  await ensureMigrations()
  try {
    const body = await req.json().catch(() => ({}))
    const username = String(body?.username ?? "").trim()
    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 })
    }
    // Cap length and reject control characters defensively. The schema
    // already pins username to VARCHAR(100) so anything longer would error
    // — fail fast with a friendlier message.
    if (username.length > 100 || /[\x00-\x1f]/.test(username)) {
      return NextResponse.json({ error: "invalid username" }, { status: 400 })
    }
    const id = generateId()
    await pool.query(
      `INSERT INTO password_reset_requests (id, username, status) VALUES ($1, $2, 'pending')`,
      [id, username],
    )
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
