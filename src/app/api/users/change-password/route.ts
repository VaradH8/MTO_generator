import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

// POST /api/users/change-password — self-service password change.
// Requires current password verification; no admin role required.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const username = String(body.username ?? "").trim()
    const currentPassword = String(body.currentPassword ?? "")
    const newPassword = String(body.newPassword ?? "")

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "username, currentPassword, newPassword required" }, { status: 400 })
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: "new password must be at least 4 characters" }, { status: 400 })
    }

    const { rows, rowCount } = await pool.query(
      `SELECT password_hash FROM users WHERE username = $1`,
      [username]
    )
    if (!rowCount || rows[0].password_hash !== currentPassword) {
      return NextResponse.json({ error: "current password is incorrect" }, { status: 401 })
    }

    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE username = $2`,
      [newPassword, username]
    )
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
