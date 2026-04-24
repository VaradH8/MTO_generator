import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

// POST /api/auth — login
export async function POST(req: NextRequest) {
  try {
    await ensureMigrations()
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password are required" },
        { status: 400 }
      )
    }

    const { rows, rowCount } = await pool.query(
      `SELECT username, role, password_hash FROM users WHERE username = $1`,
      [username]
    )

    if (!rowCount || rows[0].password_hash !== password) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      )
    }

    const user = rows[0]
    return NextResponse.json({
      username: user.username,
      role: user.role,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
