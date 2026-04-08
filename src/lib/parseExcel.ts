import * as XLSX from "xlsx"
import { validateRows } from "./validateRows"
import type { ParseResult } from "@/types/support"

/**
 * Maps common Excel header variations to our internal field keys.
 * Keys are lowercase for case-insensitive matching.
 */
const HEADER_ALIASES: Record<string, string> = {
  // supportTagName
  "support no": "supportTagName",
  "support no.": "supportTagName",
  "support number": "supportTagName",
  "support tag name": "supportTagName",
  "support tag": "supportTagName",
  "tag name": "supportTagName",
  "support nos": "supportTagName",
  "support id": "supportTagName",

  // discipline
  "discipline": "discipline",
  "disc": "discipline",
  "disc.": "discipline",

  // type (L01, L02, H01, U01, RF01, etc.)
  "type": "type",
  "support type": "type",
  "final type": "type",

  // A, B, C, D
  "a": "a",
  "b": "b",
  "c": "c",
  "d": "d",

  // total — auto-calculated, but map it if present in Excel
  "total": "total",
  "qty total": "total",

  // items
  "item-01 name": "item01Name",
  "item 01 name": "item01Name",
  "item1 name": "item01Name",
  "item-01 qty": "item01Qty",
  "item 01 qty": "item01Qty",
  "item1 qty": "item01Qty",
  "item-02 name": "item02Name",
  "item 02 name": "item02Name",
  "item2 name": "item02Name",
  "item-02 qty": "item02Qty",
  "item 02 qty": "item02Qty",
  "item2 qty": "item02Qty",
  "item-03 name": "item03Name",
  "item 03 name": "item03Name",
  "item3 name": "item03Name",
  "item-03 qty": "item03Qty",
  "item 03 qty": "item03Qty",
  "item3 qty": "item03Qty",

  // coordinates
  "x": "x",
  "y": "y",
  "z": "z",
  "x-grid": "xGrid",
  "x grid": "xGrid",
  "xgrid": "xGrid",
  "y-grid": "yGrid",
  "y grid": "yGrid",
  "ygrid": "yGrid",

  // remarks
  "remarks": "remarks",
  "remark": "remarks",
  "review reason": "remarks",
  "notes": "remarks",
  "comment": "remarks",
  "comments": "remarks",
}

/**
 * Fields the user can fill globally via the Missing Columns form.
 * total is auto-calculated.
 * item qty fields are handled via per-type config.
 */
/**
 * x, y, z are excluded — handled separately as Datum Points in the UI.
 */
const USER_FILLABLE_FIELDS = [
  "supportTagName", "discipline", "type",
  "a", "b", "c", "d",
  "item01Name", "item02Name", "item03Name",
  "xGrid", "yGrid",
]

/** All target field keys in our SupportRow (excluding internal _ fields and auto-calc fields) */
const ALL_FIELDS = [
  "supportTagName", "discipline", "type",
  "a", "b", "c", "d", "total",
  "item01Name", "item01Qty", "item02Name", "item02Qty",
  "item03Name", "item03Qty",
  "x", "y", "z", "xGrid", "yGrid", "remarks",
]

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

  if (rawRows.length === 0) {
    return {
      validation: { isValid: false, totalRows: 0, totalTypes: 0, missingFieldsCount: 0, requiredMissingCount: 0, rows: [] },
      missingColumns: USER_FILLABLE_FIELDS,
      detectedHeaders: [],
      xyzMissing: true,
    }
  }

  // Detect Excel headers from first row keys
  const excelHeaders = Object.keys(rawRows[0])

  // Build mapping: excelHeader -> our field key
  const headerMap: Record<string, string> = {}
  const foundFields = new Set<string>()

  for (const header of excelHeaders) {
    const normalized = header.trim().toLowerCase()
    const fieldKey = HEADER_ALIASES[normalized]
    if (fieldKey && !foundFields.has(fieldKey)) {
      headerMap[header] = fieldKey
      foundFields.add(fieldKey)
    }
  }

  // Values to ignore for the "type" field — these are not real support types
  const IGNORED_TYPE_VALUES = ["single", "double", "unknown", "n/a", "na", ""]

  // Remap raw rows using detected header mapping
  const mappedRows: Record<string, unknown>[] = rawRows.map((raw) => {
    const mapped: Record<string, unknown> = {}
    for (const [excelHeader, fieldKey] of Object.entries(headerMap)) {
      let val = raw[excelHeader]
      // Strip invalid type values so they're treated as missing
      if (fieldKey === "type" && typeof val === "string" && IGNORED_TYPE_VALUES.includes(val.trim().toLowerCase())) {
        val = ""
      }
      mapped[fieldKey] = val
    }
    return mapped
  })

  // Check if type column had ALL values ignored/empty — if so, treat as missing column
  const hasAnyValidType = mappedRows.some((r) => {
    const t = String(r["type"] ?? "").trim()
    return t !== ""
  })

  // Missing columns = user-fillable fields not found in Excel
  // (excludes total, item qtys — those are auto/per-type)
  // Also add "type" if no valid type values were found
  const missingColumns = USER_FILLABLE_FIELDS.filter((field) => {
    if (field === "type" && !hasAnyValidType) return true
    return !foundFields.has(field)
  })

  // Check if X, Y, Z are missing from Excel
  const xyzMissing = !foundFields.has("x") || !foundFields.has("y") || !foundFields.has("z")

  const validation = validateRows(mappedRows)

  return {
    validation,
    missingColumns,
    detectedHeaders: excelHeaders,
    xyzMissing,
  }
}
