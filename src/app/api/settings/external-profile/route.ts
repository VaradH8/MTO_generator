import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

interface ProfileRow {
  type_name: string
  members: number
  flag_a: string
  flag_b: string
  flag_c: string
  flag_d: string
  flag_e: string
  imported_at: string
  imported_by: string
}

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

/** GET — readable by any signed-in user; the External MTO exporter on the
 *  project page calls this to fetch the TYPE → MEMBERS map. No header is
 *  required (matches the master-types GET). */
export async function GET(_req: NextRequest) {
  await ensureMigrations()
  try {
    const { rows } = await pool.query<ProfileRow>(
      `SELECT type_name, members, flag_a, flag_b, flag_c, flag_d, flag_e, imported_at, imported_by
         FROM external_type_profiles
         ORDER BY type_name`,
    )
    return NextResponse.json(
      rows.map((r) => ({
        typeName: r.type_name,
        members: r.members,
        flagA: r.flag_a ?? "",
        flagB: r.flag_b ?? "",
        flagC: r.flag_c ?? "",
        flagD: r.flag_d ?? "",
        flagE: r.flag_e ?? "",
        importedAt: r.imported_at,
        importedBy: r.imported_by,
      })),
    )
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

/** POST — admin-only. Body shape:
 *    { profiles: ExternalTypeProfile[], replaceAll?: boolean }
 *  Each profile is upserted by type_name. With `replaceAll: true` the
 *  existing table is wiped first so a fresh CSV import replaces the prior
 *  state. Without it, only the supplied types are touched (safe for
 *  partial edits). */
export async function POST(req: NextRequest) {
  const { denied, requester } = await requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const profiles = Array.isArray(body?.profiles) ? body.profiles : null
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: "profiles[] required and non-empty" }, { status: 400 })
    }
    const replaceAll = body.replaceAll === true
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      if (replaceAll) {
        await client.query(`DELETE FROM external_type_profiles`)
      }
      let imported = 0
      for (const p of profiles) {
        const t = String(p?.typeName ?? "").trim()
        if (!t) continue
        const m = Math.max(0, Math.floor(Number(p?.members) || 0))
        await client.query(
          `INSERT INTO external_type_profiles
             (type_name, members, flag_a, flag_b, flag_c, flag_d, flag_e, imported_at, imported_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
           ON CONFLICT (type_name) DO UPDATE SET
             members = EXCLUDED.members,
             flag_a = EXCLUDED.flag_a,
             flag_b = EXCLUDED.flag_b,
             flag_c = EXCLUDED.flag_c,
             flag_d = EXCLUDED.flag_d,
             flag_e = EXCLUDED.flag_e,
             imported_at = EXCLUDED.imported_at,
             imported_by = EXCLUDED.imported_by`,
          [
            t,
            m,
            String(p?.flagA ?? ""),
            String(p?.flagB ?? ""),
            String(p?.flagC ?? ""),
            String(p?.flagD ?? ""),
            String(p?.flagE ?? ""),
            requester,
          ],
        )
        imported++
      }
      await client.query("COMMIT")
      return NextResponse.json({ success: true, imported, replaced: replaceAll })
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
