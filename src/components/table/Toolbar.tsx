"use client"

import { useState, useRef, useEffect } from "react"
import type { CellFormat, ConditionalRule, ColumnDef } from "./types"

// ── Column Visibility Dropdown ──────────────────────────────────────────

export function ColumnVisibility({
  columns,
  hidden,
  onToggle,
}: {
  columns: ColumnDef[]
  hidden: Set<string>
  onToggle: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={toolBtnStyle} title="Toggle columns">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span style={{ marginLeft: 4 }}>Columns</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 200, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: "var(--space-2)", minWidth: 180, maxHeight: 300, overflowY: "auto" }}>
          {columns.map((col) => (
            <label key={col.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text)", cursor: "pointer" }}>
              <input type="checkbox" checked={!hidden.has(col.key)} onChange={() => onToggle(col.key)} style={{ accentColor: "var(--color-primary)" }} />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cell Formatting Toolbar ─────────────────────────────────────────────

export function FormatToolbar({
  hasSelection,
  onApplyFormat,
}: {
  hasSelection: boolean
  onApplyFormat: (fmt: Partial<CellFormat>) => void
}) {
  const [showColorPicker, setShowColorPicker] = useState<"text" | "bg" | null>(null)
  const COLORS = ["#000000", "#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#3182ce", "#805ad5", "#ffffff"]

  return (
    <div style={{ display: "inline-flex", gap: 2, alignItems: "center", opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
      <button onClick={() => onApplyFormat({ bold: true })} style={toolBtnStyle} title="Bold (toggle)"><strong>B</strong></button>
      <button onClick={() => onApplyFormat({ italic: true })} style={toolBtnStyle} title="Italic (toggle)"><em>I</em></button>
      <div style={{ position: "relative" }}>
        <button onClick={() => setShowColorPicker(showColorPicker === "text" ? null : "text")} style={toolBtnStyle} title="Text color">
          <span style={{ borderBottom: "2px solid var(--color-primary)" }}>A</span>
        </button>
        {showColorPicker === "text" && <ColorGrid colors={COLORS} onPick={(c) => { onApplyFormat({ textColor: c }); setShowColorPicker(null) }} onClose={() => setShowColorPicker(null)} />}
      </div>
      <div style={{ position: "relative" }}>
        <button onClick={() => setShowColorPicker(showColorPicker === "bg" ? null : "bg")} style={toolBtnStyle} title="Background color">
          <span style={{ background: "var(--color-primary-soft)", padding: "0 3px", borderRadius: 2 }}>bg</span>
        </button>
        {showColorPicker === "bg" && <ColorGrid colors={COLORS} onPick={(c) => { onApplyFormat({ bgColor: c }); setShowColorPicker(null) }} onClose={() => setShowColorPicker(null)} />}
      </div>
    </div>
  )
}

function ColorGrid({ colors, onPick, onClose }: { colors: string[]; onPick: (c: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [onClose])

  return (
    <div ref={ref} style={{ position: "absolute", top: "100%", left: 0, zIndex: 200, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: 6, display: "grid", gridTemplateColumns: "repeat(4, 24px)", gap: 3 }}>
      {colors.map((c) => (
        <button key={c} onClick={() => onPick(c)} style={{ width: 24, height: 24, background: c, border: "1px solid var(--color-border)", borderRadius: 3, cursor: "pointer" }} />
      ))}
      <button onClick={() => onPick("")} style={{ width: 24, height: 24, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 3, cursor: "pointer", fontSize: 10 }}>✕</button>
    </div>
  )
}

// ── Conditional Formatting Rules ────────────────────────────────────────

export function ConditionalFormatting({
  rules,
  columns,
  onUpdate,
}: {
  rules: ConditionalRule[]
  columns: ColumnDef[]
  onUpdate: (rules: ConditionalRule[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState({ column: "", operator: "gt" as ConditionalRule["operator"], value: "", bgColor: "#fefcbf", textColor: "" })

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const addRule = () => {
    if (!draft.column) return
    const rule: ConditionalRule = { ...draft, id: Date.now().toString(36) }
    onUpdate([...rules, rule])
    setDraft({ column: "", operator: "gt", value: "", bgColor: "#fefcbf", textColor: "" })
  }

  const selectStyle: React.CSSProperties = { height: 26, padding: "0 4px", fontFamily: "var(--font-body)", fontSize: "0.6875rem", border: "1px solid var(--color-border)", borderRadius: 4, background: "var(--color-surface)", color: "var(--color-text)" }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={toolBtnStyle} title="Conditional formatting">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span style={{ marginLeft: 4 }}>Rules</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 200, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: "var(--space-3)", minWidth: 300 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, marginBottom: 8 }}>Conditional Formatting Rules</div>
          {rules.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", fontFamily: "var(--font-body)", fontSize: "0.6875rem" }}>
              <span style={{ background: r.bgColor || undefined, color: r.textColor || undefined, padding: "1px 6px", borderRadius: 3 }}>{r.column} {r.operator} {r.value}</span>
              <button onClick={() => onUpdate(rules.filter((x) => x.id !== r.id))} style={{ ...toolBtnStyle, color: "var(--color-error)", padding: "0 4px" }}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "end" }}>
            <select value={draft.column} onChange={(e) => setDraft({ ...draft, column: e.target.value })} style={selectStyle}>
              <option value="">Column...</option>
              {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select value={draft.operator} onChange={(e) => setDraft({ ...draft, operator: e.target.value as ConditionalRule["operator"] })} style={selectStyle}>
              <option value="gt">&gt;</option>
              <option value="lt">&lt;</option>
              <option value="eq">=</option>
              <option value="neq">≠</option>
              <option value="contains">Contains</option>
              <option value="empty">Empty</option>
              <option value="notEmpty">Not empty</option>
            </select>
            <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="Value" style={{ ...selectStyle, width: 60 }} />
            <input type="color" value={draft.bgColor} onChange={(e) => setDraft({ ...draft, bgColor: e.target.value })} style={{ width: 26, height: 26, border: "none", padding: 0, cursor: "pointer" }} title="Highlight color" />
            <button onClick={addRule} style={{ ...toolBtnStyle, background: "var(--color-primary)", color: "#fff" }}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Export Buttons ───────────────────────────────────────────────────────

export function ExportButtons({ onExportCSV, onExportXLSX }: { onExportCSV: () => void; onExportXLSX: () => void }) {
  return (
    <div style={{ display: "inline-flex", gap: 2 }}>
      <button onClick={onExportCSV} style={toolBtnStyle} title="Export CSV">CSV</button>
      <button onClick={onExportXLSX} style={toolBtnStyle} title="Export XLSX">XLSX</button>
    </div>
  )
}

// ── Shared styles ───────────────────────────────────────────────────────

const toolBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  height: 28,
  padding: "0 8px",
  fontFamily: "var(--font-display)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--color-text)",
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
}
