"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import * as XLSX from "xlsx"
import { LENGTH_KEYS } from "@/types/support"
import type { SupportRow, SupportTypeConfig, LengthKey } from "@/types/support"
import type { ColumnDef, CellAddress, CellRange, CellFormat, ConditionalRule, SortConfig, HistoryEntry } from "./table/types"
import { cellKey, isCellInRange, normalizeRange } from "./table/types"
import { useHistory } from "./table/useHistory"
import { ColumnVisibility, FormatToolbar, ConditionalFormatting, ExportButtons } from "./table/Toolbar"
import Pagination from "./table/Pagination"
import ContextMenu from "./table/ContextMenu"
import FindReplace from "./table/FindReplace"

// ── Column definitions ──────────────────────────────────────────────────

const PRE_LENGTH_COLS: ColumnDef[] = [
  { key: "slNo", label: "SL No", minWidth: 60, align: "center", type: "text", getValue: (r) => r.slNo },
  { key: "level", label: "Level", minWidth: 60, align: "center", type: "text", getValue: (r) => r.level },
  { key: "tagNumber", label: "Tag Number", minWidth: 160, align: "left", type: "text", getValue: (r) => r.tagNumber },
  { key: "type", label: "Type", minWidth: 90, align: "left", type: "text", getValue: (r) => r.type },
  { key: "withPlate", label: "With Plate", minWidth: 80, align: "center", type: "number", getValue: (r) => r.withPlate },
  { key: "withoutPlate", label: "Without Plate", minWidth: 90, align: "center", type: "number", getValue: (r) => r.withoutPlate },
]

const LENGTH_COLS: ColumnDef[] = LENGTH_KEYS.map((k) => ({
  key: `lengths.${k}`,
  label: k.toUpperCase(),
  minWidth: 50,
  align: "center" as const,
  type: "number" as const,
  getValue: (r: SupportRow) => r.lengths[k as LengthKey] ?? "",
}))

const TOTAL_COL: ColumnDef = {
  key: "total", label: "Total", minWidth: 70, align: "center", type: "number", readOnly: true,
  getValue: (r) => r.total,
}

const REMARKS_COL: ColumnDef = {
  key: "remarks", label: "Remarks", minWidth: 200, align: "left", type: "text", alwaysEditable: true,
  getValue: (r) => r.remarks,
}

// ── Props ───────────────────────────────────────────────────────────────

interface SupportTableProps {
  rows: SupportRow[]
  typeConfigs?: SupportTypeConfig[]
  onCellEdit?: (rowIndex: number, colKey: string, value: string | number) => void
  onRowsChange?: (rows: SupportRow[]) => void
  disabled?: boolean
  selectedRows?: Set<number>
  onRowSelect?: (rowIndex: number) => void
}

// ── Main Component ──────────────────────────────────────────────────────

export default function SupportTable({ rows, typeConfigs = [], onCellEdit, onRowsChange, disabled = false, selectedRows, onRowSelect }: SupportTableProps) {
  const tableRef = useRef<HTMLDivElement>(null)

  // ─── Core state ─────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null) // null = default
  const [frozenColCount] = useState(1) // freeze first column (Support Tag Name)

  // ─── Cell editing ───────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<CellAddress | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  // ─── Cell formatting ────────────────────────────────────────────────
  const [cellFormats, setCellFormats] = useState<Record<string, CellFormat>>({})
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>([])

  // ─── Multi-cell selection ───────────────────────────────────────────
  const [selAnchor, setSelAnchor] = useState<CellAddress | null>(null)
  const [selFocus, setSelFocus] = useState<CellAddress | null>(null)
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)

  // ─── Autofill ───────────────────────────────────────────────────────
  const [isAutofilling, setIsAutofilling] = useState(false)
  const [autofillTarget, setAutofillTarget] = useState<CellAddress | null>(null)

  // ─── Find / Replace ─────────────────────────────────────────────────
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [replaceText, setReplaceText] = useState("")
  const [showReplace, setShowReplace] = useState(false)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)

  // ─── Context menu ───────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; rowIndex: number } | null>(null)

  // ─── Row drag & drop ────────────────────────────────────────────────
  const [dragRowIdx, setDragRowIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // ─── Column drag & drop ─────────────────────────────────────────────
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null)
  const didDragCol = useRef(false)

  // ─── Column resize ──────────────────────────────────────────────────
  const resizeRef = useRef<{ colKey: string; startX: number; startW: number } | null>(null)

  // ─── History ────────────────────────────────────────────────────────
  const history = useHistory()

  // ── Build columns ─────────────────────────────────────────────────────

  /** One flat column per (itemName, variantLabel?) across all configured types. */
  const itemCols: ColumnDef[] = useMemo(() => {
    const cols: ColumnDef[] = []
    const seen = new Set<string>()
    for (const tc of typeConfigs) {
      for (const item of tc.items) {
        if (item.variants && item.variants.length > 0) {
          for (const v of item.variants) {
            const key = `item:${item.itemName}::${v.label}`
            if (seen.has(key)) continue
            seen.add(key)
            const itemName = item.itemName
            const variantLabel = v.label
            cols.push({
              key,
              label: `${itemName} · ${variantLabel}`,
              minWidth: 80,
              align: "center",
              type: "number",
              getValue: (r: SupportRow) => r.itemQtys?.[itemName]?.[variantLabel] ?? "",
            })
          }
        } else {
          const key = `item:${item.itemName}`
          if (seen.has(key)) continue
          seen.add(key)
          const itemName = item.itemName
          cols.push({
            key,
            label: itemName,
            minWidth: 90,
            align: "center",
            type: "number",
            getValue: (r: SupportRow) => r.itemQtys?.[itemName]?.[""] ?? "",
          })
        }
      }
    }
    return cols
  }, [typeConfigs])

  const baseColumns = useMemo(() => [
    ...PRE_LENGTH_COLS,
    ...LENGTH_COLS,
    TOTAL_COL,
    ...itemCols,
    REMARKS_COL,
  ], [itemCols])

  // Apply column order + visibility
  const visibleColumns = useMemo(() => {
    let ordered = baseColumns
    if (columnOrder) {
      const map = new Map(baseColumns.map((c) => [c.key, c]))
      ordered = columnOrder.filter((k) => map.has(k)).map((k) => map.get(k)!)
      // Add any new columns not in order
      for (const c of baseColumns) {
        if (!columnOrder.includes(c.key)) ordered.push(c)
      }
    }
    return ordered.filter((c) => !hiddenColumns.has(c.key))
  }, [baseColumns, columnOrder, hiddenColumns])

  const colKeys = useMemo(() => visibleColumns.map((c) => c.key), [visibleColumns])

  // ── Filter → Sort → Paginate pipeline ─────────────────────────────────

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== "")
    if (active.length === 0) return rows
    return rows.filter((row) =>
      active.every(([colKey, query]) => {
        const col = visibleColumns.find((c) => c.key === colKey) || baseColumns.find((c) => c.key === colKey)
        if (!col) return true
        return col.getValue(row).toLowerCase().includes(query.trim().toLowerCase())
      })
    )
  }, [rows, filters, visibleColumns, baseColumns])

  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows
    const col = baseColumns.find((c) => c.key === sortConfig.key)
    if (!col) return filteredRows
    const dir = sortConfig.direction === "asc" ? 1 : -1
    return [...filteredRows].sort((a, b) => {
      const va = col.getValue(a)
      const vb = col.getValue(b)
      if (col.type === "number") {
        return (parseFloat(va) - parseFloat(vb)) * dir || 0
      }
      return va.localeCompare(vb) * dir
    })
  }, [filteredRows, sortConfig, baseColumns])

  const paginatedRows = useMemo(() => {
    const start = page * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  // Reset page when filters/sort change
  useEffect(() => { setPage(0) }, [filters, sortConfig])

  // ── Find matches ──────────────────────────────────────────────────────

  const findMatches = useMemo(() => {
    if (!findQuery.trim()) return []
    const q = findQuery.toLowerCase()
    const matches: CellAddress[] = []
    for (const row of sortedRows) {
      for (const col of visibleColumns) {
        if (col.getValue(row).toLowerCase().includes(q)) {
          matches.push({ row: row._rowIndex, col: col.key })
        }
      }
    }
    return matches
  }, [findQuery, sortedRows, visibleColumns])

  // ── Sorting ───────────────────────────────────────────────────────────

  const toggleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null
      }
      return { key, direction: "asc" }
    })
  }, [])

  // ── Cell edit helpers ─────────────────────────────────────────────────

  const startEditing = useCallback((rowIndex: number, colKey: string, currentValue: string) => {
    if (disabled) return
    setEditingCell({ row: rowIndex, col: colKey })
    setEditDraft(currentValue)
  }, [disabled])

  const commitEdit = useCallback(() => {
    if (!editingCell) return
    const trimmed = editDraft.trim()
    const col = baseColumns.find((c) => c.key === editingCell.col)
    const row = rows.find((r) => r._rowIndex === editingCell.row)
    if (col && row) {
      const oldValue = col.getValue(row)
      if (trimmed !== oldValue) {
        history.push({ type: "cell", rowIndex: editingCell.row, colKey: editingCell.col, oldValue, newValue: trimmed, description: `Edit ${editingCell.col}` })
        onCellEdit?.(editingCell.row, editingCell.col, col.type === "number" && trimmed ? parseFloat(trimmed) : trimmed)
      }
    }
    setEditingCell(null)
  }, [editingCell, editDraft, baseColumns, rows, onCellEdit, history])

  const cancelEdit = useCallback(() => { setEditingCell(null) }, [])

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingCell])

  // ── Selection helpers ─────────────────────────────────────────────────

  const selRange = useMemo<CellRange | null>(() => {
    if (!selAnchor || !selFocus) return null
    return { start: selAnchor, end: selFocus }
  }, [selAnchor, selFocus])

  const isCellSelected = useCallback((rowIndex: number, colKey: string) => {
    if (!selRange) return false
    return isCellInRange({ row: rowIndex, col: colKey }, selRange, colKeys)
  }, [selRange, colKeys])

  const selectedCellAddresses = useMemo(() => {
    if (!selRange) return []
    const n = normalizeRange(selRange, colKeys)
    const si = colKeys.indexOf(n.start.col)
    const ei = colKeys.indexOf(n.end.col)
    const cells: CellAddress[] = []
    for (const row of paginatedRows) {
      if (row._rowIndex >= n.start.row && row._rowIndex <= n.end.row) {
        for (let ci = si; ci <= ei; ci++) {
          cells.push({ row: row._rowIndex, col: colKeys[ci] })
        }
      }
    }
    return cells
  }, [selRange, colKeys, paginatedRows])

  // ── Copy / Paste ──────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (!selRange) return
    const n = normalizeRange(selRange, colKeys)
    const si = colKeys.indexOf(n.start.col)
    const ei = colKeys.indexOf(n.end.col)
    const lines: string[] = []
    for (const row of sortedRows) {
      if (row._rowIndex >= n.start.row && row._rowIndex <= n.end.row) {
        const cells: string[] = []
        for (let ci = si; ci <= ei; ci++) {
          const col = visibleColumns.find((c) => c.key === colKeys[ci])
          cells.push(col ? col.getValue(row) : "")
        }
        lines.push(cells.join("\t"))
      }
    }
    navigator.clipboard.writeText(lines.join("\n"))
  }, [selRange, colKeys, sortedRows, visibleColumns])

  const handlePaste = useCallback(async () => {
    if (!selAnchor || !onCellEdit) return
    try {
      const text = await navigator.clipboard.readText()
      const lines = text.split("\n").map((l) => l.split("\t"))
      const startCI = colKeys.indexOf(selAnchor.col)
      if (startCI === -1) return
      let rowI = sortedRows.findIndex((r) => r._rowIndex === selAnchor.row)
      if (rowI === -1) return
      for (const cells of lines) {
        if (rowI >= sortedRows.length) break
        const row = sortedRows[rowI]
        for (let ci = 0; ci < cells.length; ci++) {
          const colIdx = startCI + ci
          if (colIdx >= colKeys.length) break
          const col = visibleColumns.find((c) => c.key === colKeys[colIdx])
          if (col && !col.readOnly) {
            onCellEdit(row._rowIndex, colKeys[colIdx], cells[ci].trim())
          }
        }
        rowI++
      }
    } catch { /* clipboard access denied */ }
  }, [selAnchor, colKeys, sortedRows, visibleColumns, onCellEdit])

  // ── Undo / Redo ───────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    const entry = history.undo()
    if (!entry) return
    if (entry.type === "cell" && entry.rowIndex != null && entry.colKey && entry.oldValue != null) {
      onCellEdit?.(entry.rowIndex, entry.colKey, entry.oldValue)
    } else if (entry.type === "rows" && entry.oldRows) {
      onRowsChange?.(entry.oldRows)
    }
  }, [history, onCellEdit, onRowsChange])

  const handleRedo = useCallback(() => {
    const entry = history.redo()
    if (!entry) return
    if (entry.type === "cell" && entry.rowIndex != null && entry.colKey && entry.newValue != null) {
      onCellEdit?.(entry.rowIndex, entry.colKey, entry.newValue)
    } else if (entry.type === "rows" && entry.newRows) {
      onRowsChange?.(entry.newRows)
    }
  }, [history, onCellEdit, onRowsChange])

  // ── Find / Replace actions ────────────────────────────────────────────

  const findNext = useCallback(() => {
    if (findMatches.length === 0) return
    setCurrentMatchIdx((prev) => (prev + 1) % findMatches.length)
  }, [findMatches])

  const findPrev = useCallback(() => {
    if (findMatches.length === 0) return
    setCurrentMatchIdx((prev) => (prev - 1 + findMatches.length) % findMatches.length)
  }, [findMatches])

  const replaceCurrent = useCallback(() => {
    if (findMatches.length === 0 || !onCellEdit) return
    const match = findMatches[currentMatchIdx]
    const col = baseColumns.find((c) => c.key === match.col)
    const row = rows.find((r) => r._rowIndex === match.row)
    if (!col || !row || col.readOnly) return
    const oldVal = col.getValue(row)
    const newVal = oldVal.replace(new RegExp(findQuery, "i"), replaceText)
    history.push({ type: "cell", rowIndex: match.row, colKey: match.col, oldValue: oldVal, newValue: newVal, description: "Replace" })
    onCellEdit(match.row, match.col, newVal)
  }, [findMatches, currentMatchIdx, findQuery, replaceText, baseColumns, rows, onCellEdit, history])

  const replaceAll = useCallback(() => {
    if (findMatches.length === 0 || !onCellEdit) return
    for (const match of findMatches) {
      const col = baseColumns.find((c) => c.key === match.col)
      const row = rows.find((r) => r._rowIndex === match.row)
      if (!col || !row || col.readOnly) continue
      const oldVal = col.getValue(row)
      const newVal = oldVal.replace(new RegExp(findQuery, "gi"), replaceText)
      onCellEdit(match.row, match.col, newVal)
    }
    history.push({ type: "cell", description: `Replace all "${findQuery}" → "${replaceText}"` })
  }, [findMatches, findQuery, replaceText, baseColumns, rows, onCellEdit, history])

  // ── Autofill ──────────────────────────────────────────────────────────

  const commitAutofill = useCallback(() => {
    if (!selAnchor || !autofillTarget || !onCellEdit) return
    const srcRow = rows.find((r) => r._rowIndex === selAnchor.row)
    const col = baseColumns.find((c) => c.key === selAnchor.col)
    if (!srcRow || !col) return
    const value = col.getValue(srcRow)
    const minR = Math.min(selAnchor.row, autofillTarget.row)
    const maxR = Math.max(selAnchor.row, autofillTarget.row)
    for (const row of sortedRows) {
      if (row._rowIndex >= minR && row._rowIndex <= maxR && row._rowIndex !== selAnchor.row) {
        onCellEdit(row._rowIndex, selAnchor.col, value)
      }
    }
    setIsAutofilling(false)
    setAutofillTarget(null)
    setSelFocus(autofillTarget)
  }, [selAnchor, autofillTarget, onCellEdit, rows, sortedRows, baseColumns])

  // ── Row operations (context menu) ─────────────────────────────────────

  const insertRow = useCallback((afterIndex: number) => {
    if (!onRowsChange) return
    const empty: SupportRow = {
      slNo: "", level: "", tagNumber: "", type: "", withPlate: "", withoutPlate: "",
      lengths: {}, total: "0", itemQtys: {}, remarks: "",
      _rowIndex: Date.now(), _hasErrors: true, _missingFields: ["tagNumber", "type"],
    }
    const idx = rows.findIndex((r) => r._rowIndex === afterIndex)
    const newRows = [...rows]
    newRows.splice(idx + 1, 0, empty)
    history.push({ type: "rows", oldRows: rows, newRows, description: "Insert row" })
    onRowsChange(newRows)
  }, [rows, onRowsChange, history])

  const deleteRows = useCallback((indices: Set<number>) => {
    if (!onRowsChange || indices.size === 0) return
    const newRows = rows.filter((r) => !indices.has(r._rowIndex))
    history.push({ type: "rows", oldRows: rows, newRows, description: `Delete ${indices.size} row(s)` })
    onRowsChange(newRows)
  }, [rows, onRowsChange, history])

  const duplicateRow = useCallback((rowIndex: number) => {
    if (!onRowsChange) return
    const src = rows.find((r) => r._rowIndex === rowIndex)
    if (!src) return
    const dup: SupportRow = {
      ...src,
      _rowIndex: Date.now(),
      lengths: { ...src.lengths },
      itemQtys: Object.fromEntries(Object.entries(src.itemQtys).map(([k, v]) => [k, { ...v }])),
    }
    const idx = rows.findIndex((r) => r._rowIndex === rowIndex)
    const newRows = [...rows]
    newRows.splice(idx + 1, 0, dup)
    history.push({ type: "rows", oldRows: rows, newRows, description: "Duplicate row" })
    onRowsChange(newRows)
  }, [rows, onRowsChange, history])

  // ── Row drag & drop reorder ───────────────────────────────────────────

  const handleRowDrop = useCallback((fromRowIndex: number, toRowIndex: number) => {
    if (!onRowsChange || fromRowIndex === toRowIndex) return
    const newRows = [...rows]
    const fromIdx = newRows.findIndex((r) => r._rowIndex === fromRowIndex)
    const toIdx = newRows.findIndex((r) => r._rowIndex === toRowIndex)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = newRows.splice(fromIdx, 1)
    newRows.splice(toIdx, 0, moved)
    history.push({ type: "rows", oldRows: rows, newRows, description: "Reorder row" })
    onRowsChange(newRows)
  }, [rows, onRowsChange, history])

  // ── Column drag & drop reorder ────────────────────────────────────────

  const handleColDrop = useCallback((fromKey: string, toKey: string) => {
    if (fromKey === toKey) return
    const keys = columnOrder || baseColumns.map((c) => c.key)
    const newOrder = [...keys]
    const fromI = newOrder.indexOf(fromKey)
    const toI = newOrder.indexOf(toKey)
    if (fromI === -1 || toI === -1) return
    newOrder.splice(fromI, 1)
    newOrder.splice(toI, 0, fromKey)
    setColumnOrder(newOrder)
  }, [columnOrder, baseColumns])

  // ── Column resize handlers ────────────────────────────────────────────

  const onResizeStart = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const col = visibleColumns.find((c) => c.key === colKey)
    const startW = columnWidths[colKey] || col?.minWidth || 80
    resizeRef.current = { colKey, startX: e.clientX, startW }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const diff = ev.clientX - resizeRef.current.startX
      const newW = Math.max(40, resizeRef.current.startW + diff)
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.colKey]: newW }))
    }
    const onUp = () => {
      resizeRef.current = null
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [visibleColumns, columnWidths])

  // ── Format helpers ────────────────────────────────────────────────────

  const applyFormat = useCallback((fmt: Partial<CellFormat>) => {
    if (selectedCellAddresses.length === 0) return
    setCellFormats((prev) => {
      const next = { ...prev }
      for (const addr of selectedCellAddresses) {
        const key = cellKey(addr.row, addr.col)
        const existing = next[key] || {}
        // Toggle bold/italic
        if (fmt.bold !== undefined) fmt = { ...fmt, bold: !existing.bold }
        if (fmt.italic !== undefined) fmt = { ...fmt, italic: !existing.italic }
        next[key] = { ...existing, ...fmt }
      }
      return next
    })
  }, [selectedCellAddresses])

  const getCellStyle = useCallback((rowIndex: number, colKey: string, col: ColumnDef, row: SupportRow): React.CSSProperties => {
    const fmt = cellFormats[cellKey(rowIndex, colKey)]
    const style: React.CSSProperties = {}
    if (fmt?.bold) style.fontWeight = 700
    if (fmt?.italic) style.fontStyle = "italic"
    if (fmt?.textColor) style.color = fmt.textColor
    if (fmt?.bgColor) style.background = fmt.bgColor

    // Conditional formatting
    for (const rule of conditionalRules) {
      if (rule.column !== colKey) continue
      const val = col.getValue(row)
      const numVal = parseFloat(val)
      const ruleNum = parseFloat(rule.value)
      let match = false
      switch (rule.operator) {
        case "gt": match = !isNaN(numVal) && !isNaN(ruleNum) && numVal > ruleNum; break
        case "lt": match = !isNaN(numVal) && !isNaN(ruleNum) && numVal < ruleNum; break
        case "eq": match = val === rule.value; break
        case "neq": match = val !== rule.value; break
        case "contains": match = val.toLowerCase().includes(rule.value.toLowerCase()); break
        case "empty": match = val.trim() === ""; break
        case "notEmpty": match = val.trim() !== ""; break
      }
      if (match) {
        if (rule.bgColor) style.background = rule.bgColor
        if (rule.textColor) style.color = rule.textColor
      }
    }

    // Data validation — red if number column has non-number
    if (col.type === "number") {
      const val = col.getValue(row)
      if (val.trim() !== "" && isNaN(parseFloat(val))) {
        style.background = "#fed7d7"
        style.border = "1px solid #e53e3e"
      }
    }

    return style
  }, [cellFormats, conditionalRules])

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Find
      if (ctrl && e.key === "f") { e.preventDefault(); setFindOpen(true); setShowReplace(false) }
      // Find & Replace
      if (ctrl && e.key === "h") { e.preventDefault(); setFindOpen(true); setShowReplace(true) }
      // Copy
      if (ctrl && e.key === "c" && selRange && !editingCell) { e.preventDefault(); handleCopy() }
      // Paste
      if (ctrl && e.key === "v" && !editingCell) { e.preventDefault(); handlePaste() }
      // Undo
      if (ctrl && e.key === "z" && !e.shiftKey && !editingCell) { e.preventDefault(); handleUndo() }
      // Redo
      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey)) && !editingCell) { e.preventDefault(); handleRedo() }
      // Escape closes find
      if (e.key === "Escape" && findOpen) { setFindOpen(false) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selRange, editingCell, findOpen, handleCopy, handlePaste, handleUndo, handleRedo])

  // ── Selection mouse handlers ──────────────────────────────────────────

  useEffect(() => {
    if (!isDraggingSelection && !isAutofilling) return
    const onMove = (e: MouseEvent) => {
      const td = (e.target as HTMLElement).closest("td[data-addr]") as HTMLElement | null
      if (!td) return
      const row = Number(td.dataset.row)
      const col = td.dataset.col!
      if (isAutofilling) {
        setAutofillTarget({ row, col })
      } else {
        setSelFocus({ row, col })
      }
    }
    const onUp = () => {
      if (isAutofilling) commitAutofill()
      setIsDraggingSelection(false)
      setIsAutofilling(false)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
  }, [isDraggingSelection, isAutofilling, commitAutofill])

  // ── Export ────────────────────────────────────────────────────────────

  const buildExportData = useCallback(() => {
    return sortedRows.map((row) => {
      const obj: Record<string, string> = {}
      for (const col of visibleColumns) obj[col.label] = col.getValue(row)
      return obj
    })
  }, [sortedRows, visibleColumns])

  const exportCSV = useCallback(() => {
    const ws = XLSX.utils.json_to_sheet(buildExportData())
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "table-export.csv"; a.click()
  }, [buildExportData])

  const exportXLSX = useCallback(() => {
    const ws = XLSX.utils.json_to_sheet(buildExportData())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Data")
    XLSX.writeFile(wb, "table-export.xlsx")
  }, [buildExportData])

  // ── Frozen column offsets ─────────────────────────────────────────────

  const frozenLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    let acc = onRowSelect ? 32 : 0
    for (let i = 0; i < frozenColCount && i < visibleColumns.length; i++) {
      const col = visibleColumns[i]
      offsets[col.key] = acc
      acc += columnWidths[col.key] || col.minWidth
    }
    return offsets
  }, [visibleColumns, frozenColCount, columnWidths, onRowSelect])

  // ── Find match highlight check ────────────────────────────────────────

  const currentMatch = findMatches[currentMatchIdx] || null

  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== "")

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap",
        padding: "var(--space-2) var(--space-3)",
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        borderBottom: "none",
      }}>
        <FormatToolbar hasSelection={selectedCellAddresses.length > 0} onApplyFormat={applyFormat} />
        <div style={{ width: 1, height: 20, background: "var(--color-border)" }} />
        <ColumnVisibility columns={baseColumns} hidden={hiddenColumns} onToggle={(k) => setHiddenColumns((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })} />
        <ConditionalFormatting rules={conditionalRules} columns={baseColumns} onUpdate={setConditionalRules} />
        <div style={{ width: 1, height: 20, background: "var(--color-border)" }} />
        <ExportButtons onExportCSV={exportCSV} onExportXLSX={exportXLSX} />
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-faint)" }}>
          {history.canUndo && "Ctrl+Z undo"} {history.canRedo && "· Ctrl+Y redo"} · Ctrl+F find
        </span>
      </div>

      {/* ── Find/Replace bar ── */}
      {findOpen && (
        <FindReplace
          query={findQuery}
          replaceText={replaceText}
          showReplace={showReplace}
          matchCount={findMatches.length}
          currentIndex={currentMatchIdx}
          onQueryChange={(q) => { setFindQuery(q); setCurrentMatchIdx(0) }}
          onReplaceChange={setReplaceText}
          onNext={findNext}
          onPrev={findPrev}
          onReplaceCurrent={replaceCurrent}
          onReplaceAll={replaceAll}
          onClose={() => setFindOpen(false)}
          onToggleReplace={() => setShowReplace((p) => !p)}
        />
      )}

      {/* ── Table ── */}
      <div
        ref={tableRef}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderTop: findOpen ? "none" : undefined,
          borderRadius: findOpen ? 0 : "0",
          boxShadow: "var(--shadow-md)",
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "70vh",
          opacity: disabled ? 0.7 : 1,
          pointerEvents: disabled ? "none" : undefined,
          position: "relative",
          userSelect: isDraggingSelection || isAutofilling ? "none" : undefined,
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            {/* ── Header row ── */}
            <tr>
              {onRowSelect && (
                <th style={{ ...stickyHeaderStyle, width: 32, left: 0, zIndex: 3 }}>
                  <input
                    type="checkbox"
                    checked={selectedRows ? selectedRows.size === paginatedRows.length && paginatedRows.length > 0 : false}
                    onChange={() => {
                      if (!onRowSelect) return
                      const allSelected = selectedRows?.size === paginatedRows.length
                      for (const r of paginatedRows) {
                        if (allSelected || !selectedRows?.has(r._rowIndex)) onRowSelect(r._rowIndex)
                      }
                    }}
                    style={{ accentColor: "var(--color-primary)" }}
                  />
                </th>
              )}
              {/* Row drag handle header */}
              {onRowsChange && <th style={{ ...stickyHeaderStyle, width: 24, zIndex: 2 }} />}
              {visibleColumns.map((col, colIdx) => {
                const isFrozen = colIdx < frozenColCount
                const width = columnWidths[col.key] || col.minWidth
                return (
                  <th
                    key={col.key}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", col.key); setDragColKey(col.key); didDragCol.current = false }}
                    onDrag={() => { didDragCol.current = true }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverColKey(col.key) }}
                    onDragLeave={() => setDragOverColKey(null)}
                    onDrop={(e) => { e.preventDefault(); if (dragColKey) handleColDrop(dragColKey, col.key); setDragColKey(null); setDragOverColKey(null) }}
                    onDragEnd={() => { setDragColKey(null); setDragOverColKey(null) }}
                    onClick={() => { if (!didDragCol.current) toggleSort(col.key) }}
                    style={{
                      ...stickyHeaderStyle,
                      width,
                      minWidth: width,
                      cursor: "pointer",
                      position: "sticky",
                      top: 0,
                      left: isFrozen ? frozenLeftOffsets[col.key] ?? undefined : undefined,
                      zIndex: isFrozen ? 3 : 2,
                      borderLeft: dragOverColKey === col.key ? "2px solid var(--color-primary)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{col.label}</span>
                      {sortConfig?.key === col.key && (
                        <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => onResizeStart(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute", top: 0, right: 0, bottom: 0, width: 5,
                        cursor: "col-resize", background: "transparent",
                      }}
                    />
                  </th>
                )
              })}
            </tr>
            {/* ── Filter row ── */}
            <tr>
              {onRowSelect && <th style={{ ...filterRowStyle, left: 0, zIndex: 3 }} />}
              {onRowsChange && <th style={filterRowStyle} />}
              {visibleColumns.map((col, colIdx) => {
                const isFrozen = colIdx < frozenColCount
                return (
                  <th key={`f-${col.key}`} style={{ ...filterRowStyle, left: isFrozen ? frozenLeftOffsets[col.key] ?? undefined : undefined, zIndex: isFrozen ? 3 : 2 }}>
                    <input
                      type="text"
                      value={filters[col.key] || ""}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                      placeholder="Filter"
                      style={{
                        width: "100%", height: 22, padding: "0 4px",
                        fontFamily: "var(--font-body)", fontSize: "0.625rem",
                        color: "var(--color-text)",
                        background: filters[col.key] ? "var(--color-primary-soft)" : "var(--color-surface-2)",
                        border: filters[col.key] ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                        borderRadius: 3, outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {/* Filter info bar */}
            {hasActiveFilters && (
              <tr>
                <td
                  colSpan={visibleColumns.length + (onRowSelect ? 1 : 0) + (onRowsChange ? 1 : 0)}
                  style={{ padding: "2px 8px", fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", background: "var(--color-primary-soft)", borderBottom: "1px solid var(--color-border)" }}
                >
                  {sortedRows.length} of {rows.length} rows
                  <button onClick={() => setFilters({})} style={{ marginLeft: 8, fontFamily: "var(--font-display)", fontSize: "0.625rem", fontWeight: 600, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear filters</button>
                </td>
              </tr>
            )}

            {/* ── Data rows ── */}
            {paginatedRows.map((row, rowIdx) => {
              const isWarning = row._hasErrors
              const isRowDragging = dragRowIdx === row._rowIndex
              const isRowDragOver = dragOverIdx === row._rowIndex

              return (
                <tr
                  key={row._rowIndex}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, rowIndex: row._rowIndex }) }}
                  onDragOver={(e) => {
                    if (dragRowIdx === null) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setDragOverIdx(row._rowIndex)
                  }}
                  onDragLeave={(e) => {
                    // Only clear if leaving the row, not entering a child
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                      setDragOverIdx(null)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragRowIdx !== null) handleRowDrop(dragRowIdx, row._rowIndex)
                    setDragRowIdx(null)
                    setDragOverIdx(null)
                  }}
                  style={{
                    background: isWarning ? "var(--color-warning-soft)" : rowIdx % 2 === 1 ? "var(--color-surface-2)" : undefined,
                    borderLeft: isWarning ? "3px solid var(--color-warning)" : undefined,
                    opacity: isRowDragging ? 0.4 : 1,
                    borderTop: isRowDragOver ? "2px solid var(--color-primary)" : undefined,
                  }}
                >
                  {/* Row checkbox */}
                  {onRowSelect && (
                    <td style={{ padding: "2px", verticalAlign: "middle", borderBottom: "1px solid var(--color-border)", position: "sticky", left: 0, background: isWarning ? "var(--color-warning-soft)" : rowIdx % 2 === 1 ? "var(--color-surface-2)" : "var(--color-surface)", zIndex: 1 }}>
                      <input type="checkbox" checked={selectedRows?.has(row._rowIndex) || false} onChange={() => onRowSelect(row._rowIndex)} style={{ accentColor: "var(--color-primary)" }} />
                    </td>
                  )}
                  {/* Row drag handle */}
                  {onRowsChange && (
                    <td
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move"
                        e.dataTransfer.setData("text/plain", String(row._rowIndex))
                        setDragRowIdx(row._rowIndex)
                      }}
                      onDragEnd={() => { setDragRowIdx(null); setDragOverIdx(null) }}
                      style={{ padding: "2px 4px", verticalAlign: "middle", borderBottom: "1px solid var(--color-border)", cursor: "grab", color: "var(--color-text-faint)", fontSize: "0.75rem", textAlign: "center", userSelect: "none", background: isWarning ? "var(--color-warning-soft)" : rowIdx % 2 === 1 ? "var(--color-surface-2)" : "var(--color-surface)" }}
                    >
                      ⠿
                    </td>
                  )}
                  {/* Data cells */}
                  {visibleColumns.map((col, colIdx) => {
                    const cellValue = col.getValue(row)
                    const isMissing = !col.readOnly && row._missingFields.includes(col.key)
                    const isEditable = col.alwaysEditable && !col.readOnly
                    const isEditing = editingCell?.row === row._rowIndex && editingCell?.col === col.key
                    const isSel = isCellSelected(row._rowIndex, col.key)
                    const isFrozen = colIdx < frozenColCount
                    const isFindMatch = findQuery && col.getValue(row).toLowerCase().includes(findQuery.toLowerCase())
                    const isCurrentMatch = currentMatch?.row === row._rowIndex && currentMatch?.col === col.key

                    // Autofill range highlight
                    const inAutofill = isAutofilling && autofillTarget && selAnchor &&
                      col.key === selAnchor.col &&
                      row._rowIndex >= Math.min(selAnchor.row, autofillTarget.row) &&
                      row._rowIndex <= Math.max(selAnchor.row, autofillTarget.row)

                    const customStyle = getCellStyle(row._rowIndex, col.key, col, row)

                    return (
                      <td
                        key={col.key}
                        data-addr="1"
                        data-row={row._rowIndex}
                        data-col={col.key}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return
                          if (isEditing) return
                          if (dragRowIdx !== null) return
                          if (e.shiftKey) {
                            setSelFocus({ row: row._rowIndex, col: col.key })
                          } else {
                            setSelAnchor({ row: row._rowIndex, col: col.key })
                            setSelFocus({ row: row._rowIndex, col: col.key })
                            setIsDraggingSelection(true)
                          }
                        }}
                        onDoubleClick={() => {
                          if (!col.readOnly) startEditing(row._rowIndex, col.key, cellValue)
                        }}
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "0.8125rem",
                          color: col.readOnly ? "var(--color-text-muted)" : "var(--color-text)",
                          padding: "2px 6px",
                          borderBottom: "1px solid var(--color-border)",
                          whiteSpace: "nowrap",
                          verticalAlign: "middle",
                          textAlign: col.align,
                          position: isFrozen ? "sticky" : undefined,
                          left: isFrozen ? frozenLeftOffsets[col.key] ?? undefined : undefined,
                          zIndex: isFrozen ? 1 : undefined,
                          background: isCurrentMatch
                            ? "#fbd38d"
                            : isFindMatch
                            ? "#fefcbf"
                            : isSel
                            ? "var(--color-primary-soft)"
                            : inAutofill
                            ? (isFrozen ? "#e2ecf6" : "rgba(49, 130, 206, 0.12)")
                            : col.readOnly
                            ? "var(--color-surface-offset)"
                            : isMissing
                            ? (isFrozen ? "#e8dcc0" : "rgba(154, 100, 0, 0.18)")
                            : isEditable
                            ? "var(--color-primary-soft)"
                            : customStyle.background || (rowIdx % 2 === 1 ? "var(--color-surface-2)" : "var(--color-surface)"),
                          outline: isSel ? "2px solid var(--color-primary)" : isMissing ? "1px dashed var(--color-warning)" : undefined,
                          outlineOffset: isSel ? -2 : undefined,
                          fontWeight: customStyle.fontWeight || (col.readOnly ? 600 : undefined),
                          fontStyle: customStyle.fontStyle as React.CSSProperties["fontStyle"],
                          ...(!isSel && !isFindMatch && !isCurrentMatch && !isMissing && !col.readOnly && !isEditable ? customStyle : {}),
                          cursor: col.readOnly ? "default" : "cell",
                        }}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit()
                              if (e.key === "Escape") cancelEdit()
                              if (e.key === "Tab") { e.preventDefault(); commitEdit() }
                            }}
                            style={{
                              width: "100%", fontFamily: "var(--font-body)", fontSize: "0.8125rem",
                              padding: "1px 4px", border: "2px solid var(--color-primary)",
                              borderRadius: 2, background: "var(--color-surface)",
                              outline: "none", color: "var(--color-text)",
                            }}
                          />
                        ) : (
                          <span style={{ display: "block", position: "relative" }}>
                            {cellValue || (isMissing ? "—" : "")}
                            {/* Autofill handle on the anchor cell */}
                            {isSel && selAnchor?.row === row._rowIndex && selAnchor?.col === col.key && selAnchor.row === selFocus?.row && selAnchor.col === selFocus?.col && (
                              <span
                                onMouseDown={(e) => { e.stopPropagation(); setIsAutofilling(true) }}
                                style={{
                                  position: "absolute", bottom: -3, right: -3,
                                  width: 7, height: 7,
                                  background: "var(--color-primary)", border: "1px solid #fff",
                                  cursor: "crosshair",
                                }}
                              />
                            )}
                          </span>
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

      {/* ── Pagination ── */}
      <div style={{ border: "1px solid var(--color-border)", borderTop: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", padding: "0 var(--space-3)", background: "var(--color-surface)" }}>
        <Pagination total={sortedRows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onInsertAbove={() => insertRow(ctxMenu.rowIndex - 1)}
          onInsertBelow={() => insertRow(ctxMenu.rowIndex)}
          onDeleteRows={() => {
            const toDelete = selectedRows && selectedRows.size > 0 ? selectedRows : new Set([ctxMenu.rowIndex])
            deleteRows(toDelete)
          }}
          onDuplicateRow={() => duplicateRow(ctxMenu.rowIndex)}
          selectedCount={selectedRows?.size || 1}
        />
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────

const stickyHeaderStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  fontFamily: "var(--font-display)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  color: "var(--color-text-muted)",
  padding: "6px 8px",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 2,
  textAlign: "left",
}

const filterRowStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "2px 4px",
  borderBottom: "1px solid var(--color-border)",
  position: "sticky",
  top: 34,
  zIndex: 2,
}
