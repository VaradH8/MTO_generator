import { LENGTH_KEYS } from "@/types/support"
import type { SupportRow, ValidationResult, LengthKey } from "@/types/support"

const REQUIRED_FIELDS = ["tagNumber", "type"] as const

const OPTIONAL_WARN_FIELDS = [
  "level", "withPlate", "withoutPlate",
  ...LENGTH_KEYS.map((k) => `lengths.${k}`),
]

function calcTotal(lengths: Partial<Record<LengthKey, string>>): string {
  let sum = 0
  for (const k of LENGTH_KEYS) {
    const v = lengths[k]
    if (v != null && v !== "") sum += parseFloat(v) || 0
  }
  return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
}

/** Reads a value from the raw mapped object using a key like "lengths.a" or "tagNumber". */
function readField(raw: Record<string, unknown>, key: string): string {
  if (key.startsWith("lengths.")) {
    const sub = key.slice("lengths.".length)
    return String(raw[`lengths.${sub}`] ?? "")
  }
  return String(raw[key] ?? "")
}

export function validateRows(mappedRows: Record<string, unknown>[]): ValidationResult {
  let missingFieldsCount = 0
  let requiredMissingCount = 0
  const types = new Set<string>()

  const rows: SupportRow[] = mappedRows.map((raw, index) => {
    const missingFields: string[] = []

    const lengths: Partial<Record<LengthKey, string>> = {}
    for (const k of LENGTH_KEYS) {
      const v = raw[`lengths.${k}`]
      if (v != null && String(v) !== "") lengths[k] = String(v)
      else lengths[k] = ""
    }

    const row: SupportRow = {
      slNo: String(raw["slNo"] ?? "").trim(),
      level: String(raw["level"] ?? ""),
      tagNumber: String(raw["tagNumber"] ?? ""),
      type: String(raw["type"] ?? ""),
      withPlate: String(raw["withPlate"] ?? ""),
      withoutPlate: String(raw["withoutPlate"] ?? ""),
      lengths,
      total: "",
      itemQtys: {},
      remarks: String(raw["remarks"] ?? ""),
      _rowIndex: index,
      _hasErrors: false,
      _missingFields: [],
    }

    row.total = calcTotal(row.lengths)

    let rowRequiredMissing = 0
    for (const key of REQUIRED_FIELDS) {
      if (!readField(raw, key)) {
        missingFields.push(key)
        rowRequiredMissing++
      }
    }

    for (const key of OPTIONAL_WARN_FIELDS) {
      if (!readField(raw, key)) {
        missingFields.push(key)
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
