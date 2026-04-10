import type { SupportRow } from "@/types/support"

export interface ColumnDef {
  key: string
  label: string
  minWidth: number
  align: "left" | "center"
  type: "text" | "number"
  readOnly?: boolean
  alwaysEditable?: boolean
  getValue: (row: SupportRow) => string
}

export interface CellAddress {
  row: number // _rowIndex
  col: string // column key
}

export interface CellRange {
  start: CellAddress
  end: CellAddress
}

export interface CellFormat {
  bold?: boolean
  italic?: boolean
  textColor?: string
  bgColor?: string
}

export interface ConditionalRule {
  id: string
  column: string
  operator: "gt" | "lt" | "eq" | "neq" | "contains" | "empty" | "notEmpty"
  value: string
  bgColor: string
  textColor: string
}

export interface SortConfig {
  key: string
  direction: "asc" | "desc"
}

export interface HistoryEntry {
  type: "cell" | "rows"
  // cell edit
  rowIndex?: number
  colKey?: string
  oldValue?: string
  newValue?: string
  // rows snapshot for bulk ops
  oldRows?: SupportRow[]
  newRows?: SupportRow[]
  description: string
}

export interface TableState {
  sortConfig: SortConfig | null
  filters: Record<string, string>
  page: number
  pageSize: number
  hiddenColumns: Set<string>
  columnWidths: Record<string, number>
  columnOrder: string[]
  frozenColCount: number
  cellFormats: Record<string, CellFormat>
  conditionalRules: ConditionalRule[]
}

export function cellKey(row: number, col: string): string {
  return `${row}:${col}`
}

export function parseCellKey(key: string): CellAddress {
  const [row, col] = key.split(":")
  return { row: parseInt(row, 10), col }
}

/** Normalize a CellRange so start <= end */
export function normalizeRange(r: CellRange, colKeys: string[]): CellRange {
  const si = colKeys.indexOf(r.start.col)
  const ei = colKeys.indexOf(r.end.col)
  return {
    start: {
      row: Math.min(r.start.row, r.end.row),
      col: colKeys[Math.min(si, ei)],
    },
    end: {
      row: Math.max(r.start.row, r.end.row),
      col: colKeys[Math.max(si, ei)],
    },
  }
}

export function isCellInRange(cell: CellAddress, range: CellRange, colKeys: string[]): boolean {
  const n = normalizeRange(range, colKeys)
  const ci = colKeys.indexOf(cell.col)
  const si = colKeys.indexOf(n.start.col)
  const ei = colKeys.indexOf(n.end.col)
  return cell.row >= n.start.row && cell.row <= n.end.row && ci >= si && ci <= ei
}
