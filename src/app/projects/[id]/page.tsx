"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useProjects } from "@/context/ProjectContext"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import EmptyState from "@/components/EmptyState"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { projects } = useProjects()

  const project = projects.find((p) => p.id === params.id)

  // AutoCAD Run popup state
  const [showRunPopup, setShowRunPopup] = useState(false)
  const [inputDwg, setInputDwg] = useState("")
  const [outputDwg, setOutputDwg] = useState("")
  const [selectedType, setSelectedType] = useState("")
  const [running, setRunning] = useState(false)

  if (!project) {
    return <EmptyState title="Project not found" message="This project doesn't exist." action={{ label: "Go to Projects", onClick: () => router.push("/projects") }} />
  }

  const uploads = project.uploads || []
  const activity = (project.activityLog || []).slice().reverse()
  const types = project.supportTypes || []

  // Stats
  const allKeys = new Set<string>()
  let totalRevisions = 0
  for (const u of uploads) {
    for (const k of (u.supportKeys || [])) allKeys.add(k)
    totalRevisions += u.revisions || 0
  }
  const typeCount: Record<string, number> = {}
  for (const u of uploads) { for (const t of u.types) { typeCount[t] = (typeCount[t] || 0) + 1 } }

  const handleRunConfirm = () => {
    setRunning(true)
    // This is where the AutoCAD plugin will be triggered
    // For now, simulate with an alert
    setTimeout(() => {
      alert(`AutoCAD Plugin Triggered:\n\nInput DWG: ${inputDwg}\nOutput DWG: ${outputDwg}\nSupport Type: ${selectedType}\n\nPlugin not connected yet — this will call the AutoCAD API when integrated.`)
      setRunning(false)
      setShowRunPopup(false)
      setInputDwg("")
      setOutputDwg("")
      setSelectedType("")
    }, 500)
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
        <ActionButton variant="secondary" onClick={() => setShowRunPopup(true)}
          iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3l8 5-8 5V3z" fill="currentColor" /></svg>}
        >
          Run AutoCAD
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push("/projects")}>Configure Types</ActionButton>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        <div style={statStyle}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{allKeys.size}</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Unique Supports</div>
        </div>
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
              maxWidth: 500, width: "90%",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
              Run AutoCAD Plugin
            </h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
              Extract support drawings from source DWG and create a new DWG.
            </p>

            {/* Input DWG file */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={labelStyle}>Input DWG File</label>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <input
                  value={inputDwg}
                  onChange={(e) => setInputDwg(e.target.value)}
                  placeholder="Select source .dwg file"
                  style={{ ...inputStyle, flex: 1 }}
                  readOnly
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const [handle] = await (window as any).showOpenFilePicker({
                        types: [{ description: "DWG Files", accept: { "application/acad": [".dwg"] } }],
                        multiple: false,
                      })
                      setInputDwg(handle.name)
                    } catch {
                      // User cancelled or API not supported — fallback to manual input
                      const path = prompt("Enter input DWG file path:")
                      if (path) setInputDwg(path)
                    }
                  }}
                  style={{
                    height: 40, padding: "0 var(--space-4)",
                    fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600,
                    color: "var(--color-primary)", background: "var(--color-primary-soft)",
                    border: "1px solid var(--color-primary)", borderRadius: "var(--radius-md)",
                    cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Output DWG folder */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={labelStyle}>Output DWG Folder</label>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <input
                  value={outputDwg}
                  onChange={(e) => setOutputDwg(e.target.value)}
                  placeholder="Select output folder"
                  style={{ ...inputStyle, flex: 1 }}
                  readOnly
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const handle = await (window as any).showDirectoryPicker()
                      setOutputDwg(handle.name)
                    } catch {
                      const path = prompt("Enter output folder path:")
                      if (path) setOutputDwg(path)
                    }
                  }}
                  style={{
                    height: 40, padding: "0 var(--space-4)",
                    fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600,
                    color: "var(--color-primary)", background: "var(--color-primary-soft)",
                    border: "1px solid var(--color-primary)", borderRadius: "var(--radius-md)",
                    cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Support type dropdown */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <label style={labelStyle}>Support Type to Extract</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Select type...</option>
                {types.map((t) => (
                  <option key={t.typeName} value={t.typeName}>{t.typeName}</option>
                ))}
                {/* Also show types from uploads if not in config */}
                {Object.keys(typeCount).filter((t) => !types.some((tc) => tc.typeName === t)).map((t) => (
                  <option key={t} value={t}>{t} (from uploads)</option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <ActionButton variant="ghost" onClick={() => setShowRunPopup(false)} disabled={running}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                loading={running}
                disabled={!inputDwg.trim() || !outputDwg.trim() || !selectedType}
                onClick={handleRunConfirm}
                iconLeft={!running ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3l8 5-8 5V3z" fill="currentColor" /></svg> : undefined}
              >
                {running ? "Running..." : "Confirm & Run"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
