import * as XLSX from "xlsx"
import { validateRows } from "./validateRows"
import { LENGTH_KEYS } from "@/types/support"
import type { ParseResult } from "@/types/support"

const HEADER_ALIASES: Record<string, string> = {
  // slNo (serial number)
  "sl no": "slNo",
  "sl no.": "slNo",
  "sl.no": "slNo",
  "si no": "slNo",
  "si no.": "slNo",
  "sr no": "slNo",
  "sr no.": "slNo",
  "s.no": "slNo",
  "s no": "slNo",
  "serial": "slNo",
  "serial no": "slNo",

  // level
  "level": "level",
  "lvl": "level",

  // tagNumber
  "tag number": "tagNumber",
  "tag no": "tagNumber",
  "tag no.": "tagNumber",
  "tag name": "tagNumber",
  "support no": "tagNumber",
  "support no.": "tagNumber",
  "support number": "tagNumber",
  "support tag name": "tagNumber",
  "support tag": "tagNumber",
  "support nos": "tagNumber",
  "support id": "tagNumber",

  // type
  "type": "type",
  "support type": "type",
  "final type": "type",

  // with plate / without plate
  "with plate": "withPlate",
  "with-plate": "withPlate",
  "without plate": "withoutPlate",
  "without-plate": "withoutPlate",

  // lengths a..p — handled dynamically below

  // total — auto-calculated
  "total": "total",
  "qty total": "total",

  // remarks
  "remarks": "remarks",
  "remark": "remarks",
}

// Seed length aliases a..p → lengths.<key>
for (const k of LENGTH_KEYS) {
  HEADER_ALIASES[k] = `lengths.${k}`
}

/**
 * Fields the user can fill globally via the Missing Columns form when the
 * input sheet lacks a header for them. Lengths are intentionally omitted —
 * they are per-row cells the user fills in the review table, not a single
 * value applied to every row.
 */
const USER_FILLABLE_FIELDS = [
  "slNo", "level", "tagNumber", "type", "withPlate", "withoutPlate",
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
    }
  }

  const excelHeaders = Object.keys(rawRows[0])

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

  const IGNORED_TYPE_VALUES = ["single", "double", "unknown", "n/a", "na", ""]

  const mappedRows: Record<string, unknown>[] = rawRows.map((raw) => {
    const mapped: Record<string, unknown> = {}
    for (const [excelHeader, fieldKey] of Object.entries(headerMap)) {
      let val = raw[excelHeader]
      if (fieldKey === "type" && typeof val === "string" && IGNORED_TYPE_VALUES.includes(val.trim().toLowerCase())) {
        val = ""
      }
      mapped[fieldKey] = val
    }
    return mapped
  })

  const hasAnyValidType = mappedRows.some((r) => {
    const t = String(r["type"] ?? "").trim()
    return t !== ""
  })

  const missingColumns = USER_FILLABLE_FIELDS.filter((field) => {
    if (field === "type" && !hasAnyValidType) return true
    return !foundFields.has(field)
  })

  const validation = validateRows(mappedRows)

  return {
    validation,
    missingColumns,
    detectedHeaders: excelHeaders,
  }
}
