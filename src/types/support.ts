/** Length column keys a..p (16 max, matching the output schedule A..P) */
export const LENGTH_KEYS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p"] as const
export type LengthKey = typeof LENGTH_KEYS[number]

export interface ItemVariant {
  /** Display label, e.g. "2(50,50)" or "(100,50)" */
  label: string
  qty: string
  /** Optional per-variant make. Falls back to parent item's make if empty. */
  make?: string
  /** Optional per-variant model. Falls back to parent item's model if empty. */
  model?: string
}

export interface SupportRow {
  slNo: string
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
  /** Free-text per-row material (e.g. "MS", "SS304") — rendered as its own
   *  column right after Type in both the on-screen table and the PDF. */
  material?: string
  remarks: string
  /**
   * Classification the upload was submitted under. Used to disambiguate
   * when the same type name exists in both internal and external project
   * configs — the PDF filter reads this tag to include only the matching
   * rows. Optional for backwards compatibility with rows written before
   * this field existed.
   */
  classification?: "internal" | "external"
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
  classification: "internal" | "external"
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
  /** When true, every PDF row for a type using this item shows "Yes" in the
   *  per-item "With Plate" sub-column (blank otherwise). */
  withPlate?: boolean
  /** Same as withPlate but for the "Without Plate" sub-column. */
  withoutPlate?: boolean
}

/* ─── Project Types ─── */

export interface TypeItemConfig {
  itemId: string
  itemName: string
  qty: string
  make: string
  model: string
  variants?: ItemVariant[]
  /** Project-level mirror of MasterTypeItem.withPlate — drives the per-item
   *  "With Plate" PDF sub-column for every row of this type. */
  withPlate?: boolean
  withoutPlate?: boolean
}

export interface SupportTypeConfig {
  typeName: string
  classification: "internal" | "external"
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

/** Per-type column-mapping rule: which input columns (length keys) must have
 *  values, and which length keys (with what multiplier) feed into the row's
 *  TOTAL. Cells marked `A_0` count A with factor 1; `A_2` counts A×2; plain
 *  `A` is legacy and means "required for validation only, NOT in total".
 *  Length keys absent from `factors` contribute nothing to the total. */
export interface TypeMapping {
  /** Required input length keys lowercased (e.g., ["a","b","c"]) — empty cells are flagged red. */
  required: string[]
  /** Length-key → multiplier (a..p). Only entries here drive the total. */
  factors: Partial<Record<LengthKey, number>>
  /** Whether the mapping row contained explicit "MISSING" markers */
  hasMissing: boolean
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
  /** Column-mapping rules keyed by type name, uploaded from Mapping.xlsx */
  mapping?: Record<string, TypeMapping>
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
