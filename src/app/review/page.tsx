"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import SupportTable from "@/components/SupportTable"
import ActionButton from "@/components/ActionButton"
import EmptyState from "@/components/EmptyState"
import { useSupportContext } from "@/context/SupportContext"

function calcTotal(row: { a: string; b: string; c: string; d: string }): string {
  const a = parseFloat(row.a) || 0
  const b = parseFloat(row.b) || 0
  const c = parseFloat(row.c) || 0
  const d = parseFloat(row.d) || 0
  const sum = a + b + c + d
  return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
}

export default function ReviewPage() {
  const router = useRouter()
  const { validationResult, groupedSupports, setValidationResult, setGroupedSupports } = useSupportContext()
  const [generating, setGenerating] = useState(false)

  if (!validationResult || !validationResult.rows.length) {
    return (
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "var(--space-8)",
          }}
        >
          Review Support Data
        </h1>
        <EmptyState
          title="No data loaded"
          message="No support data found. Please upload a file first."
          action={{ label: "Go to Upload", onClick: () => router.push("/") }}
        />
      </div>
    )
  }

  const REQUIRED_KEYS = ["supportTagName", "type"]
  const { totalRows, totalTypes, missingFieldsCount, requiredMissingCount, rows } = validationResult

  const handleCellEdit = (rowIndex: number, colKey: string, value: string | number) => {
    const updatedRows = rows.map((row) => {
      if (row._rowIndex !== rowIndex) return row
      const updated = { ...row, [colKey]: String(value) }

      // Recalculate total whenever A, B, C, or D changes
      if (["a", "b", "c", "d"].includes(colKey)) {
        updated.total = calcTotal(updated)
      }

      updated._missingFields = updated._missingFields.filter((f) => f !== colKey)
      // _hasErrors only true if required fields are still missing
      updated._hasErrors = updated._missingFields.some((f) => REQUIRED_KEYS.includes(f))
      return updated
    })

    const newMissingCount = updatedRows.reduce((sum, r) => sum + r._missingFields.length, 0)
    const newRequiredMissing = updatedRows.reduce(
      (sum, r) => sum + r._missingFields.filter((f) => REQUIRED_KEYS.includes(f)).length,
      0
    )
    const types = new Set(updatedRows.map((r) => r.type).filter(Boolean))

    setValidationResult({
      isValid: newRequiredMissing === 0,
      totalRows: updatedRows.length,
      totalTypes: types.size,
      missingFieldsCount: newMissingCount,
      requiredMissingCount: newRequiredMissing,
      rows: updatedRows,
    })

    // Update grouped
    const grouped: Record<string, typeof updatedRows> = {}
    for (const row of updatedRows) {
      const t = row.type || "Unknown"
      if (!grouped[t]) grouped[t] = []
      grouped[t].push(row)
    }
    setGroupedSupports(grouped)
  }

  const handleGenerate = async () => {
    if (!groupedSupports) return
    setGenerating(true)
    try {
      router.push("/output")
    } catch {
      setGenerating(false)
    }
  }

  const requiredColor = requiredMissingCount > 0 ? "var(--color-error)" : "var(--color-success)"
  const warningColor = missingFieldsCount > 0 ? "var(--color-warning)" : "var(--color-success)"

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--color-primary)",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          marginBottom: "var(--space-4)",
          padding: "var(--space-1) var(--space-2)",
          height: 32,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

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
        Review Support Data
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1rem",
          color: "var(--color-text-muted)",
          marginBottom: "var(--space-8)",
        }}
      >
        Verify and complete any missing fields. Total is auto-calculated from A + B + C + D.
      </p>

      {/* Summary Bar */}
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        {[
          { value: totalRows, label: "Rows" },
          { value: totalTypes, label: "Types" },
          { value: requiredMissingCount, label: "Required", accent: requiredColor },
          { value: missingFieldsCount, label: "Optional", accent: warningColor },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderLeft: stat.accent ? `3px solid ${stat.accent}` : "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4) var(--space-5)",
              boxShadow: "var(--shadow-sm)",
              minWidth: 120,
              flex: "1 1 0",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 700,
                color: stat.accent || "var(--color-text)",
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                marginTop: "var(--space-1)",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Data Table */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <SupportTable rows={rows} onCellEdit={handleCellEdit} disabled={generating} />
      </div>

      {/* Generate button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ActionButton
          variant="primary"
          disabled={false}
          loading={generating}
          onClick={handleGenerate}
          iconRight={
            !generating ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : undefined
          }
        >
          {generating ? "Generating..." : "Generate PDFs"}
        </ActionButton>
      </div>
    </div>
  )
}
