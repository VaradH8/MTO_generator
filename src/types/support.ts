export interface SupportRow {
  supportTagName: string
  discipline: string
  type: string
  a: string
  b: string
  c: string
  d: string
  total: string
  item01Name: string
  item01Qty: string
  item02Name: string
  item02Qty: string
  item03Name: string
  item03Qty: string
  x: string
  y: string
  z: string
  xGrid: string
  yGrid: string
  remarks: string
  _rowIndex: number
  _hasErrors: boolean
  _missingFields: string[]
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
