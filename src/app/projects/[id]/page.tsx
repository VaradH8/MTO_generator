"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useProjects } from "@/context/ProjectContext"
import { useSupportContext } from "@/context/SupportContext"
import { generatePDF } from "@/lib/generatePDF"
import { generateZip } from "@/lib/generateZip"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import EmptyState from "@/components/EmptyState"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { projects } = useProjects()
  const { groupedSupports, currentProjectId, currentProjectName, loaded } = useSupportContext()

  const project = projects.find((p) => p.id === params.id)

  // PDFs are available if the persisted context belongs to this project
  const hasPdfs = loaded && currentProjectId === params.id && !!groupedSupports && Object.keys(groupedSupports).length > 0
  const pdfTypes = hasPdfs ? Object.entries(groupedSupports!) : []

  const [pdfStatus, setPdfStatus] = useState<Record<string, "ready" | "downloading" | "error">>({})
  const [zipping, setZipping] = useState(false)

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = async (type: string) => {
    setPdfStatus((s) => ({ ...s, [type]: "downloading" }))
    try {
      const blob = await generatePDF(type, groupedSupports![type], currentProjectName)
      triggerDownload(blob, `${type}-supports.pdf`)
      setPdfStatus((s) => ({ ...s, [type]: "ready" }))
    } catch {
      setPdfStatus((s) => ({ ...s, [type]: "error" }))
    }
  }

  const handleDownloadAll = async () => {
    setZipping(true)
    try {
      const pdfs = await Promise.all(
        pdfTypes.map(async ([type, rows]) => ({
          name: `${type}-supports`,
          blob: await generatePDF(type, rows, currentProjectName),
        }))
      )
      triggerDownload(await generateZip(pdfs), "support-pdfs.zip")
    } catch { /* silently */ }
    finally { setZipping(false) }
  }

  // AutoCAD Run popup state
  const [showRunPopup, setShowRunPopup] = useState(false)
  const [inputDwg, setInputDwg] = useState("")
  const [outputDwg, setOutputDwg] = useState("")
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ type: string; success: boolean; message: string }[]>([])
  const [bridgeStatus, setBridgeStatus] = useState<"unknown" | "connected" | "disconnected">("unknown")

  if (!project) {
    return <EmptyState title="Project not found" message="This project doesn't exist." action={{ label: "Go to Projects", onClick: () => router.push("/projects") }} />
  }

  const uploads = project.uploads || []
  const activity = (project.activityLog || []).slice().reverse()
  const types = project.supportTypes || []

  // Stats
  const allKeys = new Set<string>()
  const internalKeys = new Set<string>()
  const externalKeys = new Set<string>()
  let totalRevisions = 0
  for (const u of uploads) {
    for (const k of (u.supportKeys || [])) {
      allKeys.add(k)
      if (u.classification === "external") externalKeys.add(k)
      else internalKeys.add(k)
    }
    totalRevisions += u.revisions || 0
  }
  const internalCount = internalKeys.size
  const externalCount = externalKeys.size
  const typeCount: Record<string, number> = {}
  for (const u of uploads) { for (const t of u.types) { typeCount[t] = (typeCount[t] || 0) + 1 } }

  // Auto-detect types from uploaded Excel data (read-only, user can't change)
  const detectedTypes = Object.keys(typeCount)

  const checkBridgeHealth = async () => {
    try {
      const res = await fetch("/api/autocad?action=health")
      const data = await res.json()
      setBridgeStatus(data.connected ? "connected" : "disconnected")
    } catch {
      setBridgeStatus("disconnected")
    }
  }

  const handleRunConfirm = async () => {
    if (detectedTypes.length === 0 || !inputDwg.trim() || !outputDwg.trim()) return
    setRunning(true)
    setRunResult([])

    const results: typeof runResult = []

    for (const supportType of detectedTypes) {
      try {
        const res = await fetch("/api/autocad?action=extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceDwgPath: inputDwg,
            supportType,
            outputDirectory: outputDwg,
          }),
        })
        const data = await res.json()
        results.push({
          type: supportType,
          success: data.success ?? res.ok,
          message: data.message || (res.ok ? "Extracted successfully" : "Extraction failed"),
        })
      } catch (err) {
        results.push({
          type: supportType,
          success: false,
          message: err instanceof Error ? err.message : "Connection failed",
        })
      }
    }

    setRunResult(results)
    setRunning(false)
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-md)",
  }
  const statStyle: React.CSSProperties = {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)",
    boxShadow: "var(--shadow-sm)", flex: "1 1 0", minWidth: 100,
  }
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 var(--space-3)",
    fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)",
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", outline: "none",
  }
  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: "var(--font-display)", fontSize: "0.75rem",
    fontWeight: 500, color: "var(--color-text-muted)", textTransform: "uppercase",
    letterSpacing: "0.02em", marginBottom: "var(--space-1)",
  }

  return (
    <div>
      <button onClick={() => router.push("/projects")} style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Projects
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{project.clientName}</h1>
        <StatusBadge variant="info">{types.length} types</StatusBadge>
        <StatusBadge variant="info">{uploads.length} uploads</StatusBadge>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
        Created by {project.createdBy} on {new Date(project.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        <ActionButton variant="primary" onClick={() => router.push(`/upload?project=${project.id}`)}>Upload Excel</ActionButton>
        <ActionButton variant="secondary" onClick={() => { setShowRunPopup(true); setRunResult([]); checkBridgeHealth() }}
          iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3l8 5-8 5V3z" fill="currentColor" /></svg>}
        >
          Run AutoCAD
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push("/projects")}>Configure Types</ActionButton>
      </div>

      {/* Stats */}
      {(() => {
        const done = allKeys.size
        const range = project.supportRange || 0
        const remaining = range > 0 ? Math.max(0, range - done) : 0
        const pct = range > 0 ? Math.min(100, Math.round((done / range) * 100)) : 0
        return (
          <>
            <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-success)" }}>{done}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Done</div>
              </div>
              {internalCount > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)" }}>{internalCount}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Internal</div>
                </div>
              )}
              {externalCount > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-warning)" }}>{externalCount}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>External</div>
                </div>
              )}
              {range > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-warning)" }}>{remaining}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Remaining</div>
                </div>
              )}
              {range > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)" }}>{range}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Total Range</div>
                </div>
              )}
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{uploads.length}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Uploads</div>
              </div>
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-warning)" }}>{totalRevisions}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Revisions</div>
              </div>
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{Object.keys(typeCount).length}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Types Used</div>
              </div>
            </div>
            {range > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
                <div style={{ flex: 1, height: 8, background: "var(--color-surface-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--color-success)" : "var(--color-primary)", borderRadius: 4, transition: "width 0.5s ease-out" }} />
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text)" }}>{pct}%</span>
              </div>
            )}
          </>
        )
      })()}

      {/* Type breakdown bar chart */}
      {Object.keys(typeCount).length > 0 && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Support Types</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const maxCount = Math.max(...Object.values(typeCount))
              const pct = (count / maxCount) * 100
              return (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)", minWidth: 50 }}>{type}</span>
                  <div style={{ flex: 1, height: 20, background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-primary)", borderRadius: "var(--radius-sm)", transition: "width 0.5s ease-out" }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 20, textAlign: "right" }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Generated PDFs */}
      {hasPdfs && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)" }}>Generated PDFs</h2>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <ActionButton variant="secondary" size="sm" loading={zipping} onClick={handleDownloadAll}>
                {zipping ? "Preparing..." : "Download All as ZIP"}
              </ActionButton>
              <ActionButton variant="ghost" size="sm" onClick={() => router.push("/output")}>
                Open PDF Page
              </ActionButton>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {pdfTypes.map(([type, rows]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text)", flex: 1 }}>{type}</span>
                <StatusBadge variant="info">{rows.length} supports</StatusBadge>
                <ActionButton
                  variant="primary"
                  size="sm"
                  loading={pdfStatus[type] === "downloading"}
                  onClick={() => handleDownloadPDF(type)}
                >
                  {pdfStatus[type] === "downloading" ? "Generating..." : pdfStatus[type] === "error" ? "Retry" : "Download PDF"}
                </ActionButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload History */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Upload History</h2>
        {uploads.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-faint)", textAlign: "center", padding: "var(--space-4)" }}>No uploads yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {uploads.map((u, idx) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", minWidth: 25 }}>#{idx + 1}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 130 }}>{new Date(u.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text)", flex: 1 }}>{u.fileName}</span>
                <StatusBadge variant="info">{u.rowCount} rows</StatusBadge>
                {(u.newSupports ?? 0) > 0 && <StatusBadge variant="success">{u.newSupports} new</StatusBadge>}
                {(u.revisions ?? 0) > 0 && <StatusBadge variant="warning">{u.revisions} revisions</StatusBadge>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Log */}
      {activity.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Activity Log</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {activity.slice(0, 20).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", fontSize: "0.8125rem" }}>
                <span style={{ fontFamily: "var(--font-body)", color: "var(--color-text-faint)", minWidth: 80 }}>{new Date(a.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <StatusBadge variant={a.action === "approve" ? "success" : a.action === "reject" ? "error" : "info"}>{a.action}</StatusBadge>
                <span style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}>{a.detail}</span>
                <span style={{ fontFamily: "var(--font-body)", color: "var(--color-text-faint)", marginLeft: "auto" }}>{a.user}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── AutoCAD Run Popup ─── */}
      {showRunPopup && (
        <div
          className="animate-fade-in"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
          onClick={() => !running && setShowRunPopup(false)}
        >
          <div
            className="animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)", borderRadius: "var(--radius-lg)",
              padding: "var(--space-8)", boxShadow: "var(--shadow-xl)",
              maxWidth: 520, width: "90%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)" }}>
                Run AutoCAD Plugin
              </h2>
              <StatusBadge variant={bridgeStatus === "connected" ? "success" : bridgeStatus === "disconnected" ? "error" : "info"}>
                {bridgeStatus === "connected" ? "Connected" : bridgeStatus === "disconnected" ? "Disconnected" : "Unknown"}
              </StatusBadge>
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
              Extract support drawings from source DWG. Types are auto-detected from your Excel uploads.
            </p>

            {/* Input DWG file path */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={labelStyle}>Source DWG File Path (on AutoCAD server)</label>
              <input
                value={inputDwg}
                onChange={(e) => setInputDwg(e.target.value)}
                placeholder="e.g. D:\drawings\supports.dwg"
                style={inputStyle}
              />
            </div>

            {/* Output DWG folder path */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={labelStyle}>Output Folder Path (on AutoCAD server)</label>
              <input
                value={outputDwg}
                onChange={(e) => setOutputDwg(e.target.value)}
                placeholder="e.g. D:\output\extracted"
                style={inputStyle}
              />
            </div>

            {/* Detected types — read only */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <label style={labelStyle}>Support Types (auto-detected from Excel)</label>
              {detectedTypes.length === 0 ? (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-warning)" }}>
                  No types detected. Upload an Excel file first.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {detectedTypes.map((t) => (
                    <span key={t} style={{
                      padding: "var(--space-1) var(--space-3)",
                      background: "var(--color-primary-soft)",
                      border: "1px solid var(--color-primary)",
                      borderRadius: "var(--radius-md)",
                      fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600,
                      color: "var(--color-primary)",
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Results */}
            {runResult.length > 0 && (
              <div style={{ marginBottom: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {runResult.map((r) => (
                  <div key={r.type} style={{
                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-3)",
                    background: r.success ? "var(--color-success-soft)" : "var(--color-error-soft)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: `3px solid ${r.success ? "var(--color-success)" : "var(--color-error)"}`,
                    fontFamily: "var(--font-body)", fontSize: "0.8125rem",
                  }}>
                    <StatusBadge variant={r.success ? "success" : "error"}>{r.type}</StatusBadge>
                    <span style={{ color: "var(--color-text-muted)" }}>{r.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <ActionButton variant="ghost" onClick={() => { setShowRunPopup(false); setRunResult([]) }} disabled={running}>
                {runResult.length > 0 ? "Close" : "Cancel"}
              </ActionButton>
              <ActionButton
                variant="primary"
                loading={running}
                disabled={!inputDwg.trim() || !outputDwg.trim() || detectedTypes.length === 0}
                onClick={handleRunConfirm}
                iconLeft={!running ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3l8 5-8 5V3z" fill="currentColor" /></svg> : undefined}
              >
                {running ? `Extracting ${detectedTypes.length} types...` : `Run for ${detectedTypes.length} type${detectedTypes.length !== 1 ? "s" : ""}`}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
