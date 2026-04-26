import * as XLSX from "xlsx"
import { LENGTH_KEYS } from "@/types/support"
import type { TypeMapping, LengthKey } from "@/types/support"

/**
 * Parse a Mapping.xlsx file.
 *
 * Expected layout:
 *   Row 0 (headers): TYPE | A | B | C | D | E | F | ... | S
 *   Row 1+:          <type name> | <cell> | <cell> | ...
 *
 * Each cell under the A..S columns can contain:
 *   - "<LETTER>_<n>"  e.g. "A_0", "A_2" — that length key feeds into the
 *                     row TOTAL with factor n (where _0 is the special
 *                     "include unmultiplied" form, n≥1 is a literal
 *                     multiplier). Length keys never marked this way
 *                     contribute nothing to the total.
 *   - "<LETTER>"      e.g. "A" — legacy: that input length must have a
 *                     value (validation only, NOT included in the total).
 *   - "MISSING"       input column not available for this type
 *                     (flags `hasMissing`).
 *   - empty           ignored.
 *
 * Returns a map of { typeName: { required, factors, hasMissing } }.
 * Required keys and factor keys are lowercased to match SupportRow.lengths.
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
    const factors: Partial<Record<LengthKey, number>> = {}
    let hasMissing = false

    // Skip index 0 (the TYPE column itself); scan the rest.
    for (let j = 1; j < row.length; j++) {
      const raw = String(row[j] ?? "").trim()
      if (!raw) continue
      const upper = raw.toUpperCase()
      if (upper === "MISSING") { hasMissing = true; continue }

      // <Letter>_<digits> → factor entry. _0 is shorthand for factor 1
      // (the user's convention: 0 = "no multiplier, just include").
      const factorMatch = upper.match(/^([A-P])_(\d+)$/)
      if (factorMatch) {
        const letter = factorMatch[1].toLowerCase() as LengthKey
        const n = parseInt(factorMatch[2], 10)
        const factor = n === 0 ? 1 : n
        // If the same letter appears twice for the same type, keep the
        // larger factor so we never silently lose a multiplier.
        const prev = factors[letter] ?? 0
        if (factor > prev) factors[letter] = factor
        // Also flag as "required" so empty cells of this letter still
        // get the missing-fields red highlight.
        required.add(letter)
        continue
      }

      // Legacy plain letter — required for validation, not in the total.
      if (/^[A-P]$/.test(upper)) required.add(upper.toLowerCase())
    }

    // Merge if the same type appears on multiple rows.
    const existing = result[typeName]
    if (existing) {
      for (const r of existing.required) required.add(r)
      hasMissing = hasMissing || existing.hasMissing
      for (const k of LENGTH_KEYS) {
        const here = factors[k]
        const there = existing.factors[k]
        if (there !== undefined && (here === undefined || there > here)) {
          factors[k] = there
        }
      }
    }

    result[typeName] = {
      required: Array.from(required).sort(),
      factors,
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

/**
 * Compute a row's TOTAL using the mapping factors.
 *   - Mapping with factors: total = Σ (lengths[letter] × factor[letter]).
 *   - Mapping without factors (legacy plain-letter only): falls back to summing
 *     every populated length so old projects don't silently start showing 0.
 *   - No mapping at all: same legacy fallback.
 */
export function computeMappedTotal(
  lengths: Partial<Record<LengthKey, string>>,
  mapping: TypeMapping | undefined,
): string {
  let sum = 0
  if (mapping && Object.keys(mapping.factors).length > 0) {
    for (const k of LENGTH_KEYS) {
      const factor = mapping.factors[k]
      if (factor === undefined) continue
      const raw = lengths[k]
      if (raw == null || raw === "") continue
      const n = parseFloat(String(raw))
      if (!isNaN(n)) sum += n * factor
    }
  } else {
    for (const k of LENGTH_KEYS) {
      const raw = lengths[k]
      if (raw == null || raw === "") continue
      const n = parseFloat(String(raw))
      if (!isNaN(n)) sum += n
    }
  }
  return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
}
