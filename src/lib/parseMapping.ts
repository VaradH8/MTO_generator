import * as XLSX from "xlsx"
import type { TypeMapping } from "@/types/support"

/**
 * Parse a Mapping.xlsx file.
 *
 * Expected layout:
 *   Row 0 (headers): TYPE | A | B | C | D | E | F | ... | S
 *   Row 1+:          <type name> | <cell> | <cell> | ...
 *
 * Each cell under the A..S columns contains either:
 *   - A single letter (A–P) = that input length key must have a value
 *   - "MISSING" = input column not available (flagged in `hasMissing`)
 *   - empty = ignored
 *
 * Returns a map of { typeName: { required: [ "a","b","c" ], hasMissing } }.
 * Required keys are lowercased so they match SupportRow field names.
 */
export async function parseMappingFile(file: File): Promise<Record<string, TypeMapping>> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return {}

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" })
  if (rows.length < 2) return {}

  const result: Record<string, TypeMapping> = {}

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const typeName = String(row[0] ?? "").trim()
    if (!typeName) continue

    const required = new Set<string>()
    let hasMissing = false

    // Skip index 0 (the TYPE column itself); scan the rest
    for (let j = 1; j < row.length; j++) {
      const raw = String(row[j] ?? "").trim().toUpperCase()
      if (!raw) continue
      if (raw === "MISSING") { hasMissing = true; continue }
      // Accept single letters A–P (the length keys we support on SupportRow)
      if (/^[A-P]$/.test(raw)) required.add(raw.toLowerCase())
    }

    // Merge if the same type appears on multiple rows (e.g., Type 2 has two rows in the file)
    const existing = result[typeName]
    if (existing) {
      for (const r of existing.required) required.add(r)
      hasMissing = hasMissing || existing.hasMissing
    }

    result[typeName] = {
      required: Array.from(required).sort(),
      hasMissing,
    }
  }

  return result
}

/** Check whether a row has all mapping-required fields filled. Returns list of empty required keys. */
export function getMissingMappedFields(
  row: Record<string, unknown>,
  mapping: TypeMapping | undefined
): string[] {
  if (!mapping) return []
  const missing: string[] = []
  for (const key of mapping.required) {
    const value = String(row[key] ?? "").trim()
    if (!value) missing.push(key)
  }
  return missing
}
