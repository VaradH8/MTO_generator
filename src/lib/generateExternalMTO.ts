import * as XLSX from "xlsx-js-style"
import type { SupportRow, ExternalTypeProfile } from "@/types/support"
import { isRealRow, roundDisplay, type PdfLogos } from "./generatePDF"
import { injectLogosIntoXlsx, hasUsableLogo } from "./generateExcel"

/**
 * External MTO Excel exporter — produces a workbook matching the
 * RP5S_External_MTO_sample.csv layout. Self-contained so it doesn't
 * disturb the internal Excel/PDF generators.
 *
 * Inputs:
 *   - rows           : SupportRow[] (the project's external rows)
 *   - profiles       : ExternalTypeProfile[] from the Settings table
 *                      — provides TYPE → MEMBERS for L PROFILE summation
 *   - projectName    : header subtitle
 *   - logos          : optional top-corner logos (same shape PdfLogos)
 *
 * Computed columns:
 *   L PROFILE-50 / L PROFILE-100 — sum of the first MEMBERS length cells
 *     (cells like "576*3" treated as 3 segments of 576). Routed to the
 *     50 or 100 column based on the row's SB SIZE; row.lProfile50 /
 *     row.lProfile100 (when set) override the computed value, which is
 *     the path the user takes for UNIQUE / no-profile types where the
 *     value is entered manually in the source sheet.
 *   NUT / BOLT — sum of (item count × per-item fastener rate) using the
 *     rates derived from the RP5S sample:
 *       starter @50  = 4 each   starter @100 = 8 each
 *       conn    @50  = 2 each   conn    @100 = 8 each
 *
 * Item-count lookups walk row.itemQtys with regex patterns so the user
 * can keep their existing item naming as long as it contains the
 * relevant tokens ("STARTER BRACKET-50", "L ANGLE (Connector)", etc).
 * Items not found render as blank cells; nothing throws.
 */

/* ────────────────────────────── styling ─────────────────────────── */

const COLOR = {
  primary: "1F3CA8",
  dark: "0D1530",
  muted: "4A5478",
  border: "C9D2E4",
  rowAlt: "FAFBFE",
  white: "FFFFFF",
}

type CellStyle = NonNullable<XLSX.CellObject["s"]>

const TITLE_STYLE: CellStyle = {
  font: { name: "Calibri", sz: 16, bold: true, color: { rgb: COLOR.dark } },
  alignment: { horizontal: "center", vertical: "center" },
}
const SUBTITLE_STYLE: CellStyle = {
  font: { name: "Calibri", sz: 10, color: { rgb: COLOR.muted } },
  alignment: { horizontal: "center", vertical: "center" },
}
const HEADER_STYLE: CellStyle = {
  font: { name: "Calibri", sz: 9, bold: true, color: { rgb: COLOR.white } },
  fill: { patternType: "solid", fgColor: { rgb: COLOR.primary } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: COLOR.border } },
    bottom: { style: "thin", color: { rgb: COLOR.border } },
    left: { style: "thin", color: { rgb: COLOR.border } },
    right: { style: "thin", color: { rgb: COLOR.border } },
  },
}
function bodyStyle(zebra: boolean): CellStyle {
  return {
    font: { name: "Calibri", sz: 9, color: { rgb: COLOR.dark } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: zebra ? { patternType: "solid", fgColor: { rgb: COLOR.rowAlt } } : undefined,
    border: {
      top: { style: "thin", color: { rgb: COLOR.border } },
      bottom: { style: "thin", color: { rgb: COLOR.border } },
      left: { style: "thin", color: { rgb: COLOR.border } },
      right: { style: "thin", color: { rgb: COLOR.border } },
    },
  }
}

/* ────────────────────────── value helpers ───────────────────────── */

/** Parse a length cell that may be "x" or "x*n" (n segments of x).
 *  Returns total length contributed and segment count consumed. */
function parseLengthCellSegments(raw: string): { total: number; segments: number } {
  const s = String(raw).trim()
  if (!s) return { total: 0, segments: 0 }
  const mult = s.match(/^(\d+(?:\.\d+)?)\s*\*\s*(\d+)$/)
  if (mult) {
    const x = parseFloat(mult[1])
    const n = parseInt(mult[2], 10)
    if (Number.isFinite(x) && Number.isFinite(n) && n > 0) return { total: x * n, segments: n }
  }
  const x = parseFloat(s)
  return Number.isFinite(x) ? { total: x, segments: 1 } : { total: 0, segments: 0 }
}

/** Sum the first `members` length segments across A..F. */
function computeLProfileLength(row: SupportRow, members: number): number {
  if (members <= 0) return 0
  let total = 0
  let count = 0
  for (const k of ["a", "b", "c", "d", "e", "f"] as const) {
    if (count >= members) break
    const raw = String(row.lengths?.[k] ?? "").trim()
    if (!raw) continue
    const { total: t, segments } = parseLengthCellSegments(raw)
    total += t
    count += segments
  }
  return total
}

/** Walk row.itemQtys looking for an item whose name matches `itemRe` and
 *  optionally a variant matching `variantRe`. Returns the first numeric
 *  qty found, or 0. Variant patterns are checked against both the variant
 *  label and the empty-key fallback (so a no-variant item with a
 *  "starter bracket-50 with plate" name will still match). */
function findItemQty(row: SupportRow, itemRe: RegExp, variantRe: RegExp | null): number {
  for (const [item, variants] of Object.entries(row.itemQtys ?? {})) {
    if (!itemRe.test(item)) continue
    for (const [variant, qty] of Object.entries(variants)) {
      if (variantRe && variant && !variantRe.test(variant)) continue
      // When variantRe is set but the variant key is empty, fall back to
      // matching the item name for the variant token (covers the case where
      // the bracket name itself encodes the with/without).
      if (variantRe && !variant && !variantRe.test(item)) continue
      const n = Number(String(qty).trim())
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return 0
}

const STARTER_50_RE = /starter\s*bracket\s*-?\s*50/i
const STARTER_100_RE = /starter\s*bracket\s*-?\s*100/i
const CONNECTOR_RE = /l\s*angle\s*\(?\s*connector\s*\)?/i
const L_ANGLE_ONLY_RE = /^\s*l\s*angle\s*$/i
const WITH_PLATE_RE = /with\s*plate/i
const WITHOUT_PLATE_RE = /without\s*plate/i
const SIZE_50_RE = /(?:^|[^0-9])50(?:$|[^0-9])/
const SIZE_100_RE = /(?:^|[^0-9])100(?:$|[^0-9])/

interface RowMeta {
  starter50With: number
  starter50Without: number
  starter100With: number
  starter100Without: number
  conn50: number
  conn100: number
  lAngle: number
}

function extractRowMeta(row: SupportRow): RowMeta {
  return {
    starter50With: findItemQty(row, STARTER_50_RE, WITH_PLATE_RE),
    starter50Without: findItemQty(row, STARTER_50_RE, WITHOUT_PLATE_RE),
    starter100With: findItemQty(row, STARTER_100_RE, WITH_PLATE_RE),
    starter100Without: findItemQty(row, STARTER_100_RE, WITHOUT_PLATE_RE),
    conn50: findItemQty(row, CONNECTOR_RE, SIZE_50_RE),
    conn100: findItemQty(row, CONNECTOR_RE, SIZE_100_RE),
    lAngle: findItemQty(row, L_ANGLE_ONLY_RE, null),
  }
}

const FASTENERS = {
  starter50: 4,
  starter100: 8,
  conn50: 2,
  conn100: 8,
} as const

function computeNutBolt(meta: RowMeta): { nut: number; bolt: number } {
  const total =
    (meta.starter50With + meta.starter50Without) * FASTENERS.starter50
    + (meta.starter100With + meta.starter100Without) * FASTENERS.starter100
    + meta.conn50 * FASTENERS.conn50
    + meta.conn100 * FASTENERS.conn100
  return { nut: total, bolt: total }
}

/* ────────────────────────── sheet builder ───────────────────────── */

const COLUMN_COUNT = 27

function styleCell(ws: XLSX.WorkSheet, row: number, col: number, style: CellStyle): void {
  const ref = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = (ws[ref] as XLSX.CellObject | undefined) ?? { t: "s", v: "" }
  cell.s = style
  ;(ws as Record<string, unknown>)[ref] = cell
}

interface BuildSheetParams {
  rows: SupportRow[]
  profiles: Map<string, ExternalTypeProfile>
  projectName: string
  hasLogo: boolean
}

function buildSheet({ rows, profiles, projectName, hasLogo }: BuildSheetParams): XLSX.WorkSheet {
  const LOGO_ROW = 0
  const TITLE_ROW = 1
  const SUBTITLE_ROW = 2
  const H1_ROW = 3
  const H2_ROW = 4
  const BODY_START = 5

  const merges: XLSX.Range[] = []
  if (COLUMN_COUNT > 1) {
    merges.push({ s: { r: LOGO_ROW, c: 0 }, e: { r: LOGO_ROW, c: COLUMN_COUNT - 1 } })
    merges.push({ s: { r: TITLE_ROW, c: 0 }, e: { r: TITLE_ROW, c: COLUMN_COUNT - 1 } })
    merges.push({ s: { r: SUBTITLE_ROW, c: 0 }, e: { r: SUBTITLE_ROW, c: COLUMN_COUNT - 1 } })
  }

  // Row 1 of the table header. Cells with rowSpan=2 cover the same column
  // in row 2 (the merge is added below); cells with colSpan span across N
  // columns, with row 2 carrying the leaf labels.
  const head1: { content: string; rowSpan?: number; colSpan?: number }[] = [
    { content: "SL NO", rowSpan: 2 },          // 0
    { content: "SUPPORT NO.", rowSpan: 2 },    // 1
    { content: "DECK", rowSpan: 2 },           // 2
    { content: "DISCIPLINE", rowSpan: 2 },     // 3
    { content: "SB SIZE", rowSpan: 2 },        // 4
    { content: "TYPE", rowSpan: 2 },           // 5
    { content: "LENGTH (mm)", colSpan: 6 },    // 6-11
    { content: "L PROFILE-50" },               // 12 (sub: S2N100L)
    { content: "L PROFILE-100" },              // 13 (sub: S2N200L)
    { content: "L ANGLE", rowSpan: 2 },        // 14
    { content: "STARTER BRACKET-50", colSpan: 2 },   // 15-16
    { content: "STARTER BRACKET-100", colSpan: 2 },  // 17-18
    { content: "L ANGLE (Connector)", colSpan: 2 }, // 19-20
    { content: "NUT", rowSpan: 2 },            // 21
    { content: "BOLT", rowSpan: 2 },           // 22
    { content: "ELEVATION", colSpan: 3 },      // 23-25
    { content: "REMARKS", rowSpan: 2 },        // 26
  ]

  // Row 2 sub-header (one entry per real column).
  const head2: string[] = [
    "", "", "", "", "", "",
    "A", "B", "C", "D", "E", "F",
    "S2N100L",
    "S2N200L",
    "",
    "WITH PLATE", "WITHOUT PLATE",
    "WITH PLATE", "WITHOUT PLATE",
    "50.0", "100.0",
    "", "",
    "X", "Y", "Z",
    "",
  ]

  const flatHead1: string[] = []
  let col = 0
  for (const cell of head1) {
    flatHead1.push(cell.content)
    const span = cell.colSpan ?? 1
    for (let i = 1; i < span; i++) flatHead1.push("")
    if (span > 1) merges.push({ s: { r: H1_ROW, c: col }, e: { r: H1_ROW, c: col + span - 1 } })
    if (cell.rowSpan === 2) merges.push({ s: { r: H1_ROW, c: col }, e: { r: H2_ROW, c: col } })
    col += span
  }

  // Body rows
  const body: (string | number)[][] = []
  let slNo = 1
  for (const row of rows) {
    const profile = profiles.get(String(row.type ?? "").trim())
    const members = profile?.members ?? 0
    const sbSize = String(row.sbSize ?? "").trim()
    const meta = extractRowMeta(row)
    const { nut, bolt } = computeNutBolt(meta)

    let lp50: string | number = ""
    let lp100: string | number = ""
    if (members > 0) {
      const computed = computeLProfileLength(row, members)
      if (computed > 0) {
        const rounded = roundDisplay(computed)
        if (sbSize === "50") lp50 = rounded
        else if (sbSize === "100") lp100 = rounded
        else if (sbSize.includes("/")) {
          // Mixed size — defer to row-stored values below; computed value
          // alone can't say which side gets it.
        } else {
          // No SB SIZE provided: default to the 100 column (common case
          // in the source sample for unsized rows).
          lp100 = rounded
        }
      }
    }
    // Row-stored values override the computed value (UNIQUE/no-profile path).
    if (row.lProfile50 != null && String(row.lProfile50).trim() !== "") {
      const n = Number(String(row.lProfile50).trim())
      lp50 = Number.isFinite(n) ? roundDisplay(n) : String(row.lProfile50)
    }
    if (row.lProfile100 != null && String(row.lProfile100).trim() !== "") {
      const n = Number(String(row.lProfile100).trim())
      lp100 = Number.isFinite(n) ? roundDisplay(n) : String(row.lProfile100)
    }

    // Length cells render verbatim from the row (so "576*3" is preserved).
    const cells: (string | number)[] = []
    cells.push(slNo++)
    cells.push(row.tagNumber ?? "")
    cells.push(row.level ?? "")
    cells.push(row.discipline ?? "")
    cells.push(row.sbSize ?? "")
    cells.push(row.type ?? "")
    for (const k of ["a", "b", "c", "d", "e", "f"] as const) {
      cells.push(String(row.lengths?.[k] ?? ""))
    }
    cells.push(lp50)
    cells.push(lp100)
    cells.push(meta.lAngle || "")
    cells.push(meta.starter50With || "")
    cells.push(meta.starter50Without || "")
    cells.push(meta.starter100With || "")
    cells.push(meta.starter100Without || "")
    cells.push(meta.conn50 || "")
    cells.push(meta.conn100 || "")
    cells.push(nut || "")
    cells.push(bolt || "")
    cells.push(row.elevationX ?? "")
    cells.push(row.elevationY ?? "")
    cells.push(row.elevationZ ?? "")
    cells.push(row.remarks ?? "")
    body.push(cells)
  }

  const logoRow = new Array<string>(COLUMN_COUNT).fill("")
  const titleRow: (string | number)[] = ["External MTO Schedule", ...new Array(COLUMN_COUNT - 1).fill("")]
  const subtitleRow: (string | number)[] = [
    `${projectName ? `${projectName} | ` : ""}${rows.length} supports`,
    ...new Array(COLUMN_COUNT - 1).fill(""),
  ]
  const data: (string | number)[][] = [logoRow, titleRow, subtitleRow, flatHead1, head2, ...body]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws["!merges"] = merges

  // Column widths roughly tuned to the labels.
  const widths = [
    6, 18, 8, 14, 8, 6,
    8, 8, 8, 8, 8, 8,
    11, 11,
    8,
    11, 13, 11, 13,
    7, 8,
    8, 8,
    7, 7, 7,
    20,
  ]
  ws["!cols"] = widths.map((w) => ({ wch: w }))

  // Row heights — taller logo + title rows, normal everywhere else.
  const rowHeights: { hpt?: number }[] = []
  rowHeights[LOGO_ROW] = { hpt: hasLogo ? 62 : 6 }
  rowHeights[TITLE_ROW] = { hpt: 24 }
  rowHeights[SUBTITLE_ROW] = { hpt: 16 }
  rowHeights[H1_ROW] = { hpt: 24 }
  rowHeights[H2_ROW] = { hpt: 22 }
  ws["!rows"] = rowHeights

  styleCell(ws, TITLE_ROW, 0, TITLE_STYLE)
  styleCell(ws, SUBTITLE_ROW, 0, SUBTITLE_STYLE)
  for (let c = 0; c < COLUMN_COUNT; c++) {
    styleCell(ws, H1_ROW, c, HEADER_STYLE)
    styleCell(ws, H2_ROW, c, HEADER_STYLE)
  }
  for (let r = 0; r < body.length; r++) {
    const zebra = r % 2 === 1
    const style = bodyStyle(zebra)
    for (let c = 0; c < COLUMN_COUNT; c++) {
      styleCell(ws, BODY_START + r, c, style)
    }
  }

  ;(ws as Record<string, unknown>)["!views"] = [{ state: "frozen", xSplit: 0, ySplit: BODY_START }]

  return ws
}

/* ────────────────────────── public API ─────────────────────────── */

export async function generateExternalMTO(
  rows: SupportRow[],
  profiles: ExternalTypeProfile[],
  projectName?: string,
  logos?: PdfLogos,
): Promise<Blob> {
  const realRows = rows.filter(isRealRow)
  const profileMap = new Map(profiles.map((p) => [p.typeName.trim(), p]))
  const ws = buildSheet({
    rows: realRows,
    profiles: profileMap,
    projectName: projectName ?? "",
    hasLogo: hasUsableLogo(logos),
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "External MTO")
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  return injectLogosIntoXlsx(blob, logos, COLUMN_COUNT)
}
