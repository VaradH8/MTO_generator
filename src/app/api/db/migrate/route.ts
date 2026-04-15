import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import fs from "fs"
import path from "path"

export async function GET(_req: NextRequest) {
  try {
    const sqlPath = path.join(process.cwd(), "db/init.sql")
    const sql = fs.readFileSync(sqlPath, "utf-8")
    await pool.query(sql)
    return NextResponse.json({ success: true, message: "Migration completed successfully" })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
