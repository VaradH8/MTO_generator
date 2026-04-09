export interface RowItem {
  name: string
  qty: string
}

export interface SupportRow {
  supportTagName: string
  discipline: string
  type: string
  a: string
  b: string
  c: string
  d: string
  total: string
  /** Dynamic items — length matches the configured items for this row's type */
  items: RowItem[]
  x: string
  y: string
  z: string
  xGrid: string
  yGrid: string
  remarks: string
  _rowIndex: number
  _hasErrors: boolean
  _missingFields: string[]
  // Legacy fixed fields kept for compat with validateRows
  item01Name: string
  item01Qty: string
  item02Name: string
  item02Qty: string
  item03Name: string
  item03Qty: string
}

/* ─── Settings / Master Item List ─── */

export interface MasterItem {
  id: string
  name: string   // e.g. "Bracket", "Nut", "Bolt"
}

/** A pre-configured support type in Settings (master template) */
export interface MasterTypeConfig {
  id: string
  typeName: string           // e.g. "L01", "H02", "RF01"
  items: MasterTypeItem[]
}

export interface MasterTypeItem {
  itemId: string
  itemName: string
  qty: string
  make: string
  model: string
}

/* ─── Project Types ─── */

/** An item selected for a support type with qty, make, and model */
export interface TypeItemConfig {
  itemId: string    // references MasterItem.id
  itemName: string  // denormalized for display
  qty: string
  make: string
  model: string
}

export interface SupportTypeConfig {
  typeName: string           // e.g. "L01", "H02", "RF01"
  items: TypeItemConfig[]    // selected items with qty/make/model
}

/** Legacy compat — kept for upload page finalize */
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
  newSupports: number         // first-time supports
  revisions: number           // duplicate supports (counted as revision)
  supportKeys: string[]       // all support tag names in this upload
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
  supportTypes: SupportTypeConfig[]
  uploads: UploadRecord[]
  activityLog: ActivityEntry[]
}

/** A PDF generation that needs admin approval before billing */
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
  /** Count of required fields missing (supportTagName, type) — blocks PDF generation */
  requiredMissingCount: number
  rows: SupportRow[]
}

/* ─── Billing Types ─── */

/** A single batch of supports added to the billing ledger */
export interface BillingEntry {
  id: string
  date: string                // ISO date string
  fileName: string            // Excel file name
  supportCount: number        // number of supports in this batch
  supportKeys: string[]       // unique supportTagNames for dedup
  types: Record<string, number> // { L01: 5, H02: 3 }
}

/** A completed billing cycle — frozen once marked as billed */
export interface BillingCycle {
  id: string
  billedAt: string            // ISO date when marked as billed
  entries: BillingEntry[]
  totalSupports: number
  amountDue: number           // calculated from pricing tiers
}

/** Full billing state persisted to localStorage */
export interface BillingState {
  /** Entries in the current (unbilled) cycle */
  currentEntries: BillingEntry[]
  /** Past billing cycles that have been marked as billed */
  history: BillingCycle[]
}

/** Columns that exist in our schema but were not found in the Excel headers */
export interface ParseResult {
  validation: ValidationResult
  missingColumns: string[]
  detectedHeaders: string[]
  /** True if X, Y, Z columns were not found in Excel — show Datum Point config */
  xyzMissing: boolean
}
