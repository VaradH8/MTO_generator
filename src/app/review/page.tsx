"use client"

import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect, useCallback } from "react"
import SupportTable from "@/components/SupportTable"
import ActionButton from "@/components/ActionButton"
import EmptyState from "@/components/EmptyState"
import { useSupportContext } from "@/context/SupportContext"
import * as XLSX from "xlsx"

function calcTotal(row: { a: string; b: string; c: string; d: string }): string {
  const sum = (parseFloat(row.a) || 0) + (parseFloat(row.b) || 0) + (parseFloat(row.c) || 0) + (parseFloat(row.d) || 0)
  return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
}

export default function ReviewPage() {
  const router = useRouter()
  const { validationResult, setValidationResult, setGroupedSupports } = useSupportContext()
  const [generating, setGenerating] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [bulkType, setBulkType] = useState("")
  const [bulkDiscipline, setBulkDiscipline] = useState("")

  const REQUIRED_KEYS = ["supportTagName", "type"]

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleGenerate() }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") { e.preventDefault(); handleExportExcel() }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); handlePrint() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })

  if (!validationResult || !validationResult.rows.length) {
    return (
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-8)" }}>Review Support Data</h1>
        <EmptyState title="No data loaded" message="Upload a file first." action={{ label: "Go to Upload", onClick: () => router.push("/upload") }} />
      </div>
    )
  }

  const { totalRows, totalTypes, missingFieldsCount, requiredMissingCount, rows } = validationResult

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => r.supportTagName.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) || r.discipline.toLowerCase().includes(q))
  }, [rows, search])

  const handleCellEdit = (rowIndex: number, colKey: string, value: string | number) => {
    const updatedRows = rows.map((row) => {
      if (row._rowIndex !== rowIndex) return row
      const updated = { ...row, items: row.items ? [...row.items] : [], [colKey]: String(value) }
      if (["a", "b", "c", "d"].includes(colKey)) updated.total = calcTotal(updated)
      const itemMatch = colKey.match(/^item(\d{2})(Name|Qty)$/)
      if (itemMatch) {
        const idx = parseInt(itemMatch[1], 10) - 1
        const field = itemMatch[2] === "Name" ? "name" : "qty"
        while (updated.items.length <= idx) updated.items.push({ name: "", qty: "" })
        updated.items[idx] = { ...updated.items[idx], [field]: String(value) }
      }
      updated._missingFields = updated._missingFields.filter((f) => f !== colKey)
      updated._hasErrors = updated._missingFields.some((f) => REQUIRED_KEYS.includes(f))
      return updated
    })
    updateValidation(updatedRows)
  }

  const updateValidation = (updatedRows: typeof rows) => {
    const newMissing = updatedRows.reduce((s, r) => s + r._missingFields.length, 0)
    const newRequired = updatedRows.reduce((s, r) => s + r._missingFields.filter((f) => REQUIRED_KEYS.includes(f)).length, 0)
    const types = new Set(updatedRows.map((r) => r.type).filter(Boolean))
    setValidationResult({ isValid: newRequired === 0, totalRows: updatedRows.length, totalTypes: types.size, missingFieldsCount: newMissing, requiredMissingCount: newRequired, rows: updatedRows })
    const grouped: Record<string, typeof updatedRows> = {}
    for (const row of updatedRows) { const t = row.type || "Unknown"; if (!grouped[t]) grouped[t] = []; grouped[t].push(row) }
    setGroupedSupports(grouped)
  }

  const handleRowsChange = (newRows: typeof rows) => {
    updateValidation(newRows)
  }

  // Bulk operations
  const handleBulkApply = () => {
    if (selectedRows.size === 0) return
    const updatedRows = rows.map((row) => {
      if (!selectedRows.has(row._rowIndex)) return row
      const updated = { ...row }
      if (bulkType.trim()) { updated.type = bulkType.trim(); updated._missingFields = updated._missingFields.filter((f) => f !== "type") }
      if (bulkDiscipline.trim()) { updated.discipline = bulkDiscipline.trim(); updated._missingFields = updated._missingFields.filter((f) => f !== "discipline") }
      updated._hasErrors = updated._missingFields.some((f) => REQUIRED_KEYS.includes(f))
      return updated
    })
    updateValidation(updatedRows)
    setSelectedRows(new Set())
    setBulkType("")
    setBulkDiscipline("")
  }

  const toggleRowSelect = (idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const selectAll = () => {
    if (selectedRows.size === filteredRows.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(filteredRows.map((r) => r._rowIndex)))
  }

  const handleGenerate = useCallback(() => {
    setGenerating(true)
    const grouped: Record<string, typeof rows> = {}
    for (const row of rows) { const t = row.type || "Unknown"; if (!grouped[t]) grouped[t] = []; grouped[t].push(row) }
    setGroupedSupports(grouped)
    router.push("/output")
  }, [rows, setGroupedSupports, router])

  const buildExportData = () => rows.map((row) => {
    const base: Record<string, string> = { "Support Tag Name": row.supportTagName, "Discipline": row.discipline, "Type": row.type, "A": row.a, "B": row.b, "C": row.c, "D": row.d, "Total": row.total }
    if (row.items) row.items.forEach((item, i) => { const n = String(i + 1).padStart(2, "0"); base[`Item-${n} Name`] = item.name; base[`Item-${n} Qty`] = item.qty })
    base["X"] = row.x; base["Y"] = row.y; base["Z"] = row.z; base["X-Grid"] = row.xGrid; base["Y-Grid"] = row.yGrid; base["Remarks"] = row.remarks
    return base
  })

  const handleExportExcel = useCallback(() => {
    const ws = XLSX.utils.json_to_sheet(buildExportData())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Support Data")
    XLSX.writeFile(wb, "support-data-export.xlsx")
  }, [rows])

  const handleExportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(buildExportData())
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "support-data-export.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = useCallback(() => { window.print() }, [])

  const requiredColor = requiredMissingCount > 0 ? "var(--color-error)" : "var(--color-success)"
  const warningColor = missingFieldsCount > 0 ? "var(--color-warning)" : "var(--color-success)"

  const inputStyle: React.CSSProperties = {
    height: 32, padding: "0 var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.8125rem",
    color: "var(--color-text)", background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", outline: "none",
  }

  return (
    <div>
      <button onClick={() => router.push("/upload")} style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back
      </button>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>Review Support Data</h1>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
        Total = A+B+C+D (auto). <span style={{ color: "var(--color-text-faint)" }}>Ctrl+Enter: generate | Ctrl+E: export | Ctrl+P: print</span>
      </p>

      {/* Stats + Search */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)", flexWrap: "wrap", alignItems: "end" }}>
        {[
          { value: totalRows, label: "Rows" },
          { value: totalTypes, label: "Types" },
          { value: requiredMissingCount, label: "Required", accent: requiredColor },
          { value: missingFieldsCount, label: "Optional", accent: warningColor },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderLeft: s.accent ? `3px solid ${s.accent}` : "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2) var(--space-3)", boxShadow: "var(--shadow-sm)", minWidth: 70 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: s.accent || "var(--color-text)" }}>{s.value}</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "0.625rem", color: "var(--color-text-muted)", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ ...inputStyle, minWidth: 160 }} />
      </div>

      {/* Bulk operations */}
      {selectedRows.size > 0 && (
        <div className="animate-fade-in-down" style={{ display: "flex", gap: "var(--space-3)", alignItems: "end", padding: "var(--space-3) var(--space-4)", background: "var(--color-primary-soft)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-primary)" }}>{selectedRows.size} selected</span>
          <input value={bulkType} onChange={(e) => setBulkType(e.target.value)} placeholder="Set type..." style={{ ...inputStyle, width: 100 }} />
          <input value={bulkDiscipline} onChange={(e) => setBulkDiscipline(e.target.value)} placeholder="Set discipline..." style={{ ...inputStyle, width: 120 }} />
          <ActionButton variant="primary" size="sm" onClick={handleBulkApply}>Apply</ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => setSelectedRows(new Set())}>Clear</ActionButton>
        </div>
      )}

      {/* Select all + result count */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={selectedRows.size === filteredRows.length && filteredRows.length > 0} onChange={selectAll} style={{ accentColor: "var(--color-primary)" }} />
          Select all
        </label>
        {search.trim() && <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Showing {filteredRows.length} of {totalRows}</span>}
      </div>

      {/* Table */}
      <div style={{ marginBottom: "var(--space-6)" }} id="print-area">
        <SupportTable rows={filteredRows} onCellEdit={handleCellEdit} onRowsChange={handleRowsChange} disabled={generating} selectedRows={selectedRows} onRowSelect={toggleRowSelect} />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <ActionButton variant="ghost" onClick={handlePrint}>Print</ActionButton>
        <ActionButton variant="ghost" onClick={handleExportCSV}>Export CSV</ActionButton>
        <ActionButton variant="ghost" onClick={handleExportExcel}>Export Excel</ActionButton>
        <ActionButton variant="primary" loading={generating} onClick={handleGenerate}
          iconRight={!generating ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : undefined}
        >{generating ? "Generating..." : "Generate PDFs"}</ActionButton>
      </div>

      {/* Print styles */}
      <style>{`@media print { body > *:not(#print-area) { display: none; } #print-area { display: block; } }`}</style>
    </div>
  )
}
