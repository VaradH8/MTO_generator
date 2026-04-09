"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import FileUploadZone from "@/components/FileUploadZone"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import { parseExcelFile } from "@/lib/parseExcel"
import { useSupportContext } from "@/context/SupportContext"
import type { ParseResult, SupportRow } from "@/types/support"

type FileStatus = "idle" | "validating" | "valid" | "invalid"

/** Human-readable labels for each field key */
const FIELD_LABELS: Record<string, string> = {
  supportTagName: "Support Tag Name",
  discipline: "Discipline",
  type: "Type",
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  item01Name: "Item-01 Name",
  item02Name: "Item-02 Name",
  item03Name: "Item-03 Name",
  x: "X",
  y: "Y",
  z: "Z",
  xGrid: "X-Grid",
  yGrid: "Y-Grid",
  remarks: "Remarks",
}

/** Per-type qty: { "L01": { item01Qty: "3", item02Qty: "2", item03Qty: "1" } } */
interface TypeItemQty {
  item01Qty: string
  item02Qty: string
  item03Qty: string
}

function calcTotal(row: SupportRow): string {
  const a = parseFloat(row.a) || 0
  const b = parseFloat(row.b) || 0
  const c = parseFloat(row.c) || 0
  const d = parseFloat(row.d) || 0
  const sum = a + b + c + d
  return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
}

export default function UploadPage() {
  const router = useRouter()
  const { setValidationResult, setGroupedSupports } = useSupportContext()

  // File upload state
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<FileStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  // After parse: missing columns prompt + per-type qty
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [missingValues, setMissingValues] = useState<Record<string, string>>({})
  const [typeQty, setTypeQty] = useState<Record<string, TypeItemQty>>({})

  // Derive unique types from parsed data
  const uniqueTypes = useMemo(() => {
    if (!parseResult) return []
    const types = new Set<string>()
    for (const row of parseResult.validation.rows) {
      if (row.type) types.add(row.type)
    }
    return Array.from(types).sort()
  }, [parseResult])

  // Count supports per type
  const typeCounts = useMemo(() => {
    if (!parseResult) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    for (const row of parseResult.validation.rows) {
      const t = row.type || "Unknown"
      counts[t] = (counts[t] || 0) + 1
    }
    return counts
  }, [parseResult])

  const handleFileSelect = (f: File) => {
    setFile(f)
    setParseResult(null)
    setMissingValues({})
    setTypeQty({})
    setStatus("validating")
    setError(null)

    const ext = f.name.split(".").pop()?.toLowerCase()
    if (!ext || !["xlsx", "xls"].includes(ext)) {
      setStatus("invalid")
      setError("Invalid file type. Please upload .xlsx or .xls")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setStatus("invalid")
      setError("File exceeds 10 MB limit.")
      return
    }

    setStatus("valid")
  }

  const handleFileRemove = () => {
    setFile(null)
    setStatus("idle")
    setError(null)
    setParseResult(null)
    setMissingValues({})
    setTypeQty({})
  }

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    try {
      const result = await parseExcelFile(file)
      setParseResult(result)

      // Initialize missing values
      const initial: Record<string, string> = {}
      for (const col of result.missingColumns) {
        initial[col] = ""
      }
      setMissingValues(initial)

      // Initialize per-type qty (3 item qtys per type)
      const qtyInit: Record<string, TypeItemQty> = {}
      const types = new Set<string>()
      for (const row of result.validation.rows) {
        if (row.type) types.add(row.type)
      }
      for (const t of types) {
        qtyInit[t] = { item01Qty: "", item02Qty: "", item03Qty: "" }
      }
      setTypeQty(qtyInit)
    } catch {
      setStatus("invalid")
      setError("Failed to parse file. Check that the sheet contains valid support data.")
    } finally {
      setParsing(false)
    }
  }

  const updateTypeQty = (type: string, field: keyof TypeItemQty, value: string) => {
    setTypeQty((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  const finalize = (result: ParseResult, overrides: Record<string, string>, qtyByType: Record<string, TypeItemQty>) => {
    const rows: SupportRow[] = result.validation.rows.map((row) => {
      const updated = { ...row }

      // Apply global overrides for missing columns
      const rowType = updated.type || overrides["type"] || ""
      const remainingMissing: string[] = []
      for (const field of row._missingFields) {
        if (overrides[field] && overrides[field].trim() !== "") {
          ;(updated as Record<string, unknown>)[field] = overrides[field].trim()
        } else {
          remainingMissing.push(field)
        }
      }

      // Apply per-type qty to each item qty field independently
      if (rowType && qtyByType[rowType]) {
        const tq = qtyByType[rowType]

        if (tq.item01Qty.trim() && (!updated.item01Qty || updated.item01Qty === "")) {
          updated.item01Qty = tq.item01Qty.trim()
          const idx = remainingMissing.indexOf("item01Qty")
          if (idx !== -1) remainingMissing.splice(idx, 1)
        }
        if (tq.item02Qty.trim() && (!updated.item02Qty || updated.item02Qty === "")) {
          updated.item02Qty = tq.item02Qty.trim()
          const idx = remainingMissing.indexOf("item02Qty")
          if (idx !== -1) remainingMissing.splice(idx, 1)
        }
        if (tq.item03Qty.trim() && (!updated.item03Qty || updated.item03Qty === "")) {
          updated.item03Qty = tq.item03Qty.trim()
          const idx = remainingMissing.indexOf("item03Qty")
          if (idx !== -1) remainingMissing.splice(idx, 1)
        }
      }

      // Auto-calculate total = A + B + C + D
      updated.total = calcTotal(updated)
      const totalIdx = remainingMissing.indexOf("total")
      if (totalIdx !== -1) remainingMissing.splice(totalIdx, 1)

      updated._missingFields = remainingMissing
      updated._hasErrors = remainingMissing.some((f) => ["supportTagName", "type"].includes(f))
      return updated
    })

    const missingFieldsCount = rows.reduce((s, r) => s + r._missingFields.length, 0)
    const requiredMissingCount = rows.reduce(
      (s, r) => s + r._missingFields.filter((f) => ["supportTagName", "type"].includes(f)).length,
      0
    )
    const types = new Set(rows.map((r) => r.type).filter(Boolean))

    const validation = {
      isValid: requiredMissingCount === 0,
      totalRows: rows.length,
      totalTypes: types.size,
      missingFieldsCount,
      requiredMissingCount,
      rows,
    }

    setValidationResult(validation)

    // Group by type
    const grouped: Record<string, SupportRow[]> = {}
    for (const row of rows) {
      const t = row.type || "Unknown"
      if (!grouped[t]) grouped[t] = []
      grouped[t].push(row)
    }
    setGroupedSupports(grouped)

    router.push("/review")
  }

  const handleContinue = () => {
    if (!parseResult) return
    finalize(parseResult, missingValues, typeQty)
  }

  const showConfigForm = !!parseResult

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 40,
    padding: "0 var(--space-3)",
    fontFamily: "var(--font-body)",
    fontSize: "0.875rem",
    color: "var(--color-text)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-display)",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    marginBottom: "var(--space-1)",
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
        Upload Support Schedule
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1rem",
          color: "var(--color-text-muted)",
          marginBottom: "var(--space-8)",
        }}
      >
        Select the support schedule spreadsheet to get started.
      </p>

      <FileUploadZone
        file={file}
        status={status}
        errorMessage={error}
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
      />

      {/* Parse button */}
      {!showConfigForm && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-6)" }}>
          <ActionButton
            variant="primary"
            disabled={status !== "valid"}
            loading={parsing}
            onClick={handleParse}
            iconRight={
              !parsing ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : undefined
            }
          >
            {parsing ? "Parsing..." : "Parse File"}
          </ActionButton>
        </div>
      )}

      {/* ─── Configuration Form ─── */}
      {showConfigForm && (
        <div
          style={{
            marginTop: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Info banner */}
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              background: "var(--color-primary-soft)",
              borderRadius: "var(--radius-sm)",
              borderLeft: "3px solid var(--color-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--color-text)",
            }}
          >
            Parsed <strong>{parseResult!.validation.totalRows} rows</strong> with{" "}
            <strong>{uniqueTypes.length} type{uniqueTypes.length !== 1 ? "s" : ""}</strong> found
            ({uniqueTypes.join(", ")}).
            Detected columns: {parseResult!.detectedHeaders.join(", ")}
          </div>

          {/* ─── Section 1: Per-Type Item Quantities ─── */}
          {uniqueTypes.length > 0 && (
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-6)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Item Quantities per Type
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                  marginBottom: "var(--space-5)",
                }}
              >
                Enter the quantity for each item (Item-01, Item-02, Item-03) per support type.
                These will be applied to all supports of that type.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {uniqueTypes.map((type) => {
                  const count = typeCounts[type] || 0
                  const tq = typeQty[type] || { item01Qty: "", item02Qty: "", item03Qty: "" }
                  const q1 = parseInt(tq.item01Qty) || 0
                  const q2 = parseInt(tq.item02Qty) || 0
                  const q3 = parseInt(tq.item03Qty) || 0
                  const totalPerSupport = q1 + q2 + q3
                  const grandTotal = totalPerSupport * count

                  return (
                    <div
                      key={type}
                      style={{
                        padding: "var(--space-4)",
                        background: "var(--color-surface-2)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {/* Type header row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          marginBottom: "var(--space-3)",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: "var(--color-text)",
                          }}
                        >
                          {type}
                        </span>
                        <StatusBadge variant="info">{count} supports</StatusBadge>
                        {totalPerSupport > 0 && (
                          <span
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: "0.8125rem",
                              color: "var(--color-success)",
                              fontWeight: 500,
                              marginLeft: "auto",
                            }}
                          >
                            {totalPerSupport} items/support &times; {count} = {grandTotal} total
                          </span>
                        )}
                      </div>

                      {/* 3 qty inputs in a row */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "var(--space-3)",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              ...labelStyle,
                              fontSize: "0.6875rem",
                            }}
                          >
                            Item-01 Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={tq.item01Qty}
                            onChange={(e) => updateTypeQty(type, "item01Qty", e.target.value)}
                            placeholder="0"
                            style={{ ...inputStyle, textAlign: "center" }}
                            onFocus={(e) => (e.target.style.boxShadow = "var(--shadow-focus)")}
                            onBlur={(e) => (e.target.style.boxShadow = "none")}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              ...labelStyle,
                              fontSize: "0.6875rem",
                            }}
                          >
                            Item-02 Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={tq.item02Qty}
                            onChange={(e) => updateTypeQty(type, "item02Qty", e.target.value)}
                            placeholder="0"
                            style={{ ...inputStyle, textAlign: "center" }}
                            onFocus={(e) => (e.target.style.boxShadow = "var(--shadow-focus)")}
                            onBlur={(e) => (e.target.style.boxShadow = "none")}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              ...labelStyle,
                              fontSize: "0.6875rem",
                            }}
                          >
                            Item-03 Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={tq.item03Qty}
                            onChange={(e) => updateTypeQty(type, "item03Qty", e.target.value)}
                            placeholder="0"
                            style={{ ...inputStyle, textAlign: "center" }}
                            onFocus={(e) => (e.target.style.boxShadow = "var(--shadow-focus)")}
                            onBlur={(e) => (e.target.style.boxShadow = "none")}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Section 2: Missing Columns ─── */}
          {parseResult!.missingColumns.length > 0 && (
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-6)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Missing Columns
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                  marginBottom: "var(--space-5)",
                }}
              >
                These columns were not found in the Excel. Enter values to apply to all rows,
                or leave blank to fill individually on the Review page.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                {parseResult!.missingColumns.map((col) => (
                  <div key={col}>
                    <label style={labelStyle}>
                      {FIELD_LABELS[col] || col}
                    </label>
                    <input
                      type="text"
                      value={missingValues[col] || ""}
                      onChange={(e) =>
                        setMissingValues((prev) => ({ ...prev, [col]: e.target.value }))
                      }
                      placeholder={`Enter ${FIELD_LABELS[col] || col}`}
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.boxShadow = "var(--shadow-focus)")}
                      onBlur={(e) => (e.target.style.boxShadow = "none")}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Action Buttons ─── */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
            }}
          >
            <ActionButton
              variant="secondary"
              onClick={() => {
                setParseResult(null)
                setMissingValues({})
                setTypeQty({})
              }}
            >
              Re-parse
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleContinue}
              iconRight={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              Continue to Review
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  )
}
