"use client"

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

  const isAdmin = user?.role === "admin"

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
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Projects
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {projects.map((project) => {
              // Calculate done supports (unique keys across all uploads)
              const doneKeys = new Set<string>()
              for (const u of (project.uploads || [])) {
                for (const k of (u.supportKeys || [])) doneKeys.add(k)
              }
              const done = doneKeys.size
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
        </div>
      )}
    </div>
  )
}
