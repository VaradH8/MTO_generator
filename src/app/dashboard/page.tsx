"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useProjects } from "@/context/ProjectContext"
import { useBilling } from "@/context/BillingContext"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { projects, activeProject } = useProjects()
  const { currentTotalSupports, currentRevisionCount, currentAmount } = useBilling()

  const [search, setSearch] = useState("")

  const isAdmin = user?.role === "admin"

  /* ── Aggregated type distribution across all projects ── */
  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) {
      for (const u of p.uploads || []) {
        for (const t of u.types || []) {
          counts[t] = (counts[t] || 0) + 1
        }
      }
    }
    return counts
  }, [projects])

  const typeMax = useMemo(() => Math.max(1, ...Object.values(typeDistribution)), [typeDistribution])

  /* ── Internal vs External counts ── */
  const { internalTotal, externalTotal } = useMemo(() => {
    let internal = 0
    let external = 0
    for (const p of projects) {
      for (const u of p.uploads || []) {
        const count = u.supportKeys?.length || 0
        if (u.classification === "external") external += count
        else internal += count
      }
    }
    return { internalTotal: internal, externalTotal: external }
  }, [projects])

  const ieTotal = Math.max(1, internalTotal + externalTotal)

  /* ── Filtered projects for search ── */
  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return projects
    return projects.filter((p) => {
      if (p.clientName.toLowerCase().includes(q)) return true
      for (const u of p.uploads || []) {
        for (const k of u.supportKeys || []) {
          if (k.toLowerCase().includes(q)) return true
        }
      }
      return false
    })
  }, [projects, search])

  /* ── Recent activity across all projects ── */
  const recentActivity = useMemo(() => {
    const entries: Array<{ projectName: string; entry: (typeof projects)[0]["activityLog"][0] }> = []
    for (const p of projects) {
      for (const e of p.activityLog || []) {
        entries.push({ projectName: p.clientName, entry: e })
      }
    }
    entries.sort((a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime())
    return entries.slice(0, 20)
  }, [projects])

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-6)",
    boxShadow: "var(--shadow-md)",
  }

  const statStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-4) var(--space-5)",
    boxShadow: "var(--shadow-sm)",
    minWidth: 120,
    flex: "1 1 0",
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: "var(--space-2)",
        }}
      >
        Welcome, {user?.username}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1rem",
          color: "var(--color-text-muted)",
          marginBottom: "var(--space-8)",
        }}
      >
        {activeProject
          ? `Working on: ${activeProject.clientName}`
          : "Select or create a project to get started."}
      </p>

      {/* Stats */}
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        <div style={statStyle}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>
            {projects.length}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
            Projects
          </div>
        </div>
        <div style={statStyle}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>
            {activeProject?.supportTypes.length || 0}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
            Configured Types
          </div>
        </div>
        <div style={statStyle}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>
            {currentTotalSupports}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
            Supports (billing)
          </div>
        </div>
        {isAdmin && (
          <div style={{ ...statStyle, borderLeft: "3px solid var(--color-primary)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)" }}>
              ${currentAmount.toFixed(2)}
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
              Amount Due
            </div>
          </div>
        )}
      </div>

      {/* Type Distribution Chart */}
      {Object.keys(typeDistribution).length > 0 && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Type Distribution
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {Object.entries(typeDistribution)
              .sort(([, a], [, b]) => b - a)
              .map(([typeName, count]) => (
                <div key={typeName} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text)", minWidth: 60 }}>{typeName}</span>
                  <div style={{ flex: 1, height: 18, background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.round((count / typeMax) * 100)}%`,
                        height: "100%",
                        background: "var(--color-primary)",
                        borderRadius: "var(--radius-sm)",
                        transition: "width 0.4s ease-out",
                        minWidth: 2,
                      }}
                    />
                  </div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 28, textAlign: "right" }}>{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Internal vs External */}
      {(internalTotal > 0 || externalTotal > 0) && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Internal vs External
          </h2>
          <div style={{ display: "flex", height: 28, borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--color-surface-2)" }}>
            {internalTotal > 0 && (
              <div
                style={{
                  width: `${Math.round((internalTotal / ieTotal) * 100)}%`,
                  height: "100%",
                  background: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "width 0.4s ease-out",
                  minWidth: internalTotal > 0 ? 40 : 0,
                }}
              >
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "#fff", fontWeight: 600 }}>
                  Internal {internalTotal}
                </span>
              </div>
            )}
            {externalTotal > 0 && (
              <div
                style={{
                  width: `${Math.round((externalTotal / ieTotal) * 100)}%`,
                  height: "100%",
                  background: "var(--color-warning)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "width 0.4s ease-out",
                  minWidth: externalTotal > 0 ? 40 : 0,
                }}
              >
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "#fff", fontWeight: 600 }}>
                  External {externalTotal}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {Math.round((internalTotal / ieTotal) * 100)}% internal
            </span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {Math.round((externalTotal / ieTotal) * 100)}% external
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
          Quick Actions
        </h2>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <ActionButton variant="primary" onClick={() => router.push("/upload")} disabled={!activeProject}>
            Upload Excel
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => router.push("/projects")}>
            {projects.length === 0 ? "Create Project" : "Manage Projects"}
          </ActionButton>
          {isAdmin && (
            <ActionButton variant="secondary" onClick={() => router.push("/billing")}>
              View Billing
            </ActionButton>
          )}
        </div>
        {!activeProject && projects.length === 0 && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-warning)", marginTop: "var(--space-3)" }}>
            Create a project first to start uploading.
          </p>
        )}
        {!activeProject && projects.length > 0 && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-warning)", marginTop: "var(--space-3)" }}>
            Select an active project in the Projects page.
          </p>
        )}
      </div>

      {/* Projects with progress */}
      {projects.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Projects
          </h2>
          <input
            type="text"
            placeholder="Search by client name or support tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--color-text)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-4)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {filteredProjects.map((project) => {
              // Calculate done supports (unique keys across all uploads)
              const doneKeys = new Set<string>()
              const internalKeys = new Set<string>()
              const externalKeys = new Set<string>()
              for (const u of (project.uploads || [])) {
                for (const k of (u.supportKeys || [])) {
                  doneKeys.add(k)
                  if (u.classification === "external") externalKeys.add(k)
                  else internalKeys.add(k)
                }
              }
              const done = doneKeys.size
              const internalCount = internalKeys.size
              const externalCount = externalKeys.size
              const range = project.supportRange || 0
              const remaining = range > 0 ? Math.max(0, range - done) : 0
              const pct = range > 0 ? Math.min(100, Math.round((done / range) * 100)) : 0

              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  style={{
                    padding: "var(--space-4)",
                    background: project.id === activeProject?.id ? "var(--color-primary-soft)" : "var(--color-surface-2)",
                    borderRadius: "var(--radius-md)",
                    borderLeft: project.id === activeProject?.id ? "3px solid var(--color-primary)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: range > 0 ? "var(--space-3)" : 0 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text)", flex: 1 }}>
                      {project.clientName}
                    </span>
                    <StatusBadge variant="info">{project.supportTypes.length} types</StatusBadge>
                    {internalCount > 0 && <StatusBadge variant="info">{internalCount} internal</StatusBadge>}
                    {externalCount > 0 && <StatusBadge variant="warning">{externalCount} external</StatusBadge>}
                    {range > 0 && <StatusBadge variant="success">{done} done</StatusBadge>}
                    {range > 0 && <StatusBadge variant="warning">{remaining} remaining</StatusBadge>}
                    {project.id === activeProject?.id && <StatusBadge variant="success">Active</StatusBadge>}
                  </div>
                  {range > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <div style={{ flex: 1, height: 6, background: "var(--color-surface)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--color-success)" : "var(--color-primary)", borderRadius: 3, transition: "width 0.5s ease-out" }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", minWidth: 35, textAlign: "right" }}>{pct}%</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {filteredProjects.length === 0 && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              No projects match your search.
            </p>
          )}
        </div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Recent Activity
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {recentActivity.map(({ projectName, entry }) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--color-surface-2)",
                  borderRadius: "var(--radius-md)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", minWidth: 130 }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)", minWidth: 100 }}>
                  {projectName}
                </span>
                <StatusBadge
                  variant={
                    entry.action === "upload" ? "info"
                    : entry.action === "approve" ? "success"
                    : entry.action === "reject" ? "error"
                    : entry.action === "bill" ? "warning"
                    : "info"
                  }
                >
                  {entry.action}
                </StatusBadge>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text)", flex: 1 }}>
                  {entry.detail}
                </span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
                  {entry.user}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
