"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useBilling, calculateAmount, MIN_SUPPORTS_PER_REVISION, MAX_SUPPORTS_PER_REVISION } from "@/context/BillingContext"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import EmptyState from "@/components/EmptyState"
import { generateInvoicePDF } from "@/lib/generateInvoice"

export default function BillingPage() {
  const { user } = useAuth()
  const router = useRouter()

  // Block non-admin users
  if (user?.role !== "admin") {
    return (
      <EmptyState
        title="Access Denied"
        message="Only admin users can access billing."
        action={{ label: "Go to Dashboard", onClick: () => router.push("/dashboard") }}
      />
    )
  }
  const {
    state,
    currentTotalSupports,
    currentUniqueKeys,
    currentRevisionCount,
    currentAmount,
    markAsBilled,
    clearAll,
    allTimeTotalSupports,
  } = useBilling()

  const [confirmBill, setConfirmBill] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Derive project name from entries (first entry's fileName usually has project name)
  const projectLabel = state.currentEntries[0]?.fileName?.replace(" (approved)", "").trim() || "Project"
  const invoiceSeq = String(state.history.length + 1).padStart(3, "0")
  const invoiceNumber = `${projectLabel.replace(/\s+/g, "_")}_${invoiceSeq}`

  const handleDownloadInvoice = async () => {
    const blob = await generateInvoicePDF({
      invoiceNumber,
      billedAt: new Date().toISOString(),
      entries: state.currentEntries,
      totalSupports: currentTotalSupports,
      revisionCount: currentRevisionCount,
      amountDue: currentAmount,
    })
    triggerDownload(blob, `invoice-${invoiceNumber}.pdf`)
  }

  const handleMarkBilled = () => {
    markAsBilled()
    setConfirmBill(false)
  }

  const handleDownloadPastInvoice = async (cycleIndex: number) => {
    const cycle = state.history[cycleIndex]
    const pastLabel = cycle.entries[0]?.fileName?.replace(" (approved)", "").trim() || "Project"
    const pastSeq = String(cycleIndex + 1).padStart(3, "0")
    const pastInvoiceNum = `${pastLabel.replace(/\s+/g, "_")}_${pastSeq}`
    const blob = await generateInvoicePDF({
      invoiceNumber: pastInvoiceNum,
      billedAt: cycle.billedAt,
      entries: cycle.entries,
      totalSupports: cycle.totalSupports,
      revisionCount: cycle.entries.length,
      amountDue: cycle.amountDue,
    })
    triggerDownload(blob, `invoice-${pastInvoiceNum}.pdf`)
  }

  // Pricing breakdown
  const baseSupports = Math.min(currentTotalSupports, 100)
  const additionalSupports = Math.max(currentTotalSupports - 100, 0)
  const revisionCharges = currentRevisionCount * 50

  // Per-revision support counts
  const revisionSupportCounts = state.currentEntries.map((e) => e.supportCount)
  const revisionsUnderMin = revisionSupportCounts.filter((c) => c < MIN_SUPPORTS_PER_REVISION).length
  const revisionsOverMax = revisionSupportCounts.filter((c) => c > MAX_SUPPORTS_PER_REVISION).length

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
          letterSpacing: "-0.01em",
        }}
      >
        Billing
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1rem",
          color: "var(--color-text-muted)",
          marginBottom: "var(--space-8)",
        }}
      >
        Track supports, revisions, and generate invoices.
      </p>

      {/* ─── Stats Row ─── */}
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        <div style={statStyle}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>
            {currentTotalSupports}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
            Unique Supports
          </div>
        </div>
        <div style={statStyle}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>
            {currentRevisionCount}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
            Revisions
          </div>
        </div>
        <div style={{ ...statStyle, borderLeft: "3px solid var(--color-primary)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)" }}>
            ${currentAmount.toFixed(2)}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
            Amount Due
          </div>
        </div>
        <div style={statStyle}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-muted)" }}>
            {state.history.length}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", marginTop: "var(--space-1)" }}>
            Past Invoices
          </div>
        </div>
      </div>

      {/* ─── Pricing Breakdown ─── */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
          Pricing Breakdown
        </h2>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Description", "Qty", "Rate", "Amount"].map((h, i) => (
                <th key={h} style={{ textAlign: i === 0 ? "left" : i === 3 ? "right" : "center", fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", padding: "var(--space-2) var(--space-3)", borderBottom: "1px solid var(--color-border)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", padding: "var(--space-3)" }}>
                Base rate (first 100 supports)
              </td>
              <td style={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", padding: "var(--space-3)" }}>
                {baseSupports}
              </td>
              <td style={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", padding: "var(--space-3)" }}>
                $190 flat
              </td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text)", padding: "var(--space-3)" }}>
                {currentTotalSupports > 0 ? "$190.00" : "$0.00"}
              </td>
            </tr>
            {additionalSupports > 0 && (
              <tr style={{ background: "var(--color-surface-2)" }}>
                <td style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", padding: "var(--space-3)" }}>
                  Additional supports
                </td>
                <td style={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", padding: "var(--space-3)" }}>
                  {additionalSupports}
                </td>
                <td style={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", padding: "var(--space-3)" }}>
                  $1.00/ea
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text)", padding: "var(--space-3)" }}>
                  ${additionalSupports.toFixed(2)}
                </td>
              </tr>
            )}
            <tr style={{ background: currentRevisionCount > 0 ? "var(--color-surface-2)" : undefined }}>
              <td style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", padding: "var(--space-3)" }}>
                Revisions
              </td>
              <td style={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", padding: "var(--space-3)" }}>
                {currentRevisionCount}
              </td>
              <td style={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", padding: "var(--space-3)" }}>
                $50.00/ea
              </td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text)", padding: "var(--space-3)" }}>
                ${revisionCharges.toFixed(2)}
              </td>
            </tr>
            <tr style={{ borderTop: "2px solid var(--color-border)" }}>
              <td colSpan={3} style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: "var(--color-text)", padding: "var(--space-3)" }}>
                Total
              </td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 700, color: "var(--color-primary)", padding: "var(--space-3)" }}>
                ${currentAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── Current Entries (Revisions) ─── */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
          Revisions
        </h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
          Each upload counts as a revision ($50/revision). Min {MIN_SUPPORTS_PER_REVISION} supports, max {MAX_SUPPORTS_PER_REVISION} supports per revision.
        </p>

        {state.currentEntries.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-faint)", padding: "var(--space-4)", textAlign: "center" }}>
            No revisions yet. Upload and generate PDFs to add entries.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {state.currentEntries.map((entry, idx) => {
              const date = new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              const underMin = entry.supportCount < MIN_SUPPORTS_PER_REVISION
              const overMax = entry.supportCount > MAX_SUPPORTS_PER_REVISION

              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-4)",
                    background: "var(--color-surface-2)",
                    borderRadius: "var(--radius-md)",
                    borderLeft: underMin || overMax ? "3px solid var(--color-warning)" : "3px solid var(--color-success)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)", minWidth: 30 }}>
                    R{idx + 1}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 90 }}>
                    {date}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text)", flex: 1 }}>
                    {entry.fileName}
                  </span>
                  <StatusBadge variant={underMin ? "warning" : overMax ? "error" : "success"}>
                    {entry.supportCount} supports
                  </StatusBadge>
                  {underMin && (
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-warning)" }}>
                      Below min ({MIN_SUPPORTS_PER_REVISION})
                    </span>
                  )}
                  {overMax && (
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-error)" }}>
                      Exceeds max ({MAX_SUPPORTS_PER_REVISION})
                    </span>
                  )}
                  <div style={{ display: "flex", gap: "var(--space-1)" }}>
                    {Object.entries(entry.types).map(([type, count]) => (
                      <StatusBadge key={type} variant="info">{type}: {count}</StatusBadge>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Unique keys summary */}
        {currentUniqueKeys.length > 0 && (
          <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3) var(--space-4)", background: "var(--color-surface-offset)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            <strong>{currentUniqueKeys.length}</strong> unique support IDs (duplicates across revisions counted once)
          </div>
        )}
      </div>

      {/* ─── Actions ─── */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          marginBottom: "var(--space-8)",
          paddingBottom: "var(--space-6)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <ActionButton
          variant="secondary"
          disabled={state.currentEntries.length === 0}
          onClick={handleDownloadInvoice}
          iconLeft={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M4 7l4 4 4-4M2 12h12v2H2v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          Download Invoice PDF
        </ActionButton>

        {!confirmBill ? (
          <ActionButton
            variant="primary"
            disabled={state.currentEntries.length === 0}
            onClick={() => setConfirmBill(true)}
          >
            Mark as Billed
          </ActionButton>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-warning)" }}>
              Confirm? Counter resets to 0.
            </span>
            <ActionButton variant="destructive" onClick={handleMarkBilled}>
              Yes, Mark Billed
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => setConfirmBill(false)}>
              Cancel
            </ActionButton>
          </div>
        )}

        {/* Clear all data */}
        {!confirmClear ? (
          <ActionButton
            variant="ghost"
            disabled={state.currentEntries.length === 0 && state.history.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            Clear All Data
          </ActionButton>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-error)" }}>
              Delete all billing data?
            </span>
            <ActionButton variant="destructive" onClick={() => { clearAll(); setConfirmClear(false) }}>
              Yes, Clear
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </ActionButton>
          </div>
        )}
      </div>

      {/* ─── Past Invoices ─── */}
      {state.history.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Past Invoices
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {state.history.map((cycle, idx) => {
              const date = new Date(cycle.billedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              return (
                <div
                  key={cycle.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    padding: "var(--space-4)",
                    background: "var(--color-surface-2)",
                    borderRadius: "var(--radius-md)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 90 }}>
                    {date}
                  </span>
                  <StatusBadge variant="info">{cycle.totalSupports} supports</StatusBadge>
                  <StatusBadge variant="info">{cycle.entries.length} revisions</StatusBadge>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 600, color: "var(--color-text)" }}>
                    ${cycle.amountDue.toFixed(2)}
                  </span>
                  <span style={{ flexGrow: 1 }} />
                  <StatusBadge variant="success">Billed</StatusBadge>
                  <ActionButton variant="ghost" size="sm" onClick={() => handleDownloadPastInvoice(idx)}>
                    Download
                  </ActionButton>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
