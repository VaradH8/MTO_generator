import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// POST /api/projects/[id]/uploads — add upload record
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations()
    const { id: projectId } = await params
    const body = await req.json()
    const { fileName, rowCount, types, supportKeys, classification } = body

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 })
    }

    // Check project exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM projects WHERE id = $1`,
      [projectId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Detect new supports vs revisions by comparing supportKeys against existing uploads
    const { rows: existingUploads } = await pool.query(
      `SELECT support_keys FROM uploads WHERE project_id = $1`,
      [projectId]
    )

    const existingKeys = new Set<string>()
    for (const upload of existingUploads) {
      if (Array.isArray(upload.support_keys)) {
        for (const key of upload.support_keys) {
          existingKeys.add(key)
        }
      }
    }

    const incomingKeys: string[] = Array.isArray(supportKeys) ? supportKeys : []
    let newSupports = 0
    let revisions = 0

    for (const key of incomingKeys) {
      if (existingKeys.has(key)) {
        revisions++
      } else {
        newSupports++
      }
    }

    const uploadId = generateId()
    const { rows } = await pool.query(
      `INSERT INTO uploads (id, project_id, file_name, row_count, types, support_keys, new_supports, revisions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, file_name, uploaded_at, row_count, types, support_keys, new_supports, revisions`,
      [
        uploadId,
        projectId,
        fileName,
        rowCount || 0,
        JSON.stringify(types || []),
        JSON.stringify(incomingKeys),
        newSupports,
        revisions,
      ]
    )

    const u = rows[0]
    return NextResponse.json(
      {
        id: u.id,
        fileName: u.file_name,
        uploadedAt: u.uploaded_at,
        rowCount: u.row_count,
        types: u.types,
        supportKeys: u.support_keys,
        newSupports: u.new_supports,
        revisions: u.revisions,
        classification: classification || "internal",
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
