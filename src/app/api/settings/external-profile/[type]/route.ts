import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

async function requireAdmin(req: NextRequest): Promise<{ denied: NextResponse | null }> {
  await ensureMigrations()
  const requester = req.headers.get("x-username")?.trim() ?? ""
  if (!requester) {
    return { denied: NextResponse.json({ error: "Missing x-username header" }, { status: 401 }) }
  }
  const { rows, rowCount } = await pool.query(
    `SELECT role FROM users WHERE username = $1`,
    [requester],
  )
  if (!rowCount || rows[0].role !== "admin") {
    return { denied: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }
  return { denied: null }
}

/** DELETE — admin-only. Removes a single TYPE row from the external
 *  profile table. Used by the Settings UI's per-row delete button. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { denied } = await requireAdmin(req)
  if (denied) return denied
  try {
    const { type } = await params
    const decoded = decodeURIComponent(type)
    const { rowCount } = await pool.query(
      `DELETE FROM external_type_profiles WHERE type_name = $1`,
      [decoded],
    )
    if (!rowCount) return NextResponse.json({ error: "type not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
