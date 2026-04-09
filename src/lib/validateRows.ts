import type { SupportRow, ValidationResult } from "@/types/support"

/**
 * Fields that MUST have a value to generate PDFs.
 * Only supportTagName and type are truly essential — type is needed
 * for grouping into separate PDFs, supportTagName identifies the row.
 */
const REQUIRED_FIELDS: (keyof SupportRow)[] = [
  "supportTagName",
  "type",
]

/**
 * Fields that are optional but shown as warnings if empty.
 * These appear highlighted in the review table but don't block PDF generation.
 */
const OPTIONAL_WARN_FIELDS: (keyof SupportRow)[] = [
  "discipline",
  "a", "b", "c", "d",
  "item01Name", "item01Qty",
  "item02Name", "item02Qty",
  "item03Name", "item03Qty",
  "x", "y", "z", "xGrid", "yGrid",
]

function calcTotal(row: SupportRow): string {
  const a = parseFloat(row.a) || 0
  const b = parseFloat(row.b) || 0
  const c = parseFloat(row.c) || 0
  const d = parseFloat(row.d) || 0
  const sum = a + b + c + d
  return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
}

export function validateRows(mappedRows: Record<string, unknown>[]): ValidationResult {
  let missingFieldsCount = 0
  let requiredMissingCount = 0
  const types = new Set<string>()

  const rows: SupportRow[] = mappedRows.map((raw, index) => {
    const missingFields: string[] = []

    const row: SupportRow = {
      supportTagName: String(raw["supportTagName"] ?? ""),
      discipline: String(raw["discipline"] ?? ""),
      type: String(raw["type"] ?? ""),
      a: String(raw["a"] ?? ""),
      b: String(raw["b"] ?? ""),
      c: String(raw["c"] ?? ""),
      d: String(raw["d"] ?? ""),
      total: "", // auto-calculated
      item01Name: String(raw["item01Name"] ?? ""),
      item01Qty: String(raw["item01Qty"] ?? ""),
      item02Name: String(raw["item02Name"] ?? ""),
      item02Qty: String(raw["item02Qty"] ?? ""),
      item03Name: String(raw["item03Name"] ?? ""),
      item03Qty: String(raw["item03Qty"] ?? ""),
      x: String(raw["x"] ?? ""),
      y: String(raw["y"] ?? ""),
      z: String(raw["z"] ?? ""),
      xGrid: String(raw["xGrid"] ?? ""),
      yGrid: String(raw["yGrid"] ?? ""),
      remarks: String(raw["remarks"] ?? ""),
      _rowIndex: index,
      _hasErrors: false,
      _missingFields: [],
    }

    // Auto-calculate total = A + B + C + D
    row.total = calcTotal(row)

    // Check required fields (block PDF generation)
    let rowRequiredMissing = 0
    for (const key of REQUIRED_FIELDS) {
      if (row[key] === "" || row[key] === undefined || row[key] === null) {
        missingFields.push(key as string)
        rowRequiredMissing++
      }
    }

    // Check optional fields (show warnings but don't block)
    for (const key of OPTIONAL_WARN_FIELDS) {
      if (row[key] === "" || row[key] === undefined || row[key] === null) {
        missingFields.push(key as string)
      }
    }

    row._missingFields = missingFields
    row._hasErrors = rowRequiredMissing > 0
    missingFieldsCount += missingFields.length
    requiredMissingCount += rowRequiredMissing

    if (row.type) types.add(row.type)

    return row
  })

  return {
    isValid: requiredMissingCount === 0,
    totalRows: rows.length,
    totalTypes: types.size,
    missingFieldsCount,
    requiredMissingCount,
    rows,
  }
}
