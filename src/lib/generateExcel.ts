import * as XLSX from "xlsx"
import { LENGTH_KEYS } from "@/types/support"
import type { SupportRow, SupportTypeConfig, GroupedSupports, TypeMapping } from "@/types/support"
import {
  PRE_LENGTH,
  platesForType,
  dominantMaterial,
  buildItemModels,
  buildItemColumns,
  composeHeader,
  normVariant,
  readItemValue,
  maxLengthKey,
  totalForRow,
} from "./generatePDF"

type ProjectMapping = Record<string, TypeMapping>

/**
 * Excel exporter that mirrors the PDF Support Schedule layout cell-for-cell:
 * the same two-row header (with merged parent cells over LENGTH and over each
 * variant item's subcolumns), the same column order, and the same cell
 * contents (qty only — model+material lives in the headers). Rendered as a
 * .xlsx blob ready to hand to the browser's download flow. No styling
 * (community xlsx package doesn't support fills/fonts), but the structure is
 * a 1:1 match so the result reads the same as the PDF.
 */

interface BuildSchemaParams {
  rows: SupportRow[]
  typeConfigs: SupportTypeConfig[]
  /** When true, restrict typeConfigs to those whose name appears in `rows`
   *  (matches the per-type PDF section behavior). Combined/selection paths
   *  pass the full union. */
  scopeToRows?: boolean
}

interface SheetSchema {
  /** Two-row header. Each top-row cell may carry rowSpan/colSpan that we
   *  translate to !merges. Bottom row may be sparse (placeholders) for
   *  spans the top row covers. */
  headRow1: { content: string; rowSpan?: number; colSpan?: number }[]
  headRow2: (string | null)[]
  /** Body rows aligned to the column order produced by the header expansion. */
  body: string[][]
  /** Total number of columns (after expanding spans). */
  width: number
}

function buildSchema(params: BuildSchemaParams, mapping: ProjectMapping | undefined): SheetSchema {
  const { rows, typeConfigs, scopeToRows } = params

  const lastLength = maxLengthKey(rows)
  const lastLengthIdx = LENGTH_KEYS.indexOf(lastLength)
  const activeLengths = LENGTH_KEYS.slice(0, lastLengthIdx + 1)

  let activeConfigs = typeConfigs
  if (scopeToRows) {
    const typesInRows = new Set(rows.map((r) => r.type.trim().toLowerCase()).filter(Boolean))
    const scoped = typeConfigs.filter((tc) => typesInRows.has(tc.typeName.trim().toLowerCase()))
    if (scoped.length > 0) activeConfigs = scoped
  }

  const itemCols = buildItemColumns(activeConfigs)
  const models = buildItemModels(activeConfigs)
  const material = dominantMaterial(rows)

  const itemGroups: { itemName: string; variantLabels: string[] }[] = []
  for (const ic of itemCols) {
    const existing = itemGroups.find((g) => g.itemName === ic.itemName)
    if (existing) existing.variantLabels.push(ic.variantLabel)
    else itemGroups.push({ itemName: ic.itemName, variantLabels: [ic.variantLabel] })
  }

  const headRow1: SheetSchema["headRow1"] = []
  const headRow2: (string | null)[] = []

  // Pre-length meta columns — rowSpan over the two header rows.
  for (const c of PRE_LENGTH) {
    headRow1.push({ content: c.label, rowSpan: 2 })
    headRow2.push(null)
  }
  // LENGTH (mm) parent + A..N children
  headRow1.push({ content: "LENGTH (mm)", colSpan: activeLengths.length })
  for (const k of activeLengths) headRow2.push(k.toUpperCase())
  // TOTAL — rowSpan
  headRow1.push({ content: "TOTAL", rowSpan: 2 })
  headRow2.push(null)

  // Item columns. Variant items: parent header is just ITEM, each variant
  // subcolumn carries the full MATERIAL-MODEL — same as the PDF.
  for (const g of itemGroups) {
    const isVariant = g.variantLabels.length > 1 || (g.variantLabels.length === 1 && g.variantLabels[0] !== "")
    const upper = g.itemName.toUpperCase()
    if (isVariant) {
      headRow1.push({ content: upper, colSpan: g.variantLabels.length })
      const variantModels = models.variant.get(g.itemName)
      for (const label of g.variantLabels) {
        const model = variantModels?.get(normVariant(label)) ?? ""
        headRow2.push(composeHeader(label, [material, model]))
      }
    } else {
      const model = models.parent.get(g.itemName) ?? ""
      headRow1.push({ content: composeHeader(upper, [material, model]), rowSpan: 2 })
      headRow2.push(null)
    }
  }

  headRow1.push({ content: "REMARKS", rowSpan: 2 })
  headRow2.push(null)

  // Primary-variant promotion so a row stored under "" still surfaces under
  // the leading variant column instead of vanishing — mirrors the PDF.
  const primaryCol = new Set<string>()
  {
    const seenItems = new Set<string>()
    for (const ic of itemCols) {
      if (seenItems.has(ic.itemName)) continue
      seenItems.add(ic.itemName)
      primaryCol.add(`${ic.itemName}::${ic.variantLabel}`)
    }
  }

  const body: string[][] = rows.map((row) => {
    const cells: string[] = []
    const flags = platesForType(activeConfigs, row)
    for (const c of PRE_LENGTH) {
      if (c.key === "withPlate") cells.push(flags.withPlate || "")
      else if (c.key === "withoutPlate") cells.push(flags.withoutPlate || "")
      else cells.push(String((row as unknown as Record<string, unknown>)[c.key] ?? ""))
    }
    for (const k of activeLengths) cells.push(String(row.lengths[k] ?? ""))
    cells.push(totalForRow(row, mapping))
    for (const ic of itemCols) {
      const isPrimary = primaryCol.has(`${ic.itemName}::${ic.variantLabel}`)
      cells.push(readItemValue(row, ic.itemName, ic.variantLabel, isPrimary))
    }
    cells.push(String(row.remarks ?? ""))
    return cells
  })

  // Width = sum of colSpans (or 1 each).
  let width = 0
  for (const cell of headRow1) width += cell.colSpan ?? 1

  return { headRow1, headRow2, body, width }
}

interface BuildSheetParams {
  title: string
  subtitle: string
  schema: SheetSchema
}

/** Convert the schema to an XLSX worksheet with merged header cells. */
function buildSheet({ title, subtitle, schema }: BuildSheetParams): XLSX.WorkSheet {
  const { headRow1, headRow2, body, width } = schema

  // Expand headRow1 spans into a flat row aligned to the workbook grid. Cells
  // covered by a colSpan are filled with "" so the array is rectangular, and
  // we record merge ranges separately.
  const flatHead1: string[] = []
  const merges: XLSX.Range[] = []
  // Title spans every column; subtitle too.
  const TITLE_ROW = 0
  const SUBTITLE_ROW = 1
  const H1_ROW = 2
  const H2_ROW = 3
  const BODY_START_ROW = 4

  // Title row
  const titleRow: string[] = [title, ...new Array(Math.max(0, width - 1)).fill("")]
  // Subtitle row
  const subtitleRow: string[] = [subtitle, ...new Array(Math.max(0, width - 1)).fill("")]
  if (width > 1) {
    merges.push({ s: { r: TITLE_ROW, c: 0 }, e: { r: TITLE_ROW, c: width - 1 } })
    merges.push({ s: { r: SUBTITLE_ROW, c: 0 }, e: { r: SUBTITLE_ROW, c: width - 1 } })
  }

  let col = 0
  for (const cell of headRow1) {
    flatHead1.push(cell.content)
    const span = cell.colSpan ?? 1
    for (let i = 1; i < span; i++) flatHead1.push("")
    if (span > 1) {
      merges.push({ s: { r: H1_ROW, c: col }, e: { r: H1_ROW, c: col + span - 1 } })
    }
    if (cell.rowSpan === 2) {
      merges.push({ s: { r: H1_ROW, c: col }, e: { r: H2_ROW, c: col } })
    }
    col += span
  }

  // headRow2 is already flat (one entry per real column); replace nulls with
  // "" so XLSX doesn't choke. The rowSpan merges above mean those "" cells
  // are visually covered.
  const flatHead2: string[] = headRow2.map((v) => v ?? "")

  const data: string[][] = [titleRow, subtitleRow, flatHead1, flatHead2, ...body]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws["!merges"] = merges

  // Auto-ish column widths — meta columns narrow, item/header columns wider.
  const cols: { wch: number }[] = []
  for (let i = 0; i < width; i++) {
    // Pick the longest header text in either head row to seed the width.
    const h1 = flatHead1[i] ?? ""
    const h2 = flatHead2[i] ?? ""
    const headerLen = Math.max(h1.length, h2.length)
    cols.push({ wch: Math.min(40, Math.max(8, headerLen + 2)) })
  }
  ws["!cols"] = cols

  // Freeze the title + subtitle + two header rows.
  ws["!freeze"] = { xSplit: 0, ySplit: BODY_START_ROW }

  return ws
}

function workbookToBlob(wb: XLSX.WorkBook): Blob {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

/** Per-type Excel — one sheet, same layout as a per-type PDF. */
export async function generateExcel(
  type: string,
  rows: SupportRow[],
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  mapping?: ProjectMapping,
): Promise<Blob> {
  const schema = buildSchema({ rows, typeConfigs, scopeToRows: true }, mapping)
  const subtitle = `${projectName ? `${projectName} | ` : ""}${rows.length} supports`
  const ws = buildSheet({ title: `Support Schedule — ${type}`, subtitle, schema })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, type.slice(0, 31) || "Schedule")
  return workbookToBlob(wb)
}

/** Combined Excel — every row across every type in one continuous sheet,
 *  rows grouped by type to match the PDF. */
export async function generateCombinedExcel(
  grouped: GroupedSupports,
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  mapping?: ProjectMapping,
): Promise<Blob> {
  const allRows: SupportRow[] = []
  const typesUsed: string[] = []
  for (const [type, rows] of Object.entries(grouped)) {
    if (!rows.length) continue
    typesUsed.push(type)
    for (const r of rows) allRows.push(r)
  }
  const schema = buildSchema({ rows: allRows, typeConfigs }, mapping)
  const subtitle = [
    projectName,
    `${allRows.length} supports`,
    typesUsed.length > 0 ? `${typesUsed.length} type${typesUsed.length !== 1 ? "s" : ""}: ${typesUsed.join(", ")}` : null,
  ].filter(Boolean).join(" | ")
  const ws = buildSheet({ title: "Support Schedule — Combined", subtitle, schema })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Combined")
  return workbookToBlob(wb)
}

/** Selection Excel — explicit row set, same layout. Same as combined but
 *  with a different title and no group header. */
export async function generateSelectionExcel(
  rows: SupportRow[],
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  mapping?: ProjectMapping,
): Promise<Blob> {
  const buckets: Record<string, SupportRow[]> = {}
  for (const r of rows) {
    const t = r.type || "Unknown"
    if (!buckets[t]) buckets[t] = []
    buckets[t].push(r)
  }
  const ordered: SupportRow[] = []
  for (const rs of Object.values(buckets)) ordered.push(...rs)
  const typesUsed = Array.from(new Set(rows.map((r) => r.type).filter(Boolean)))
  const schema = buildSchema({ rows: ordered, typeConfigs }, mapping)
  const subtitle = [
    projectName,
    `Selected · ${rows.length} supports`,
    typesUsed.length > 0 ? typesUsed.join(", ") : null,
  ].filter(Boolean).join(" | ")
  const ws = buildSheet({ title: "Support Schedule — Selection", subtitle, schema })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Selection")
  return workbookToBlob(wb)
}
