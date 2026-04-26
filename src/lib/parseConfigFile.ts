import * as XLSX from "xlsx"

/**
 * Parse the Master Support Config Excel file (e.g. Modular_Support_Config_RP5S.xlsx).
 *
 * Expected sheet layout (case-insensitive headers, only the first sheet is read):
 *   Type | Items | Make | Model | Quantity | Notes
 *
 * Each row is one master type. Item / Make / Model / Quantity may be
 * comma-separated when a type uses multiple items. Items with variants are
 * tagged inline like `L ANGLE (variant Z)` — the parser keeps the entire
 * string as the item name (no variant collapsing). Em-dash rows ("—" in the
 * Items column) are treated as "no items" and skipped entirely.
 *
 * Comma-alignment rules:
 *   - Items, Model, Quantity must all have the SAME comma count. Mismatched
 *     rows are skipped with a warning so a typo can never silently corrupt
 *     a type config.
 *   - Make may be a single value (applied to every item) OR comma-separated
 *     with the same count as Items.
 */
export interface ParsedConfigItem {
  itemName: string
  qty: string
  make: string
  model: string
}

export interface ParsedConfigType {
  typeName: string
  items: ParsedConfigItem[]
}

export interface ParsedConfig {
  types: ParsedConfigType[]
  warnings: string[]
}

const EMPTY_CELLS = new Set(["", "—", "-", "—".normalize("NFKC")])

function findColumn(header: unknown[], pattern: RegExp): number {
  for (let i = 0; i < header.length; i++) {
    if (pattern.test(String(header[i] ?? "").trim())) return i
  }
  return -1
}

function splitCommas(s: string): string[] {
  return s.split(",").map((p) => p.trim()).filter((p) => p.length > 0)
}

export async function parseConfigFile(file: File): Promise<ParsedConfig> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array" })
  if (wb.SheetNames.length === 0) return { types: [], warnings: ["Workbook has no sheets"] }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { types: [], warnings: [`Sheet ${wb.SheetNames[0]} is empty`] }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })
  if (rows.length < 2) return { types: [], warnings: ["File has no data rows"] }

  const header = rows[0] as unknown[]
  const typeIdx = findColumn(header, /^type$/i)
  const itemsIdx = findColumn(header, /^items?$/i)
  const makeIdx = findColumn(header, /^make$/i)
  const modelIdx = findColumn(header, /^model$/i)
  const qtyIdx = findColumn(header, /^(qty|quantity)$/i)

  const missingHeaders: string[] = []
  if (typeIdx === -1) missingHeaders.push("Type")
  if (itemsIdx === -1) missingHeaders.push("Items")
  if (makeIdx === -1) missingHeaders.push("Make")
  if (modelIdx === -1) missingHeaders.push("Model")
  if (qtyIdx === -1) missingHeaders.push("Quantity")
  if (missingHeaders.length > 0) {
    return {
      types: [],
      warnings: [`Missing required columns: ${missingHeaders.join(", ")}. Found headers: ${header.join(" | ")}`],
    }
  }

  const types: ParsedConfigType[] = []
  const warnings: string[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    const typeName = String(row[typeIdx] ?? "").trim()
    if (!typeName) continue

    const itemsRaw = String(row[itemsIdx] ?? "").trim()
    if (!itemsRaw || EMPTY_CELLS.has(itemsRaw)) continue

    const itemNames = splitCommas(itemsRaw)
    if (itemNames.length === 0) continue

    const makeRaw = String(row[makeIdx] ?? "").trim()
    const modelRaw = String(row[modelIdx] ?? "").trim()
    const qtyRaw = String(row[qtyIdx] ?? "").trim()

    const makes = splitCommas(makeRaw)
    const models = splitCommas(modelRaw)
    const qtys = splitCommas(qtyRaw)

    if (models.length !== itemNames.length) {
      warnings.push(`Row ${r + 1} (type "${typeName}"): Model has ${models.length} entries but Items has ${itemNames.length} — row skipped.`)
      continue
    }
    if (qtys.length !== itemNames.length) {
      warnings.push(`Row ${r + 1} (type "${typeName}"): Quantity has ${qtys.length} entries but Items has ${itemNames.length} — row skipped.`)
      continue
    }

    let perItemMakes: string[]
    if (makes.length === 1) {
      perItemMakes = itemNames.map(() => makes[0])
    } else if (makes.length === itemNames.length) {
      perItemMakes = makes
    } else if (makes.length === 0) {
      perItemMakes = itemNames.map(() => "")
    } else {
      warnings.push(`Row ${r + 1} (type "${typeName}"): Make has ${makes.length} entries — must be 1 (applies to all) or ${itemNames.length}. Row skipped.`)
      continue
    }

    types.push({
      typeName,
      items: itemNames.map((name, i) => ({
        itemName: name,
        qty: qtys[i],
        make: perItemMakes[i],
        model: models[i],
      })),
    })
  }

  return { types, warnings }
}
