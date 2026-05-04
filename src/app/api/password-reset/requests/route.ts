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
 * GET /api/password-reset/requests
 * Admin-only listing of password-reset requests, newest first. By default
 * only `pending` requests are returned; pass `?status=all` to see resolved
 * and rejected ones too. Used by Settings → Pending Reset Requests.
 */
export async function GET(req: NextRequest) {
  const { denied } = await requireAdmin(req)
  if (denied) return denied
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const where = status === "all" ? "" : "WHERE status = 'pending'"
    const { rows } = await pool.query(
      `SELECT id, username, requested_at, status, resolved_at, resolved_by
         FROM password_reset_requests ${where}
         ORDER BY requested_at DESC`,
    )
    return NextResponse.json(
      rows.map((r: { id: string; username: string; requested_at: string; status: string; resolved_at: string | null; resolved_by: string | null }) => ({
        id: r.id,
        username: r.username,
        requestedAt: r.requested_at,
        status: r.status,
        resolvedAt: r.resolved_at,
        resolvedBy: r.resolved_by,
      })),
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
