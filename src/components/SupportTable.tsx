"use client"

import { useMemo, useState } from "react"
import type { SupportRow } from "@/types/support"
import EditableCell from "./EditableCell"

interface ColumnDef {
  key: string
  label: string
  minWidth: number
  align: "left" | "center"
  type: "text" | "number"
  readOnly?: boolean
  alwaysEditable?: boolean
  getValue: (row: SupportRow) => string
}

/** Fixed columns before items */
const PRE_ITEM_COLS: ColumnDef[] = [
  { key: "supportTagName", label: "Support Tag Name", minWidth: 160, align: "left", type: "text", getValue: (r) => r.supportTagName },
  { key: "discipline", label: "Discipline", minWidth: 100, align: "left", type: "text", getValue: (r) => r.discipline },
  { key: "type", label: "Type", minWidth: 100, align: "left", type: "text", getValue: (r) => r.type },
  { key: "a", label: "A", minWidth: 56, align: "center", type: "number", getValue: (r) => r.a },
  { key: "b", label: "B", minWidth: 56, align: "center", type: "number", getValue: (r) => r.b },
  { key: "c", label: "C", minWidth: 56, align: "center", type: "number", getValue: (r) => r.c },
  { key: "d", label: "D", minWidth: 56, align: "center", type: "number", getValue: (r) => r.d },
  { key: "total", label: "Total (A+B+C+D)", minWidth: 80, align: "center", type: "number", readOnly: true, getValue: (r) => r.total },
]

/** Fixed columns after items */
const POST_ITEM_COLS: ColumnDef[] = [
  { key: "x", label: "X", minWidth: 64, align: "center", type: "number", alwaysEditable: true, getValue: (r) => r.x },
  { key: "y", label: "Y", minWidth: 64, align: "center", type: "number", alwaysEditable: true, getValue: (r) => r.y },
  { key: "z", label: "Z", minWidth: 64, align: "center", type: "number", alwaysEditable: true, getValue: (r) => r.z },
  { key: "xGrid", label: "X-Grid", minWidth: 80, align: "left", type: "text", getValue: (r) => r.xGrid },
  { key: "yGrid", label: "Y-Grid", minWidth: 80, align: "left", type: "text", getValue: (r) => r.yGrid },
  { key: "remarks", label: "Remarks", minWidth: 200, align: "left", type: "text", alwaysEditable: true, getValue: (r) => r.remarks },
]

interface SupportTableProps {
  rows: SupportRow[]
  onCellEdit?: (rowIndex: number, colKey: string, value: string | number) => void
  disabled?: boolean
  selectedRows?: Set<number>
  onRowSelect?: (rowIndex: number) => void
}

export default function SupportTable({ rows, onCellEdit, disabled = false, selectedRows, onRowSelect }: SupportTableProps) {
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Determine max item count across all rows
  const maxItems = useMemo(() => {
    let max = 0
    for (const row of rows) {
      if (row.items && row.items.length > max) max = row.items.length
    }
    // Fallback: at least check legacy fields
    if (max === 0) {
      for (const row of rows) {
        if (row.item01Name || row.item01Qty) max = Math.max(max, 1)
        if (row.item02Name || row.item02Qty) max = Math.max(max, 2)
        if (row.item03Name || row.item03Qty) max = Math.max(max, 3)
      }
    }
    return Math.max(max, 1) // at least 1 item column
  }, [rows])

  // Build dynamic item columns
  const itemCols: ColumnDef[] = useMemo(() => {
    const cols: ColumnDef[] = []
    for (let i = 0; i < maxItems; i++) {
      const idx = i
      const num = String(i + 1).padStart(2, "0")
      cols.push({
        key: `item${num}Name`,
        label: `Item-${num} Name`,
        minWidth: 130,
        align: "left",
        type: "text",
        getValue: (r) => r.items?.[idx]?.name ?? (r as unknown as Record<string, string>)[`item${num}Name`] ?? "",
      })
      cols.push({
        key: `item${num}Qty`,
        label: `Item-${num} Qty`,
        minWidth: 72,
        align: "center",
        type: "number",
        getValue: (r) => r.items?.[idx]?.qty ?? (r as unknown as Record<string, string>)[`item${num}Qty`] ?? "",
      })
    }
    return cols
  }, [maxItems])

  const allColumns = useMemo(() => [...PRE_ITEM_COLS, ...itemCols, ...POST_ITEM_COLS], [itemCols])

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== "")
    if (activeFilters.length === 0) return rows
    return rows.filter((row) =>
      activeFilters.every(([colKey, query]) => {
        const col = allColumns.find((c) => c.key === colKey)
        if (!col) return true
        return col.getValue(row).toLowerCase().includes(query.trim().toLowerCase())
      })
    )
  }, [rows, filters, allColumns])

  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== "")

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        overflowX: "auto",
        opacity: disabled ? 0.7 : 1,
        pointerEvents: disabled ? "none" : undefined,
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: allColumns.reduce((s, c) => s + c.minWidth, 0),
          borderCollapse: "separate",
          borderSpacing: 0,
        }}
      >
        <thead>
          <tr>
            {onRowSelect && (
              <th style={{ background: "var(--color-surface-2)", padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, zIndex: 1, width: 32 }} />
            )}
            {allColumns.map((col) => (
              <th
                key={col.key}
                style={{
                  background: "var(--color-surface-2)",
                  fontFamily: "var(--font-display)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color: "var(--color-text-muted)",
                  padding: "var(--space-2) var(--space-3)",
                  borderBottom: "1px solid var(--color-border)",
                  whiteSpace: "nowrap",
                  textAlign: col.align,
                  minWidth: col.minWidth,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
          {/* Per-column filter inputs */}
          <tr>
            {onRowSelect && (
              <th style={{ background: "var(--color-surface)", padding: "var(--space-1)", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 38, zIndex: 1, width: 32 }} />
            )}
            {allColumns.map((col) => (
              <th
                key={`filter-${col.key}`}
                style={{
                  background: "var(--color-surface)",
                  padding: "var(--space-1) var(--space-2)",
                  borderBottom: "1px solid var(--color-border)",
                  position: "sticky",
                  top: 38,
                  zIndex: 1,
                }}
              >
                <input
                  type="text"
                  value={filters[col.key] || ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                  placeholder="Filter"
                  style={{
                    width: "100%",
                    height: 24,
                    padding: "0 var(--space-2)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.6875rem",
                    color: "var(--color-text)",
                    background: filters[col.key] ? "var(--color-primary-soft)" : "var(--color-surface-2)",
                    border: filters[col.key] ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasActiveFilters && (
            <tr>
              <td
                colSpan={allColumns.length + (onRowSelect ? 1 : 0)}
                style={{
                  padding: "var(--space-1) var(--space-3)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.75rem",
                  color: "var(--color-text-muted)",
                  background: "var(--color-primary-soft)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                Showing {filteredRows.length} of {rows.length} rows
                <button
                  onClick={() => setFilters({})}
                  style={{
                    marginLeft: "var(--space-3)",
                    fontFamily: "var(--font-display)",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "var(--color-primary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Clear all filters
                </button>
              </td>
            </tr>
          )}
          {filteredRows.map((row, rowIdx) => {
            const isWarning = row._hasErrors

            return (
              <tr
                key={row._rowIndex}
                style={{
                  background: isWarning
                    ? "var(--color-warning-soft)"
                    : rowIdx % 2 === 1
                    ? "var(--color-surface-2)"
                    : undefined,
                  borderLeft: isWarning ? "3px solid var(--color-warning)" : undefined,
                }}
              >
                {onRowSelect && (
                  <td style={{ padding: "var(--space-2)", verticalAlign: "middle", borderBottom: "1px solid var(--color-border)" }}>
                    <input type="checkbox" checked={selectedRows?.has(row._rowIndex) || false} onChange={() => onRowSelect(row._rowIndex)} style={{ accentColor: "var(--color-primary)" }} />
                  </td>
                )}
                {allColumns.map((col) => {
                  const cellValue = col.getValue(row)
                  const isMissing = !col.readOnly && row._missingFields.includes(col.key)
                  const isEditable = col.alwaysEditable && !col.readOnly

                  return (
                    <td
                      key={col.key}
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "0.875rem",
                        color: col.readOnly ? "var(--color-text-muted)" : "var(--color-text)",
                        padding: "var(--space-2) var(--space-3)",
                        borderBottom: "1px solid var(--color-border)",
                        whiteSpace: "nowrap",
                        verticalAlign: "middle",
                        textAlign: col.align,
                        background: col.readOnly
                          ? "var(--color-surface-offset)"
                          : isMissing
                          ? "rgba(154, 100, 0, 0.18)"
                          : isEditable
                          ? "var(--color-primary-soft)"
                          : undefined,
                        border: isMissing ? "1px dashed var(--color-warning)" : undefined,
                        fontWeight: col.readOnly ? 600 : undefined,
                      }}
                    >
                      {isMissing ? (
                        <EditableCell
                          value={cellValue || null}
                          columnType={col.type}
                          disabled={disabled}
                          onCommit={(val) => onCellEdit?.(row._rowIndex, col.key, val)}
                        />
                      ) : isEditable ? (
                        <EditableCell
                          value={cellValue || null}
                          columnType={col.type}
                          disabled={disabled}
                          onCommit={(val) => onCellEdit?.(row._rowIndex, col.key, val)}
                        />
                      ) : (
                        String(cellValue ?? "")
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
