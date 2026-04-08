"use client"

import type { SupportRow } from "@/types/support"
import EditableCell from "./EditableCell"

interface ColumnDef {
  key: keyof SupportRow
  label: string
  minWidth: number
  align: "left" | "center"
  type: "text" | "number"
  readOnly?: boolean
  /** Always show as editable cell, even when value exists */
  alwaysEditable?: boolean
}

const COLUMNS: ColumnDef[] = [
  { key: "supportTagName", label: "Support Tag Name", minWidth: 160, align: "left", type: "text" },
  { key: "discipline", label: "Discipline", minWidth: 100, align: "left", type: "text" },
  { key: "type", label: "Type", minWidth: 100, align: "left", type: "text" },
  { key: "a", label: "A", minWidth: 56, align: "center", type: "number" },
  { key: "b", label: "B", minWidth: 56, align: "center", type: "number" },
  { key: "c", label: "C", minWidth: 56, align: "center", type: "number" },
  { key: "d", label: "D", minWidth: 56, align: "center", type: "number" },
  { key: "total", label: "Total (A+B+C+D)", minWidth: 80, align: "center", type: "number", readOnly: true },
  { key: "item01Name", label: "Item-01 Name", minWidth: 140, align: "left", type: "text" },
  { key: "item01Qty", label: "Item-01 Qty", minWidth: 72, align: "center", type: "number" },
  { key: "item02Name", label: "Item-02 Name", minWidth: 140, align: "left", type: "text" },
  { key: "item02Qty", label: "Item-02 Qty", minWidth: 72, align: "center", type: "number" },
  { key: "item03Name", label: "Item-03 Name", minWidth: 140, align: "left", type: "text" },
  { key: "item03Qty", label: "Item-03 Qty", minWidth: 72, align: "center", type: "number" },
  { key: "x", label: "X", minWidth: 64, align: "center", type: "number", alwaysEditable: true },
  { key: "y", label: "Y", minWidth: 64, align: "center", type: "number", alwaysEditable: true },
  { key: "z", label: "Z", minWidth: 64, align: "center", type: "number", alwaysEditable: true },
  { key: "xGrid", label: "X-Grid", minWidth: 80, align: "left", type: "text" },
  { key: "yGrid", label: "Y-Grid", minWidth: 80, align: "left", type: "text" },
  { key: "remarks", label: "Remarks", minWidth: 200, align: "left", type: "text" },
]

interface SupportTableProps {
  rows: SupportRow[]
  onCellEdit?: (rowIndex: number, colKey: string, value: string | number) => void
  disabled?: boolean
}

export default function SupportTable({ rows, onCellEdit, disabled = false }: SupportTableProps) {
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
          minWidth: 1600,
          borderCollapse: "separate",
          borderSpacing: 0,
        }}
      >
        <thead>
          <tr>
            {COLUMNS.map((col) => (
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
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
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
                {COLUMNS.map((col) => {
                  const cellValue = row[col.key]
                  const isMissing = !col.readOnly && row._missingFields.includes(col.key as string)
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
                          value={null}
                          columnType={col.type}
                          disabled={disabled}
                          onCommit={(val) => onCellEdit?.(row._rowIndex, col.key as string, val)}
                        />
                      ) : isEditable ? (
                        <EditableCell
                          value={cellValue as string | number | null}
                          columnType={col.type}
                          disabled={disabled}
                          onCommit={(val) => onCellEdit?.(row._rowIndex, col.key as string, val)}
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
