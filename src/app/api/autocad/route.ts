import { NextRequest, NextResponse } from "next/server"

const BRIDGE_URL = process.env.AUTOCAD_BRIDGE_URL || "http://localhost:5100"

/** POST /api/autocad?action=list|extract */
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action")
  const body = await req.json()

  if (action === "list") {
    return proxyToBridge("/api/supports/list", {
      sourceDwgPath: body.sourceDwgPath,
    })
  }

  if (action === "extract") {
    return proxyToBridge("/api/supports/extract", {
      sourceDwgPath: body.sourceDwgPath,
      supportType: body.supportType,
      outputDirectory: body.outputDirectory,
    })
  }

  return NextResponse.json({ success: false, message: "Invalid action. Use ?action=list or ?action=extract" }, { status: 400 })
}

/** GET /api/autocad?action=health */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action")

  if (action === "health") {
    try {
      const res = await fetch(`${BRIDGE_URL}/api/health`, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      return NextResponse.json({ connected: true, bridge: data })
    } catch {
      return NextResponse.json({ connected: false, message: "Cannot reach AutoCAD bridge service" }, { status: 503 })
    }
  }

  return NextResponse.json({ success: false, message: "Use ?action=health" }, { status: 400 })
}

async function proxyToBridge(path: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${BRIDGE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: "AutoCAD bridge unreachable. Ensure the bridge service is running on the VM and STARTEXTRACTOR is active in AutoCAD.",
        error: err instanceof Error ? err.message : "Connection failed",
      },
      { status: 503 }
    )
  }
}
