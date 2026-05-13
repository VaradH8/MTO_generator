import * as XLSX from "xlsx-js-style"
import type { SupportRow, ExternalTypeProfile, SupportTypeConfig, TypeMapping } from "@/types/support"
import { isRealRow, roundDisplay, type PdfLogos } from "./generatePDF"
import { injectLogosIntoXlsx, hasUsableLogo } from "./generateExcel"
import { computeMappedTotal } from "./parseMapping"

/** Per-project mapping (typeName → TypeMapping) — same shape as the
 *  internal flow uses for the row TOTAL. Drives the L PROFILE
 *  summation when present; profile's MEMBERS is the fallback. */
type ProjectMapping = Record<string, TypeMapping>

/**
 * External MTO Excel exporter — produces a workbook matching the
 * RP5S_External_MTO_sample.csv layout. Self-contained so it doesn't
 * disturb the internal Excel/PDF generators.
 *
 * Inputs:
 *   - rows           : SupportRow[] (the project's external rows)
 *   - profiles       : ExternalTypeProfile[] from the Settings table
 *                      — provides TYPE → MEMBERS for L PROFILE summation
 *                      and (via the flag columns) the implicit SB SIZE
 *                      when the row didn't carry one.
 *   - typeConfigs    : SupportTypeConfig[] from the project — the per-
 *                      type item table. STARTER BRACKET / L ANGLE
 *                      (Connector) / NUT / BOLT counts are read from
 *                      these configs (with variant labels like
 *                      "50 With Plate") rather than computed.
 *   - projectName    : header subtitle
 *   - logos          : optional top-corner logos (same shape PdfLogos)
 *
 * Computed columns:
 *   L PROFILE-50 / L PROFILE-100 — total of the row's length cells.
 *     When the project has a Mapping.xlsx entry for the row's TYPE,
 *     the mapped factors drive the sum (same `Σ lengths × factor`
 *     formula the internal flow uses for the row TOTAL). Otherwise,
 *     falls back to the L_ANGLE_PROFILE's MEMBERS count (sum of the
 *     first N length cells, with cells like "576*3" treated as 3
 *     segments of 576).
 *
 *     Routing — which of the two columns the total lands in — always
 *     comes from the profile's flag values for that TYPE: flags =
 *     "100" → L PROFILE-100, flags blank or non-100 → L PROFILE-50,
 *     mixed flags → "50/100" (per-side values then come from the
 *     row's lProfile50 / lProfile100). row.sbSize overrides the
 *     profile when present. The SB SIZE column displays the
 *     resolved value.
 *
 *   NUT / BOLT — read directly from the type config (NUT and BOLT
 *     items, item.qty). The user fills these in from the master /
 *     project config UI; the exporter no longer auto-computes them.
 *
 * Variant matching for STARTER BRACKET reads any item whose name
 * contains "starter bracket" with variant labels matching size +
 * with/without plate (in either order, e.g. "50 With Plate" or
 * "With Plate 50"). L ANGLE (Connector) reads any item whose name
 * contains "connector" with variants matching "50" or "100". Items
 * not found render as blank cells; nothing throws.
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

/** Compute the L PROFILE total for a row. Prefers the project mapping's
 *  factors (same Σ length × factor formula the internal TOTAL uses) when
 *  the row's TYPE has a mapping entry with at least one factor; otherwise
 *  falls back to the profile's MEMBERS count (sum of the first N segments
 *  across A..F, where a cell like "576*3" contributes 3 segments of 576). */
function computeLProfileLength(
  row: SupportRow,
  mapping: TypeMapping | undefined,
  members: number,
): number {
  if (mapping && Object.keys(mapping.factors).length > 0) {
    // computeMappedTotal returns a string (formatted with up to 2dp); we
    // need the numeric value back so the caller can round it consistently.
    const raw = computeMappedTotal(row.lengths, mapping)
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : 0
  }
  if (members <= 0) return 0
  let total = 0
  let count = 0
  for (const k of ["a", "b", "c", "d", "e", "f"] as const) {
    if (count >= members) break
    const cell = String(row.lengths?.[k] ?? "").trim()
    if (!cell) continue
    const { total: t, segments } = parseLengthCellSegments(cell)
    total += t
    count += segments
  }
  return total
}

/** Resolve the type config for a row by matching typeName (case-insensitive,
 *  whitespace-trimmed). Returns null when the row's type isn't configured. */
function resolveTypeConfig(typeConfigs: SupportTypeConfig[], row: SupportRow): SupportTypeConfig | null {
  const t = String(row.type ?? "").trim().toLowerCase()
  if (!t) return null
  return typeConfigs.find((c) => c.typeName.trim().toLowerCase() === t) ?? null
}

/** Look up an item qty inside a type config. Picks the first item whose
 *  name matches `itemRe`.
 *
 *  When `combinedPredicate` is provided, the predicate is evaluated
 *  against the **item name + variant label** joined with a space, so
 *  the size / with-plate tokens are matched regardless of whether they
 *  live on the item name or the variant. That handles the three naming
 *  styles users commonly pick:
 *    - "STARTER BRACKET" + variants "50 With Plate" / "100 Without Plate"
 *    - "STARTER BRACKET-50" + variants "With Plate" / "Without Plate"
 *    - "STARTER BRACKET-50 With Plate" as a standalone item, no variants
 *  All three end up matching the same predicate.
 *
 *  When `combinedPredicate` is null (e.g. for NUT and BOLT), the item's
 *  top-level qty is returned; if absent, the variant qtys are summed
 *  so a user who modelled NUT with per-size variants still gets a
 *  meaningful number.
 *
 *  Falls back to row.itemQtys when nothing is found in the type config
 *  so legacy uploads still surface a value rather than going blank. */
function lookupItemQty(
  typeConfigs: SupportTypeConfig[],
  row: SupportRow,
  itemRe: RegExp,
  combinedPredicate: ((combined: string) => boolean) | null,
): number {
  const tc = resolveTypeConfig(typeConfigs, row)
  if (tc) {
    for (const item of tc.items) {
      if (!itemRe.test(item.itemName)) continue
      if (combinedPredicate) {
        // Try item name + each variant label as the combined string.
        if (item.variants && item.variants.length > 0) {
          for (const v of item.variants) {
            const combined = `${item.itemName} ${v.label}`
            if (combinedPredicate(combined)) {
              const n = parseFloat(String(v.qty ?? "").trim())
              if (Number.isFinite(n) && n > 0) return n
            }
          }
        }
        // Try the item name alone (standalone item without variants,
        // or as a fallback for variant-bearing items where the name
        // itself carries enough tokens to match — e.g. an item literally
        // called "STARTER BRACKET-50 WITH PLATE").
        if (combinedPredicate(item.itemName)) {
          const n = parseFloat(String(item.qty ?? "").trim())
          if (Number.isFinite(n) && n > 0) return n
        }
      } else {
        // NUT / BOLT path — no size/plate predicate to filter on.
        const topN = parseFloat(String(item.qty ?? "").trim())
        if (Number.isFinite(topN) && topN > 0) return topN
        // If the user modelled them with variants, sum the variant qtys.
        if (item.variants && item.variants.length > 0) {
          let sum = 0
          for (const v of item.variants) {
            const n = parseFloat(String(v.qty ?? "").trim())
            if (Number.isFinite(n) && n > 0) sum += n
          }
          if (sum > 0) return sum
        }
      }
    }
  }
  // Legacy fallback — only consulted when the type config didn't carry
  // a matching item. Same combined-string match against row.itemQtys.
  for (const [item, variants] of Object.entries(row.itemQtys ?? {})) {
    if (!itemRe.test(item)) continue
    for (const [variant, qty] of Object.entries(variants)) {
      if (combinedPredicate) {
        const combined = variant ? `${item} ${variant}` : item
        if (!combinedPredicate(combined)) continue
      }
      const n = parseFloat(String(qty).trim())
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return 0
}

const STARTER_BRACKET_RE = /starter[\s_-]*bracket/i
const CONNECTOR_RE = /connector/i
const L_ANGLE_ONLY_RE = /^\s*l[\s_-]*angle\s*$/i
const NUT_RE = /^\s*nut\s*$/i
const BOLT_RE = /^\s*bolt\s*$/i

const hasSize = (label: string, size: 50 | 100): boolean =>
  new RegExp(`(?:^|[^0-9])${size}(?:[^0-9]|$)`).test(label)
const hasWithoutPlate = (label: string): boolean => /without\s*plate/i.test(label)
const hasWithPlate = (label: string): boolean =>
  /with\s*plate/i.test(label) && !hasWithoutPlate(label)

interface RowMeta {
  starter50With: number
  starter50Without: number
  starter100With: number
  starter100Without: number
  conn50: number
  conn100: number
  lAngle: number
  nut: number
  bolt: number
}

/** Bolt counts from "Bolt details of external components" (drawing 033764
 *  SHT 0001). Two parts to the formula:
 *    - Flat additions (the L ANGLE U / V bolts that ship with every SB
 *      side once, regardless of how many SB pieces): 2 for the U-side
 *      when any SB-50 is present, 8 for the V-side when any SB-100 is
 *      present.
 *    - Per-bracket multipliers: 4 bolts for every SB-50 piece (with or
 *      without plate), 8 bolts for every SB-100 piece.
 *  NUT count mirrors BOLT in fabrication MTOs. Applied when the type
 *  config doesn't carry an explicit nutQty / boltQty override. */
const L_ANGLE_U_FLAT = 2
const L_ANGLE_V_FLAT = 8
const BOLTS_PER_SB_50 = 4
const BOLTS_PER_SB_100 = 8

/** Compute the BOLT / NUT cell value. The user-configured override (from
 *  the type editor's NUT qty / BOLT qty box) takes the place of the
 *  *flat* L ANGLE U/V addition only — it does NOT replace the per-piece
 *  SB multiplier. So config qty "2" with one SB-50 WoP = `2 + 1×4 = 6`,
 *  not just `2`. Empty config qty falls back to the drawing's default
 *  flats (2 when any SB-50 on the row, 8 when any SB-100). Returns
 *  null when there's no contribution at all and the caller should fall
 *  through to the legacy routed / item-lookup fallback. */
function computeBoltsCell(meta: RowMeta, override: string): number | null {
  const sb50 = (meta.starter50With || 0) + (meta.starter50Without || 0)
  const sb100 = (meta.starter100With || 0) + (meta.starter100Without || 0)
  const sbBolts = sb50 * BOLTS_PER_SB_50 + sb100 * BOLTS_PER_SB_100
  const trimmedOverride = override.trim()
  if (trimmedOverride !== "") {
    const n = parseFloat(trimmedOverride)
    const flat = Number.isFinite(n) ? n : 0
    return flat + sbBolts
  }
  const defaultFlat = (sb50 > 0 ? L_ANGLE_U_FLAT : 0) + (sb100 > 0 ? L_ANGLE_V_FLAT : 0)
  const total = defaultFlat + sbBolts
  return total > 0 ? total : null
}

function extractRowMeta(typeConfigs: SupportTypeConfig[], row: SupportRow): RowMeta {
  return {
    starter50With: lookupItemQty(typeConfigs, row, STARTER_BRACKET_RE, (v) => hasSize(v, 50) && hasWithPlate(v)),
    starter50Without: lookupItemQty(typeConfigs, row, STARTER_BRACKET_RE, (v) => hasSize(v, 50) && hasWithoutPlate(v)),
    starter100With: lookupItemQty(typeConfigs, row, STARTER_BRACKET_RE, (v) => hasSize(v, 100) && hasWithPlate(v)),
    starter100Without: lookupItemQty(typeConfigs, row, STARTER_BRACKET_RE, (v) => hasSize(v, 100) && hasWithoutPlate(v)),
    conn50: lookupItemQty(typeConfigs, row, CONNECTOR_RE, (v) => hasSize(v, 50)),
    conn100: lookupItemQty(typeConfigs, row, CONNECTOR_RE, (v) => hasSize(v, 100)),
    lAngle: lookupItemQty(typeConfigs, row, L_ANGLE_ONLY_RE, null),
    nut: lookupItemQty(typeConfigs, row, NUT_RE, null),
    bolt: lookupItemQty(typeConfigs, row, BOLT_RE, null),
  }
}

/** Decide which output column the row's L PROFILE total lands in.
 *  Supported routes (case-insensitive, whitespace-tolerant):
 *    - "50"      → L PROFILE-50
 *    - "100"     → L PROFILE-100
 *    - "L ANGLE" → L ANGLE column
 *    - "NUT"     → NUT column
 *    - "BOLT"    → BOLT column
 *    - "50/100"  → mixed; per-side values come from row.lProfile50/100
 *
 *  Explicit row.sbSize wins; otherwise the profile's flag values for
 *  the row's type drive it. Numeric values normalize so "100.0"
 *  matches "100". The flag values can be any of the route tokens
 *  above — when every populated flag for a TYPE points to the same
 *  destination, the computed total lands there. */
type LpRoute = "50" | "100" | "50/100" | "L ANGLE" | "NUT" | "BOLT"

/** Map a single flag / sbSize token to a route. Returns null when the
 *  token doesn't match any known route — caller decides the fallback. */
function flagToRoute(token: string): LpRoute | null {
  const t = token.trim()
  if (!t) return null
  if (/^50(\.0+)?$/.test(t)) return "50"
  if (/^100(\.0+)?$/.test(t)) return "100"
  if (/^l\s*angle$/i.test(t)) return "L ANGLE"
  if (/^nut$/i.test(t)) return "NUT"
  if (/^bolt$/i.test(t)) return "BOLT"
  return null
}

function inferSbSize(row: SupportRow, profile: ExternalTypeProfile | undefined): LpRoute {
  const explicit = String(row.sbSize ?? "").trim()
  if (/^50\s*\/\s*100$/.test(explicit) || (explicit.includes("/") && /50/.test(explicit) && /100/.test(explicit))) {
    return "50/100"
  }
  const explicitRoute = flagToRoute(explicit)
  if (explicitRoute) return explicitRoute
  if (!profile) return "50"
  const flags = [profile.flagA, profile.flagB, profile.flagC, profile.flagD, profile.flagE]
    .slice(0, Math.max(1, profile.members))
    .map((f) => f.trim())
    .filter((f) => f !== "")
  if (flags.length === 0) return "50"
  const flagRoutes = flags.map(flagToRoute)
  // If every populated flag maps to the same route, route the total there.
  // A type that mixes route kinds (e.g., one "50" and one "L ANGLE") falls
  // through to the legacy numeric-only logic below.
  if (flagRoutes.every((r) => r !== null)) {
    const first = flagRoutes[0]!
    if (flagRoutes.every((r) => r === first)) return first
  }
  // Legacy numeric mixed handling — when flags are all numeric and split
  // between 50 and 100, route as 50/100 so row.lProfile50/100 can fill
  // each side.
  const norm = (f: string) => {
    const n = parseFloat(f)
    return Number.isFinite(n) ? String(Math.round(n)) : f
  }
  const has100 = flags.some((f) => norm(f) === "100")
  const has50 = flags.some((f) => norm(f) === "50")
  if (has100 && has50) return "50/100"
  if (has100) return "100"
  return "50"
}

/* ────────────────────────── sheet builder ───────────────────────── */

// 26 columns after dropping DISCIPLINE from the rendered output. The
// row's `discipline` field is still recognised by parseExcel and stored
// on the SupportRow — we just don't render it here. Removing it from
// the schedule on user request (project page → External MTO Excel).
const COLUMN_COUNT = 26

function styleCell(ws: XLSX.WorkSheet, row: number, col: number, style: CellStyle): void {
  const ref = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = (ws[ref] as XLSX.CellObject | undefined) ?? { t: "s", v: "" }
  cell.s = style
  ;(ws as Record<string, unknown>)[ref] = cell
}

interface BuildSheetParams {
  rows: SupportRow[]
  profiles: Map<string, ExternalTypeProfile>
  typeConfigs: SupportTypeConfig[]
  mapping: ProjectMapping
  projectName: string
  hasLogo: boolean
}

function buildSheet({ rows, profiles, typeConfigs, mapping, projectName, hasLogo }: BuildSheetParams): XLSX.WorkSheet {
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
    { content: "SB SIZE", rowSpan: 2 },        // 3
    { content: "TYPE", rowSpan: 2 },           // 4
    { content: "LENGTH (mm)", colSpan: 6 },    // 5-10
    { content: "L PROFILE-50" },               // 11 (sub: S2N100L)
    { content: "L PROFILE-100" },              // 12 (sub: S2N200L)
    { content: "L ANGLE", rowSpan: 2 },        // 13
    { content: "STARTER BRACKET-50", colSpan: 2 },   // 14-15
    { content: "STARTER BRACKET-100", colSpan: 2 },  // 16-17
    { content: "L ANGLE (Connector)", colSpan: 2 }, // 18-19
    { content: "NUT", rowSpan: 2 },            // 20
    { content: "BOLT", rowSpan: 2 },           // 21
    { content: "ELEVATION", colSpan: 3 },      // 22-24
    { content: "REMARKS", rowSpan: 2 },        // 25
  ]

  // Row 2 sub-header (one entry per real column). Five empty slots for
  // the rowSpan-2 meta columns (SL NO, SUPPORT NO., DECK, SB SIZE,
  // TYPE) followed by the LENGTH leaves, then per-column subs.
  const head2: string[] = [
    "", "", "", "", "",
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
    const typeMapping = mapping[String(row.type ?? "").trim()]
    const sbSize = inferSbSize(row, profile)
    const meta = extractRowMeta(typeConfigs, row)
    // Per-type NUT / BOLT qty configured in the support-type editor.
    // When non-empty, these override anything the profile flag routing or
    // item lookup would otherwise place in the NUT / BOLT cells — they're
    // the user's explicit "this type always uses N nuts / M bolts" answer.
    const tc = resolveTypeConfig(typeConfigs, row)
    const configNutQty = String(tc?.nutQty ?? "").trim()
    const configBoltQty = String(tc?.boltQty ?? "").trim()

    let lp50: string | number = ""
    let lp100: string | number = ""
    let lAngleTotal: string | number = ""
    let nutRouted: string | number = ""
    let boltRouted: string | number = ""
    // Mapping factors (when present) drive the total; otherwise we fall
    // back to the profile's MEMBERS count.
    if (typeMapping || members > 0) {
      const computed = computeLProfileLength(row, typeMapping, members)
      if (computed > 0) {
        const rounded = roundDisplay(computed)
        if (sbSize === "50") lp50 = rounded
        else if (sbSize === "100") lp100 = rounded
        else if (sbSize === "L ANGLE") lAngleTotal = rounded
        else if (sbSize === "NUT") nutRouted = rounded
        else if (sbSize === "BOLT") boltRouted = rounded
        // sbSize === "50/100" — the per-side breakdown only comes from
        // the row's lProfile50/100 fields applied below; the computed
        // total alone can't say which side gets it.
      }
    }
    // Row-stored values override the computed value (UNIQUE / no-profile
    // path where the source sheet carries the value pre-summed).
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
    // DISCIPLINE column removed from the schedule. row.discipline is
    // still parsed from uploads and held on the SupportRow — just not
    // rendered into the External MTO Excel.
    // Display the inferred SB SIZE — the explicit row value when set,
    // otherwise the size implied by the profile's flag columns.
    cells.push(sbSize)
    cells.push(row.type ?? "")
    for (const k of ["a", "b", "c", "d", "e", "f"] as const) {
      cells.push(String(row.lengths?.[k] ?? ""))
    }
    cells.push(lp50)
    cells.push(lp100)
    // L ANGLE column: routed total wins over item qty (so a type whose
    // profile flag says "L ANGLE" displays the summed length here
    // rather than the configured L ANGLE item count).
    cells.push(lAngleTotal !== "" ? lAngleTotal : (meta.lAngle || ""))
    cells.push(meta.starter50With || "")
    cells.push(meta.starter50Without || "")
    cells.push(meta.starter100With || "")
    cells.push(meta.starter100Without || "")
    cells.push(meta.conn50 || "")
    cells.push(meta.conn100 || "")
    // NUT / BOLT columns. Order:
    //   1. Compute (override-or-default flat) + SB-50 × 4 + SB-100 × 8.
    //      The user-configured nutQty / boltQty REPLACES the flat 2/8
    //      L ANGLE U/V addition but does NOT replace the per-piece SB
    //      contribution — so override "2" on a row with one SB-50 WoP
    //      produces 2 + 4 = 6, not just 2.
    //   2. If the formula produced nothing (no override, no SB), fall
    //      back to L_ANGLE_PROFILE flag-routed total, then the legacy
    //      NUT / BOLT item lookup.
    const nutComputed = computeBoltsCell(meta, configNutQty)
    if (nutComputed !== null) {
      cells.push(nutComputed)
    } else {
      cells.push(nutRouted !== "" ? nutRouted : (meta.nut || ""))
    }
    const boltComputed = computeBoltsCell(meta, configBoltQty)
    if (boltComputed !== null) {
      cells.push(boltComputed)
    } else {
      cells.push(boltRouted !== "" ? boltRouted : (meta.bolt || ""))
    }
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

  // Column widths roughly tuned to the labels. 26 entries — the
  // DISCIPLINE width (14) used to sit between DECK and SB SIZE.
  const widths = [
    6, 18, 8, 8, 6,
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
  typeConfigs: SupportTypeConfig[],
  mapping: ProjectMapping,
  projectName?: string,
  logos?: PdfLogos,
): Promise<Blob> {
  const realRows = rows.filter(isRealRow)
  const profileMap = new Map(profiles.map((p) => [p.typeName.trim(), p]))
  const ws = buildSheet({
    rows: realRows,
    profiles: profileMap,
    typeConfigs,
    mapping,
    projectName: projectName ?? "",
    hasLogo: hasUsableLogo(logos),
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "External MTO")
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  return injectLogosIntoXlsx(blob, logos, COLUMN_COUNT)
}
