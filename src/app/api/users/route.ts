import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

const ALLOWED_ROLES = new Set(["admin", "user", "client"])

/**
 * Minimal admin check — reads the requester's username from the `x-username`
 * header and verifies their role in DB. Matches this app's informal auth
 * posture (no real session tokens). Upgrade to a proper scheme when moving
 * beyond internal use.
 */
async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const requester = req.headers.get("x-username")?.trim()
  if (!requester) {
    return NextResponse.json({ error: "Missing x-username header" }, { status: 401 })
  }
  const { rows, rowCount } = await pool.query(
    `SELECT role FROM users WHERE username = $1`,
    [requester]
  )
  if (!rowCount || rows[0].role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }
  return null
}

// GET /api/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  try {
    const { rows } = await pool.query(
      `SELECT username, role, created_at FROM users ORDER BY created_at ASC`
    )
    return NextResponse.json(rows.map((r: { username: string; role: string; created_at: string }) => ({
      username: r.username,
      role: r.role,
      createdAt: r.created_at,
    })))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/users — create a new user (admin only)
export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  try {
    const body = await req.json()
    const username = String(body.username ?? "").trim()
    const password = String(body.password ?? "")
    const role = String(body.role ?? "user").trim()

    if (!username) return NextResponse.json({ error: "username required" }, { status: 400 })
    if (!password) return NextResponse.json({ error: "password required" }, { status: 400 })
    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: `role must be one of: ${[...ALLOWED_ROLES].join(", ")}` }, { status: 400 })
    }

    const { rowCount: exists } = await pool.query(
      `SELECT 1 FROM users WHERE username = $1`,
      [username]
    )
    if (exists) {
      return NextResponse.json({ error: "username already exists" }, { status: 409 })
    }

    await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
      [username, password, role]
    )

    return NextResponse.json({ username, role }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
