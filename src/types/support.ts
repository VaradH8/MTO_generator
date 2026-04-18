/** Length column keys a..p (16 max, matching the output schedule A..P) */
export const LENGTH_KEYS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p"] as const
export type LengthKey = typeof LENGTH_KEYS[number]

export interface ItemVariant {
  /** Display label, e.g. "2(50,50)" or "(100,50)" */
  label: string
  qty: string
}

export interface SupportRow {
  siNo: string
  level: string
  tagNumber: string
  type: string
  withPlate: string
  withoutPlate: string
  /** Partial map of length columns a..p → string values */
  lengths: Partial<Record<LengthKey, string>>
  total: string
  /**
   * Quantities for items belonging to this row's type.
   * Shape: { [itemName]: { "": qty } | { [variantLabel]: qty, ... } }
   * Single-qty items use the empty-string key. Items with variants store
   * one entry per variant label.
   */
  itemQtys: Record<string, Record<string, string>>
  remarks: string
  _rowIndex: number
  _hasErrors: boolean
  _missingFields: string[]
}

/* ─── Settings / Master Item List ─── */

export interface MasterItem {
  id: string
  name: string
}

export interface MasterTypeConfig {
  id: string
  typeName: string
  items: MasterTypeItem[]
}

export interface MasterTypeItem {
  itemId: string
  itemName: string
  /** Used when `variants` is empty. Ignored when `variants` has entries. */
  qty: string
  make: string
  model: string
  /** Optional size variants. When present, the item spans N output sub-columns. */
  variants?: ItemVariant[]
}

/* ─── Project Types ─── */

export interface TypeItemConfig {
  itemId: string
  itemName: string
  qty: string
  make: string
  model: string
  variants?: ItemVariant[]
}

export interface SupportTypeConfig {
  typeName: string
  items: TypeItemConfig[]
}

export interface ItemConfig {
  name: string
  qty: string
}

export interface UploadRecord {
  id: string
  fileName: string
  uploadedAt: string
  rowCount: number
  types: string[]
  newSupports: number
  revisions: number
  supportKeys: string[]
  classification: "internal" | "external"
}

export interface ActivityEntry {
  id: string
  timestamp: string
  user: string
  action: "upload" | "approve" | "reject" | "bill" | "config" | "create"
  detail: string
}

export interface Project {
  id: string
  clientName: string
  createdBy: string
  createdAt: string
  supportRange: number
  supportTypes: SupportTypeConfig[]
  uploads: UploadRecord[]
  activityLog: ActivityEntry[]
}

export interface PdfApproval {
  id: string
  projectId: string
  projectName: string
  generatedBy: string
  generatedAt: string
  supportCount: number
  types: Record<string, number>
  supportKeys: string[]
  status: "pending" | "approved" | "rejected"
  reviewedBy?: string
  reviewedAt?: string
}

export interface GroupedSupports {
  [type: string]: SupportRow[]
}

export interface ValidationResult {
  isValid: boolean
  totalRows: number
  totalTypes: number
  missingFieldsCount: number
  /** Count of required fields missing (tagNumber, type) — blocks PDF generation */
  requiredMissingCount: number
  rows: SupportRow[]
}

/* ─── Billing Types ─── */

export interface BillingEntry {
  id: string
  date: string
  fileName: string
  supportCount: number
  supportKeys: string[]
  types: Record<string, number>
}

export interface BillingCycle {
  id: string
  billedAt: string
  entries: BillingEntry[]
  totalSupports: number
  amountDue: number
}

export interface BillingState {
  currentEntries: BillingEntry[]
  history: BillingCycle[]
}

export interface ParseResult {
  validation: ValidationResult
  missingColumns: string[]
  detectedHeaders: string[]
}
