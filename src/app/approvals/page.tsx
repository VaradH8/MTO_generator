"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useApprovals } from "@/context/ApprovalContext"
import { useBilling } from "@/context/BillingContext"
import { useProjects } from "@/context/ProjectContext"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import EmptyState from "@/components/EmptyState"

export default function ApprovalsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { approvals, approve, reject } = useApprovals()
  const { addEntry } = useBilling()
  const { addActivity } = useProjects()
  const [notification, setNotification] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleBulkApprove = () => {
    for (const id of selected) handleApprove(id)
    setSelected(new Set())
  }

  const handleBulkReject = () => {
    for (const id of selected) handleReject(id)
    setSelected(new Set())
  }

  if (user?.role !== "admin") {
    return (
      <EmptyState
        title="Access Denied"
        message="Only admin users can review approvals."
        action={{ label: "Go to Dashboard", onClick: () => router.push("/dashboard") }}
      />
    )
  }

  const pending = approvals.filter((a) => a.status === "pending")
  const reviewed = approvals.filter((a) => a.status !== "pending")

  const handleApprove = (id: string) => {
    const approval = approvals.find((a) => a.id === id)
    if (!approval) return

    approve(id, user.username)

    // Add to billing
    addEntry({
      fileName: `${approval.projectName} (approved)`,
      supportCount: approval.supportCount,
      supportKeys: approval.supportKeys,
      types: approval.types,
    })

    // Log activity
    if (approval.projectId) {
      addActivity(approval.projectId, user.username, "approve", `Approved ${approval.supportCount} supports`)
    }

    setNotification(`Approved: ${approval.projectName} — ${approval.supportCount} supports added to billing`)
    setTimeout(() => setNotification(""), 5000)
  }

  const handleReject = (id: string) => {
    const approval = approvals.find((a) => a.id === id)
    reject(id, user.username)

    if (approval?.projectId) {
      addActivity(approval.projectId, user.username, "reject", `Rejected ${approval.supportCount} supports`)
    }

    setNotification(`Rejected: ${approval?.projectName}`)
    setTimeout(() => setNotification(""), 5000)
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-md)",
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
        Approvals
      </h1>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "var(--color-text-muted)", marginBottom: "var(--space-8)" }}>
        Review and approve PDF generations before they are added to billing.
      </p>

      {/* Notification */}
      {notification && (
        <div className="animate-fade-in-down" style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-success-soft)", borderLeft: "3px solid var(--color-success)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
          {notification}
        </div>
      )}

      {/* Pending */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
          Pending Review ({pending.length})
        </h2>
        {selected.size > 0 && (
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <ActionButton variant="primary" size="sm" onClick={handleBulkApprove}> Approve {selected.size} selected</ActionButton>
            <ActionButton variant="destructive" size="sm" onClick={handleBulkReject}>Reject {selected.size} selected</ActionButton>
            <ActionButton variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</ActionButton>
          </div>
        )}

        {pending.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-faint)", textAlign: "center", padding: "var(--space-6)" }}>
            No pending approvals.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {pending.map((a) => {
              const date = new Date(a.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
              return (
                <div key={a.id} className="animate-fade-in-up" style={{
                  padding: "var(--space-4)", background: "var(--color-warning-soft)",
                  borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--color-warning)",
                  display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap",
                }}>
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} style={{ accentColor: "var(--color-primary)" }} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text)" }}>
                      {a.projectName || "Unknown Project"}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                      by {a.generatedBy} — {date}
                    </div>
                  </div>
                  <StatusBadge variant="info">{a.supportCount} supports</StatusBadge>
                  <div style={{ display: "flex", gap: "var(--space-1)" }}>
                    {Object.entries(a.types).map(([t, c]) => (
                      <StatusBadge key={t} variant="info">{t}: {c}</StatusBadge>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <ActionButton variant="primary" size="sm" onClick={() => handleApprove(a.id)}>
                      Approve
                    </ActionButton>
                    <ActionButton variant="destructive" size="sm" onClick={() => handleReject(a.id)}>
                      Reject
                    </ActionButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* History */}
      {reviewed.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Review History
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {reviewed.map((a) => {
              const date = new Date(a.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              const reviewDate = a.reviewedAt ? new Date(a.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)", background: "var(--color-surface-2)",
                  borderRadius: "var(--radius-md)", flexWrap: "wrap",
                }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 60 }}>{date}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text)", flex: 1 }}>
                    {a.projectName || "Unknown"} — {a.generatedBy}
                  </span>
                  <StatusBadge variant="info">{a.supportCount}</StatusBadge>
                  <StatusBadge variant={a.status === "approved" ? "success" : "error"}>
                    {a.status === "approved" ? "Approved" : "Rejected"}
                  </StatusBadge>
                  {a.reviewedBy && (
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-faint)" }}>
                      by {a.reviewedBy} on {reviewDate}
                    </span>
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
