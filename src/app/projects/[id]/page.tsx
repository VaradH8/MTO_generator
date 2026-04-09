"use client"

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

  if (!project) {
    return <EmptyState title="Project not found" message="This project doesn't exist." action={{ label: "Go to Projects", onClick: () => router.push("/projects") }} />
  }

  const uploads = project.uploads || []
  const activity = (project.activityLog || []).slice().reverse()

  // Stats
  const allKeys = new Set<string>()
  let totalRevisions = 0
  for (const u of uploads) {
    for (const k of (u.supportKeys || [])) allKeys.add(k)
    totalRevisions += u.revisions || 0
  }

  // Type breakdown
  const typeCount: Record<string, number> = {}
  for (const u of uploads) {
    for (const t of u.types) {
      typeCount[t] = (typeCount[t] || 0) + 1
    }
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

  const acadBtnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "var(--space-3)",
    padding: "var(--space-4) var(--space-5)", background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500,
    color: "var(--color-text)", cursor: "pointer", width: "100%", textAlign: "left" as const,
  }

  return (
    <div>
      <button onClick={() => router.push("/projects")} style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Projects
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{project.clientName}</h1>
        <StatusBadge variant="info">{project.supportTypes.length} types</StatusBadge>
        <StatusBadge variant="info">{uploads.length} uploads</StatusBadge>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
        Created by {project.createdBy} on {new Date(project.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        <ActionButton variant="primary" onClick={() => router.push(`/upload?project=${project.id}`)}>Upload Excel</ActionButton>
        <ActionButton variant="secondary" onClick={() => router.push("/projects")}>Configure Types</ActionButton>
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

      {/* Type breakdown — simple bar chart */}
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

      {/* AutoCAD */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>AutoCAD Integration</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          {["Run Script", "Export to AutoCAD", "Sync from AutoCAD", "Generate DWG"].map((label) => (
            <button key={label} style={acadBtnStyle} onClick={() => alert(`${label} — plugin not connected yet`)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l4-8 4 8M4 8h4M12 4v8M10 6h4" stroke="var(--color-primary)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {label}
            </button>
          ))}
        </div>
      </div>

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
    </div>
  )
}
