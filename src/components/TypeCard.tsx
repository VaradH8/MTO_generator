"use client"

import StatusBadge from "./StatusBadge"
import ActionButton from "./ActionButton"

type CardStatus = "ready" | "downloading" | "error"

interface TypeCardProps {
  typeName: string
  count: number
  status?: CardStatus
  onDownload: () => void
  /** Optional Excel download — when supplied a parallel button appears
   *  with its own status. Hidden when undefined for backwards compat. */
  excelStatus?: CardStatus
  onDownloadExcel?: () => void
}

export default function TypeCard({
  typeName,
  count,
  status = "ready",
  onDownload,
  excelStatus = "ready",
  onDownloadExcel,
}: TypeCardProps) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-6)",
        boxShadow: "var(--shadow-md)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        marginBottom: "var(--space-4)",
        flexWrap: "wrap",
      }}
    >
      {/* PDF Icon */}
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
        <rect x="4" y="2" width="24" height="28" rx="3" stroke="var(--color-error)" strokeWidth="2" />
        <text
          x="16"
          y="20"
          textAnchor="middle"
          fill="var(--color-error)"
          fontSize="9"
          fontFamily="var(--font-display)"
          fontWeight="700"
        >
          PDF
        </text>
      </svg>

      {/* Type Name */}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.125rem",
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {typeName}
      </span>

      {/* Count Badge */}
      <StatusBadge variant="info">{count}</StatusBadge>

      {/* Spacer */}
      <span style={{ flexGrow: 1 }} />

      {/* Download Buttons */}
      <ActionButton
        variant="secondary"
        size="sm"
        loading={status === "downloading"}
        onClick={onDownload}
      >
        {status === "error" ? "Retry" : "PDF"}
      </ActionButton>
      {onDownloadExcel && (
        <ActionButton
          variant="secondary"
          size="sm"
          loading={excelStatus === "downloading"}
          onClick={onDownloadExcel}
        >
          {excelStatus === "error" ? "Retry" : "Excel"}
        </ActionButton>
      )}
    </div>
  )
}
