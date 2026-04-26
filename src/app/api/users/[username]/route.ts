import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

const ALLOWED_ROLES = new Set(["admin", "user", "client"])

async function requireAdmin(req: NextRequest): Promise<{ denied: NextResponse | null; requester: string }> {
  await ensureMigrations()
  const requester = req.headers.get("x-username")?.trim() ?? ""
  if (!requester) {
    return { denied: NextResponse.json({ error: "Missing x-username header" }, { status: 401 }), requester }
  }
  const { rows, rowCount } = await pool.query(
    `SELECT role FROM users WHERE username = $1`,
    [requester]
  )
  if (!rowCount || rows[0].role !== "admin") {
    return { denied: NextResponse.json({ error: "Admin access required" }, { status: 403 }), requester }
  }
  return { denied: null, requester }
}

// PUT /api/users/[username] — update password and/or role (admin only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { denied } = await requireAdmin(req)
  if (denied) return denied
  try {
    const { username } = await params
    const body = await req.json()
    const updates: string[] = []
    const values: unknown[] = []

    if (body.password != null && String(body.password) !== "") {
      values.push(String(body.password))
      updates.push(`password_hash = $${values.length}`)
    }
    if (body.role != null) {
      const role = String(body.role).trim()
      if (!ALLOWED_ROLES.has(role)) {
        return NextResponse.json({ error: `role must be one of: ${[...ALLOWED_ROLES].join(", ")}` }, { status: 400 })
      }
      values.push(role)
      updates.push(`role = $${values.length}`)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "no changes provided" }, { status: 400 })
    }

    values.push(username)
    const { rowCount } = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE username = $${values.length}`,
      values
    )
    if (!rowCount) return NextResponse.json({ error: "user not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/users/[username] — delete user (admin only, can't delete self)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { denied, requester } = await requireAdmin(req)
  if (denied) return denied
  try {
    const { username } = await params
    if (username === requester) {
      return NextResponse.json({ error: "cannot delete your own account" }, { status: 400 })
    }
    const { rowCount } = await pool.query(
      `DELETE FROM users WHERE username = $1`,
      [username]
    )
    if (!rowCount) return NextResponse.json({ error: "user not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
