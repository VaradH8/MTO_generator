import { jsPDF } from "jspdf"
import autoTable, { type CellDef } from "jspdf-autotable"
import { LENGTH_KEYS } from "@/types/support"
import type { SupportRow, SupportTypeConfig, LengthKey, TypeMapping } from "@/types/support"
import { registerFonts, getFontNames } from "./pdfFonts"
import { computeMappedTotal } from "./parseMapping"

/** Per-project mapping (typeName → TypeMapping). Used to drive the row TOTAL
 *  via configured length factors and to mark mapping-required cells. Optional
 *  — when absent the legacy "sum of every length" total is rendered. */
export type ProjectMapping = Record<string, TypeMapping>

export function totalForRow(row: SupportRow, mapping: ProjectMapping | undefined): string {
  const m = mapping?.[row.type]
  return computeMappedTotal(row.lengths, m)
}

/** Round per the project's display rule: fractional part < 0.6 rounds DOWN
 *  (so 1.5 → 1, 1.55 → 1) and fractional part ≥ 0.6 rounds UP (1.6 → 2).
 *  Implemented via floor(x + 0.4 + ε) — the small epsilon compensates for
 *  IEEE-754: "0.6" is stored as 0.5999999999999999778…, which without the
 *  epsilon would land on floor(0.9999…) = 0 instead of 1.
 *  Sign-aware so negative values mirror the same boundary. */
export function roundDisplay(x: number): number {
  if (!Number.isFinite(x)) return x
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x)
  return sign * Math.floor(abs + 0.4 + 1e-9)
}

/** Render a numeric body cell with the project's rounding rule applied.
 *  Non-numeric strings (tag numbers, "CS+HDG", "", "Yes") are returned
 *  unchanged so we don't accidentally turn a hyphenated tag into a number.
 *  Used for length cells, the row TOTAL, and item-qty cells in both PDF
 *  renderers and the Excel exporter (via asNumberIfNumeric). */
export function displayNumeric(s: string): string {
  if (typeof s !== "string") return s
  const trimmed = s.trim()
  if (trimmed === "") return s
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return s
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return s
  return String(roundDisplay(n))
}

/** Identify rows that carry real measurement data, distinguishing them
 *  from placeholders left over by the upload pipeline. Pre-allocated
 *  rows can ship with `material` defaulted to "CS+HDG", `level` to "2",
 *  and an `slNo` filled in — none of which by themselves prove a real
 *  support entry. We only keep a row when one of these load-bearing
 *  fields has content:
 *    - tagNumber (canonical identifier)
 *    - remarks   (free-text the user explicitly wrote)
 *    - any length value
 *    - any item qty
 *  Type, material, level, and slNo alone do NOT qualify — they're
 *  default-populated and would otherwise let placeholder rows trail past
 *  the last real support in the rendered PDF/Excel.
 *
 *  Strictly a render-time filter: rows stay in the DB and on the
 *  editable on-screen support table, they're just not rendered into the
 *  schedule. */
export function isRealRow(row: SupportRow): boolean {
  if ((row.tagNumber ?? "").trim() !== "") return true
  if ((row.remarks ?? "").trim() !== "") return true
  for (const k of LENGTH_KEYS) {
    if (String(row.lengths?.[k] ?? "").trim() !== "") return true
  }
  for (const map of Object.values(row.itemQtys ?? {})) {
    for (const v of Object.values(map)) {
      if (String(v ?? "").trim() !== "") return true
    }
  }
  return false
}

const PRIMARY: [number, number, number] = [31, 60, 168]
const DARK: [number, number, number] = [13, 21, 48]
const MUTED: [number, number, number] = [74, 84, 120]
const BORDER: [number, number, number] = [201, 210, 228]

/** Meta columns before the LENGTH block. With Plate / Without Plate are
 *  derived per-row from the row's type config (one tick per type, not
 *  per item) — they render "Yes" or blank, never free text. */
export const PRE_LENGTH: { key: keyof SupportRow | "withPlate" | "withoutPlate"; label: string }[] = [
  { key: "slNo", label: "SL NO" },
  { key: "level", label: "LEVEL" },
  { key: "tagNumber", label: "TAG NUMBER" },
  { key: "type", label: "TYPE" },
  { key: "material", label: "MATERIAL" },
  { key: "withPlate", label: "WITH PLATE" },
  { key: "withoutPlate", label: "WITHOUT PLATE" },
]

/** Page-margin minimums. Reduced from 14mm to 5mm to claim back ~18mm of
 *  horizontal space — every millimetre matters when the combined PDF is
 *  trying to fit ~33 columns on A3 landscape. */
const PAGE_MARGIN_MM = 5

/** Body / header font sizes. Smaller than the original 6.5/6pt so a 25-char
 *  item header like "OPEN L (CS+HDG-S2N2602C)" fits on one line in a column
 *  that's only ~24mm wide. At 4pt header font ~0.84mm/char, 25 chars need
 *  ~21mm — comfortably inside a 24mm column with 0.7mm padding each side. */
const HEADER_FONT_PT = 4.0
const BODY_FONT_PT = 5.0

/** Pinned mm widths for the seven PRE_LENGTH meta columns. Sized so the
 *  longest header in each column ("WITHOUT PLATE", "WITH PLATE", "TAG
 *  NUMBER") fits on a single line at the header font size, and so the
 *  body text inside ("240-S2N-L1-1016", "CS+HDG", "Yes"/"") fits at the
 *  body font size. The previous [7, 7, 22, 7, 13, 9, 9] left "WITHOUT
 *  PLATE" 13 chars trying to live in 9mm — guaranteed wrap. */
const META_COL_WIDTHS_MM = [7, 8, 22, 7, 13, 13, 16] as const
/** Width pinned per length column (A, B, C, …). 8mm + the tighter
 *  cellPadding below give roughly 6.8mm of usable text width — enough to
 *  fit a 6-7 char decimal value like "1573.0" or "3870.50" at 5pt body
 *  font without wrapping. */
const LENGTH_COL_WIDTH_MM = 8
const TOTAL_COL_WIDTH_MM = 12
const REMARKS_COL_WIDTH_MM = 12
/** Inner padding (mm) applied to every body and header cell. Tight values
 *  let a 4pt header label like "WITHOUT PLATE" claim almost the entire
 *  cell width — anything bigger and the text wraps even when the cell
 *  would otherwise have room. */
const BODY_CELL_PADDING_MM = 0.6
const HEAD_CELL_PADDING_MM = 0.7
/** Item columns share whatever horizontal space is left after meta + length
 *  + total + remarks are pinned. Bounded so a project with very few item
 *  columns doesn't get absurdly wide cells, and so a project with many
 *  doesn't squeeze them past readability. */
const ITEM_COL_MIN_MM = 14
const ITEM_COL_MAX_MM = 38

/** Compute item-column width given the available page width and the rest of
 *  the table's pinned widths. Centralised so both renderers agree on the
 *  geometry — divergence here causes one renderer's table to overflow the
 *  page while the other fits. */
function computeItemColWidth(
  pageWidth: number,
  marginMm: number,
  activeLengthCount: number,
  itemColCount: number,
): number {
  if (itemColCount <= 0) return ITEM_COL_MIN_MM
  const usable = pageWidth - 2 * marginMm
  const fixed =
    META_COL_WIDTHS_MM.reduce((a, b) => a + b, 0)
    + activeLengthCount * LENGTH_COL_WIDTH_MM
    + TOTAL_COL_WIDTH_MM
    + REMARKS_COL_WIDTH_MM
  const remaining = Math.max(0, usable - fixed)
  const ideal = remaining / itemColCount
  return Math.max(ITEM_COL_MIN_MM, Math.min(ITEM_COL_MAX_MM, ideal))
}

/** Build the autoTable `columnStyles` map for one render. Pins meta, length,
 *  TOTAL, item, and REMARKS columns to mm widths so autoTable never falls
 *  back to its content-fit algorithm — that algorithm is what produced the
 *  squished 1-3mm cells in earlier renders. */
function buildColumnStyles(
  activeLengthCount: number,
  itemColCount: number,
  itemColWidthMm: number,
): Record<number, { cellWidth: number }> {
  const out: Record<number, { cellWidth: number }> = {}
  let idx = 0
  for (const w of META_COL_WIDTHS_MM) { out[idx++] = { cellWidth: w } }
  for (let i = 0; i < activeLengthCount; i++) { out[idx++] = { cellWidth: LENGTH_COL_WIDTH_MM } }
  out[idx++] = { cellWidth: TOTAL_COL_WIDTH_MM }
  for (let i = 0; i < itemColCount; i++) { out[idx++] = { cellWidth: itemColWidthMm } }
  out[idx++] = { cellWidth: REMARKS_COL_WIDTH_MM }
  return out
}

/** Resolve the type-level plate quantities for a row by matching its type +
 *  classification against the project's typeConfigs. Falls back to a
 *  classification-agnostic match, then to empty strings (column blank). */
export function platesForType(typeConfigs: SupportTypeConfig[], row: SupportRow): { withPlate: string; withoutPlate: string } {
  const t = row.type.trim().toLowerCase()
  const cls = row.classification ?? "internal"
  const tc =
    typeConfigs.find((c) => c.typeName.trim().toLowerCase() === t && (c.classification ?? "internal") === cls) ||
    typeConfigs.find((c) => c.typeName.trim().toLowerCase() === t)
  if (!tc) return { withPlate: "", withoutPlate: "" }
  return { withPlate: tc.withPlate ?? "", withoutPlate: tc.withoutPlate ?? "" }
}

export interface ItemColumn {
  itemName: string
  /** Variant label, or empty string for non-variant items. */
  variantLabel: string
}

/** Variant dedupe key — trims whitespace + lowercases so "Z", " Z " and "z"
 *  collapse into one column instead of creating parallel ones. */
export function normVariant(label: string): string {
  return label.trim().toLowerCase()
}

/** Master/project configs sometimes carry variant items as separate
 *  standalone entries — "L ANGLE (VARIANT Z)", "L ANGLE (VARIANT S)" — alongside
 *  a parent "L ANGLE" definition that has its own variants. Without
 *  reshaping, those siblings render as their own columns and the user
 *  ends up with three L ANGLE-flavoured columns instead of one.
 *
 *  Returns { parent, variant } when the item name ends with "(VARIANT XXX)"
 *  (case-insensitive, whitespace tolerant), or null otherwise. Callers
 *  treat the matched item as a variant of `parent` with label `variant`. */
const VARIANT_SUFFIX_RE = /^(.+?)\s*\(\s*VARIANT\s+(.+?)\s*\)\s*$/i
export function reshapeVariantSuffix(itemName: string): { parent: string; variant: string } | null {
  const m = itemName.match(VARIANT_SUFFIX_RE)
  if (!m) return null
  return { parent: m[1].trim(), variant: m[2].trim() }
}

/** Pick the dominant non-empty material across the rendered rows. Returns ""
 *  when every row's material is blank. Used to label the item-column headers
 *  with "ITEM (MATERIAL-MODEL)" — material is per-row in the data model but
 *  in practice every project sticks with one (e.g. CS+HDG), so a single
 *  representative value is sufficient. Ties break on most-frequent, then
 *  first-seen. */
export function dominantMaterial(rows: SupportRow[]): string {
  const counts = new Map<string, number>()
  let best = ""
  let bestCount = 0
  for (const r of rows) {
    const m = (r.material ?? "").trim()
    if (!m) continue
    const next = (counts.get(m) ?? 0) + 1
    counts.set(m, next)
    if (next > bestCount) { best = m; bestCount = next }
  }
  return best
}

/** Build per-itemName model strings for the header (variant items get one
 *  model per variant label; non-variant items get one model under "" key).
 *  Keeps only the FIRST non-empty model encountered per slot — joining
 *  every distinct model from every type config used to produce header
 *  strings like "L ANGLE (CS+HDG-S2N2501C, S2N3501C, S2N4501C)" that wrapped
 *  to multiple lines and made the table unreadable. First-seen is
 *  deterministic given the configured-types order, which is the same order
 *  the user sees in Settings, so the rendered model is predictable. */
export function buildItemModels(typeConfigs: SupportTypeConfig[]): {
  parent: Map<string, string>
  variant: Map<string, Map<string, string>>
} {
  const parent = new Map<string, string>()
  const variant = new Map<string, Map<string, string>>()
  for (const tc of typeConfigs) {
    for (const item of tc.items) {
      // Same suffix reshape as buildItemColumns — keeps the model
      // attribution aligned with the rendered column structure.
      const reshape = reshapeVariantSuffix(item.itemName)
      if (reshape) {
        let inner = variant.get(reshape.parent)
        if (!inner) { inner = new Map(); variant.set(reshape.parent, inner) }
        const key = normVariant(reshape.variant)
        if (!inner.has(key)) {
          const m = (item.model || "").trim()
          if (m) inner.set(key, m)
        }
        continue
      }
      if (item.variants && item.variants.length > 0) {
        let inner = variant.get(item.itemName)
        if (!inner) { inner = new Map(); variant.set(item.itemName, inner) }
        for (const v of item.variants) {
          const key = normVariant(v.label)
          if (inner.has(key)) continue
          const m = (v.model || item.model || "").trim()
          if (m) inner.set(key, m)
        }
      } else {
        if (parent.has(item.itemName)) continue
        const m = (item.model || "").trim()
        if (m) parent.set(item.itemName, m)
      }
    }
  }
  return { parent, variant }
}

/** Compose the header text for an item or its variant subcolumn. */
export function composeHeader(name: string, parts: string[]): string {
  const tail = parts.map((p) => p.trim()).filter(Boolean).join("-")
  return tail ? `${name} (${tail})` : name
}

/**
 * Union across all configured types, preserving first-seen ordering.
 *
 * Two correctness rules that stop stray columns from showing up in the PDF:
 *  1. Variants dedupe case-insensitively so "Z" and "z" from two type configs
 *     don't become two side-by-side columns.
 *  2. If an item has any named variant in any type config, its empty-label
 *     ("no variants") entry from other configs is dropped. Without this,
 *     defining L ANGLE with variants Z,S in one type and without variants
 *     in another type produces a blank column sitting before Z and S.
 */
export function buildItemColumns(typeConfigs: SupportTypeConfig[]): ItemColumn[] {
  // Pass 1 — collect, per itemName, the ordered list of normalized variant
  // keys and their first-seen display label.
  type Entry = { order: string[]; display: Map<string, string> }
  const byItem = new Map<string, Entry>()
  const itemOrder: string[] = []

  const note = (itemName: string, label: string) => {
    const norm = normVariant(label)
    let entry = byItem.get(itemName)
    if (!entry) {
      entry = { order: [], display: new Map() }
      byItem.set(itemName, entry)
      itemOrder.push(itemName)
    }
    if (!entry.display.has(norm)) {
      entry.display.set(norm, label)
      entry.order.push(norm)
    }
  }

  for (const tc of typeConfigs) {
    for (const item of tc.items) {
      // Items literally named "L ANGLE (VARIANT Z)" get folded into the
      // parent "L ANGLE" as variant Z, so they share a colSpan'd parent
      // header with siblings instead of standing alone in their own column.
      const reshape = reshapeVariantSuffix(item.itemName)
      if (reshape) {
        note(reshape.parent, reshape.variant)
        continue
      }
      if (item.variants && item.variants.length > 0) {
        for (const v of item.variants) note(item.itemName, v.label)
      } else {
        note(item.itemName, "")
      }
    }
  }

  // Pass 2 — emit qty columns, skipping the empty-label variant for any
  // item that also has at least one named variant. No plate sub-columns —
  // With Plate / Without Plate are now row-level fields in PRE_LENGTH.
  const cols: ItemColumn[] = []
  for (const itemName of itemOrder) {
    const entry = byItem.get(itemName)!
    const hasNamed = entry.order.some((n) => n !== "")
    for (const norm of entry.order) {
      if (hasNamed && norm === "") continue
      cols.push({ itemName, variantLabel: entry.display.get(norm)! })
    }
  }
  return cols
}

/** Pull a value from row.itemQtys honoring case-insensitive variant match —
 *  so a row stored under "Z" still lands in the column labeled "z" (or vice
 *  versa) instead of looking empty in the PDF.
 *
 *  `isPrimary` means this is the first variant column for the item in the
 *  PDF (e.g. "Z" under L ANGLE when the variants are [Z, S]). Rows uploaded
 *  under a type whose L ANGLE config has no variants end up with a single
 *  value stored under the empty string key ({ "": "2" }). To keep those
 *  values visible we let them render in the primary variant column so a
 *  Z-only support shows "2" under Z and blank under S — not blank under
 *  both. Secondary variant columns never consume the empty-key value,
 *  otherwise the same number would duplicate across every sub-column. */
export function readItemValue(row: SupportRow, itemName: string, variantLabel: string, isPrimary = false): string {
  const map = row.itemQtys?.[itemName]
  if (map) {
    const direct = map[variantLabel]
    if (direct !== undefined && direct !== "") return direct
    const target = normVariant(variantLabel)
    for (const [k, v] of Object.entries(map)) {
      if (normVariant(k) === target && v !== undefined && v !== "") return v
    }
    if (isPrimary) {
      const emptyVal = map[""]
      if (emptyVal !== undefined && emptyVal !== "") return emptyVal
    }
  }
  // Variant-suffix fallback. The column is labelled "L ANGLE" / "Z" because
  // buildItemColumns reshaped a "L ANGLE (VARIANT Z)" item into a variant
  // of "L ANGLE" — but the row data was generated from an upload whose
  // Excel column header was the original "L ANGLE (VARIANT Z)" string, so
  // the qty lives at row.itemQtys["L ANGLE (VARIANT Z)"][""]. Without this
  // fallback the merged column would render empty for those rows.
  if (variantLabel) {
    const itemTarget = itemName.trim().toLowerCase()
    const variantTarget = normVariant(variantLabel)
    for (const [k, m] of Object.entries(row.itemQtys ?? {})) {
      const r = reshapeVariantSuffix(k)
      if (!r) continue
      if (r.parent.trim().toLowerCase() !== itemTarget) continue
      if (normVariant(r.variant) !== variantTarget) continue
      const emptyVal = m[""]
      if (emptyVal !== undefined && emptyVal !== "") return emptyVal
      for (const v of Object.values(m)) {
        if (v !== undefined && v !== "") return v
      }
    }
  }
  return ""
}

/** Highest length letter (a..p) that has any non-empty value across the given rows. */
export function maxLengthKey(rows: SupportRow[]): LengthKey {
  let maxIdx = 0
  for (const row of rows) {
    for (let i = LENGTH_KEYS.length - 1; i >= 0; i--) {
      const v = row.lengths[LENGTH_KEYS[i]]
      if (v != null && String(v).trim() !== "") {
        if (i > maxIdx) maxIdx = i
        break
      }
    }
  }
  // Always show at least A..D so the table doesn't look too bare
  return LENGTH_KEYS[Math.max(maxIdx, 3)]
}

/** Two optional logos rendered at the top corners of every PDF. Both are
 *  base64 data URLs (image/png, image/jpeg, image/webp). If either is falsy
 *  that corner stays blank — there is no built-in fallback image. */
export interface PdfLogos {
  left?: string
  right?: string
}

/** Derive the jsPDF format argument from a data URL mime type. */
function logoFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  const mime = dataUrl.slice(5).split(";")[0]?.toLowerCase() ?? ""
  if (mime === "image/jpeg" || mime === "image/jpg") return "JPEG"
  if (mime === "image/webp") return "WEBP"
  return "PNG"
}

/** Looks like a usable image data URL (data:image/...;base64,...) and is long
 *  enough to actually contain bytes. Filters out the `0` / empty-string /
 *  malformed values that historically slipped past `if (logos.left)`. */
function isUsableLogo(s: unknown): s is string {
  return typeof s === "string" && s.length > 32 && s.startsWith("data:image/")
}

/** Add both corner logos to whatever is currently the active page. Safe to
 *  call inside autoTable's didDrawPage so each overflow page keeps them.
 *  jsPDF.addImage failures are surfaced via console.warn — silent failure
 *  was the reason a missing logo was so hard to diagnose previously. */
function drawLogos(doc: jsPDF, logos: PdfLogos | undefined, pw: number, mx: number): void {
  if (!logos) return
  const y = 5
  const w = 20
  const h = 14
  if (isUsableLogo(logos.left)) {
    try { doc.addImage(logos.left, logoFormat(logos.left), mx, y, w, h, undefined, "FAST") }
    catch (e) { console.warn("[generatePDF] left logo addImage failed:", e) }
  }
  if (isUsableLogo(logos.right)) {
    try { doc.addImage(logos.right, logoFormat(logos.right), pw - mx - w, y, w, h, undefined, "FAST") }
    catch (e) { console.warn("[generatePDF] right logo addImage failed:", e) }
  }
}

interface RenderSectionParams {
  doc: jsPDF
  fonts: { display: string; body: string }
  type: string
  rows: SupportRow[]
  projectName?: string
  typeConfigs: SupportTypeConfig[]
  logos?: PdfLogos
  /** Optional subtitle override (e.g. "Selected rows · 12 supports"). */
  subtitleOverride?: string
  /** Per-type mapping that drives the TOTAL value via length factors. */
  mapping?: ProjectMapping
}

function renderTypeSection(params: RenderSectionParams): void {
  const { doc, fonts, type, rows: rawRows, projectName, typeConfigs, logos, subtitleOverride, mapping } = params
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = PAGE_MARGIN_MM

  // Drop pre-allocated empty rows so the table ends exactly where the data
  // does instead of trailing 0/blank pad rows past the last real support.
  const rows = rawRows.filter(isRealRow)

  const lastLength = maxLengthKey(rows)
  const lastLengthIdx = LENGTH_KEYS.indexOf(lastLength)
  const activeLengths = LENGTH_KEYS.slice(0, lastLengthIdx + 1)

  const typesInRows = new Set(rows.map((r) => r.type.trim().toLowerCase()).filter(Boolean))
  const scopedConfigs = typeConfigs.filter((tc) => typesInRows.has(tc.typeName.trim().toLowerCase()))
  const activeConfigs = scopedConfigs.length > 0 ? scopedConfigs : typeConfigs
  const itemCols = buildItemColumns(activeConfigs)
  const models = buildItemModels(activeConfigs)
  const material = dominantMaterial(rows)

  const itemGroups: { itemName: string; variantLabels: string[] }[] = []
  for (const ic of itemCols) {
    const existing = itemGroups.find((g) => g.itemName === ic.itemName)
    if (existing) existing.variantLabels.push(ic.variantLabel)
    else itemGroups.push({ itemName: ic.itemName, variantLabels: [ic.variantLabel] })
  }

  const headStyles = {
    fillColor: PRIMARY,
    textColor: [255, 255, 255] as [number, number, number],
    fontSize: 6,
    fontStyle: "bold" as const,
    halign: "center" as const,
    valign: "middle" as const,
  }

  const headRow1: CellDef[] = []
  const headRow2: CellDef[] = []

  for (const c of PRE_LENGTH) {
    headRow1.push({ content: c.label, rowSpan: 2, styles: headStyles })
  }
  headRow1.push({ content: "LENGTH (mm)", colSpan: activeLengths.length, styles: headStyles })
  for (const k of activeLengths) headRow2.push({ content: k.toUpperCase(), styles: headStyles })
  headRow1.push({ content: "TOTAL", rowSpan: 2, styles: headStyles })

  // Item headers carry the material + model so cells stay clean (just qty).
  // Variant items: parent header is just ITEM, each variant subcolumn owns
  // the full MATERIAL-MODEL so a row reading "Z" or "S" gets the same
  // context as a non-variant column header.
  for (const g of itemGroups) {
    const isVariant = g.variantLabels.length > 1 || (g.variantLabels.length === 1 && g.variantLabels[0] !== "")
    const upper = g.itemName.toUpperCase()
    if (isVariant) {
      headRow1.push({ content: upper, colSpan: g.variantLabels.length, styles: headStyles })
      const variantModels = models.variant.get(g.itemName)
      for (const label of g.variantLabels) {
        const model = variantModels?.get(normVariant(label)) ?? ""
        headRow2.push({ content: composeHeader(label, [material, model]), styles: headStyles })
      }
    } else {
      const model = models.parent.get(g.itemName) ?? ""
      headRow1.push({ content: composeHeader(upper, [material, model]), rowSpan: 2, styles: headStyles })
    }
  }

  headRow1.push({ content: "REMARKS", rowSpan: 2, styles: headStyles })

  // First column seen for each item — lets rows whose itemQtys store a value
  // under "" (no-variant config) render it under the leading variant column
  // (e.g. Z for L ANGLE) instead of vanishing.
  const primaryCol = new Set<string>()
  {
    const seenItems = new Set<string>()
    for (const ic of itemCols) {
      if (seenItems.has(ic.itemName)) continue
      seenItems.add(ic.itemName)
      primaryCol.add(`${ic.itemName}::${ic.variantLabel}`)
    }
  }

  const body = rows.map((row) => {
    const cells: string[] = []
    const flags = platesForType(activeConfigs, row)
    for (const c of PRE_LENGTH) {
      if (c.key === "withPlate") cells.push(flags.withPlate || "")
      else if (c.key === "withoutPlate") cells.push(flags.withoutPlate || "")
      else cells.push(String((row as unknown as Record<string, unknown>)[c.key] ?? ""))
    }
    for (const k of activeLengths) cells.push(displayNumeric(String(row.lengths[k] ?? "")))
    cells.push(displayNumeric(totalForRow(row, mapping)))
    for (const ic of itemCols) {
      const isPrimary = primaryCol.has(`${ic.itemName}::${ic.variantLabel}`)
      cells.push(displayNumeric(readItemValue(row, ic.itemName, ic.variantLabel, isPrimary)))
    }
    cells.push(String(row.remarks ?? ""))
    return cells
  })

  // Top accent bar
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pw, 3, "F")

  drawLogos(doc, logos, pw, mx)

  // Title + subtitle centered so both corner logos can breathe.
  doc.setFont(fonts.display, "bold")
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(`Support Schedule — ${type}`, pw / 2, 11, { align: "center" })

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const subtitle = subtitleOverride ?? `${projectName ? `${projectName} | ` : ""}${rows.length} supports`
  doc.text(subtitle, pw / 2, 17, { align: "center" })

  const itemColWidth = computeItemColWidth(pw, mx, activeLengths.length, itemCols.length)

  autoTable(doc, {
    startY: 24,
    head: [headRow1, headRow2],
    body,
    styles: {
      fontSize: BODY_FONT_PT,
      cellPadding: BODY_CELL_PADDING_MM,
      font: fonts.body,
      textColor: DARK,
      lineColor: BORDER,
      lineWidth: 0.15,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      fontSize: HEADER_FONT_PT,
      font: fonts.display,
      fontStyle: "bold",
      cellPadding: HEAD_CELL_PADDING_MM,
    },
    // Every column is pinned with an explicit width — no content-based fit
    // anywhere — so headers and body never get squeezed into a wrap.
    columnStyles: buildColumnStyles(activeLengths.length, itemCols.length, itemColWidth),
    alternateRowStyles: { fillColor: [250, 251, 254] },
    theme: "grid",
    margin: { left: mx, right: mx, top: 24, bottom: 8 },
    // Redraw the page chrome (accent bars + logos + footer) on every page
    // including overflow ones so logos stay branded top to bottom — matches
    // renderFlatTable, where this was previously the only place it ran.
    didDrawPage: () => {
      doc.setFillColor(...PRIMARY)
      doc.rect(0, 0, pw, 3, "F")
      doc.setFillColor(...PRIMARY)
      doc.rect(0, ph - 3, pw, 3, "F")
      drawLogos(doc, logos, pw, mx)
      doc.setFont(fonts.body, "normal")
      doc.setFontSize(6)
      doc.setTextColor(...MUTED)
      doc.text("Support MTO Generator", mx, ph - 5)
      doc.text(`Generated ${new Date().toLocaleDateString("en-US")}`, pw - mx, ph - 5, { align: "right" })
    },
  })
}

interface RenderFlatParams {
  doc: jsPDF
  fonts: { display: string; body: string }
  title: string
  subtitle: string
  rows: SupportRow[]
  typeConfigs: SupportTypeConfig[]
  logos?: PdfLogos
  /** Per-type mapping that drives the TOTAL value via length factors. */
  mapping?: ProjectMapping
}

/**
 * Single continuous table across every row regardless of type. The column set
 * is the UNION of all length letters that appear and all item columns from the
 * provided typeConfigs, so rows whose type doesn't use a given column just
 * render an empty cell. autoTable handles pagination on its own.
 */
function renderFlatTable(params: RenderFlatParams): void {
  const { doc, fonts, title, subtitle, rows: rawRows, typeConfigs, logos, mapping } = params
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = PAGE_MARGIN_MM

  // Drop pre-allocated empty rows so the table ends exactly where the data
  // does. See renderTypeSection for the same filter.
  const rows = rawRows.filter(isRealRow)

  const lastLength = maxLengthKey(rows)
  const lastLengthIdx = LENGTH_KEYS.indexOf(lastLength)
  const activeLengths = LENGTH_KEYS.slice(0, lastLengthIdx + 1)

  // Union of item columns across every configured type — mixed-type rows need
  // the full column set so each row can fill in just its own items.
  const itemCols = buildItemColumns(typeConfigs)
  const models = buildItemModels(typeConfigs)
  const material = dominantMaterial(rows)

  const itemGroups: { itemName: string; variantLabels: string[] }[] = []
  for (const ic of itemCols) {
    const existing = itemGroups.find((g) => g.itemName === ic.itemName)
    if (existing) existing.variantLabels.push(ic.variantLabel)
    else itemGroups.push({ itemName: ic.itemName, variantLabels: [ic.variantLabel] })
  }

  const headStyles = {
    fillColor: PRIMARY,
    textColor: [255, 255, 255] as [number, number, number],
    fontSize: 6,
    fontStyle: "bold" as const,
    halign: "center" as const,
    valign: "middle" as const,
  }

  const headRow1: CellDef[] = []
  const headRow2: CellDef[] = []

  for (const c of PRE_LENGTH) {
    headRow1.push({ content: c.label, rowSpan: 2, styles: headStyles })
  }
  headRow1.push({ content: "LENGTH (mm)", colSpan: activeLengths.length, styles: headStyles })
  for (const k of activeLengths) headRow2.push({ content: k.toUpperCase(), styles: headStyles })
  headRow1.push({ content: "TOTAL", rowSpan: 2, styles: headStyles })

  for (const g of itemGroups) {
    const isVariant = g.variantLabels.length > 1 || (g.variantLabels.length === 1 && g.variantLabels[0] !== "")
    const upper = g.itemName.toUpperCase()
    if (isVariant) {
      headRow1.push({ content: upper, colSpan: g.variantLabels.length, styles: headStyles })
      const variantModels = models.variant.get(g.itemName)
      for (const label of g.variantLabels) {
        const model = variantModels?.get(normVariant(label)) ?? ""
        headRow2.push({ content: composeHeader(label, [material, model]), styles: headStyles })
      }
    } else {
      const model = models.parent.get(g.itemName) ?? ""
      headRow1.push({ content: composeHeader(upper, [material, model]), rowSpan: 2, styles: headStyles })
    }
  }

  headRow1.push({ content: "REMARKS", rowSpan: 2, styles: headStyles })

  // See renderTypeSection — same primary-variant promotion so rows that
  // only have a "" entry under the item still land in the first column.
  const primaryCol = new Set<string>()
  {
    const seenItems = new Set<string>()
    for (const ic of itemCols) {
      if (seenItems.has(ic.itemName)) continue
      seenItems.add(ic.itemName)
      primaryCol.add(`${ic.itemName}::${ic.variantLabel}`)
    }
  }

  const body = rows.map((row) => {
    const cells: string[] = []
    const flags = platesForType(typeConfigs, row)
    for (const c of PRE_LENGTH) {
      if (c.key === "withPlate") cells.push(flags.withPlate || "")
      else if (c.key === "withoutPlate") cells.push(flags.withoutPlate || "")
      else cells.push(String((row as unknown as Record<string, unknown>)[c.key] ?? ""))
    }
    for (const k of activeLengths) cells.push(displayNumeric(String(row.lengths[k] ?? "")))
    cells.push(displayNumeric(totalForRow(row, mapping)))
    for (const ic of itemCols) {
      const isPrimary = primaryCol.has(`${ic.itemName}::${ic.variantLabel}`)
      cells.push(displayNumeric(readItemValue(row, ic.itemName, ic.variantLabel, isPrimary)))
    }
    cells.push(String(row.remarks ?? ""))
    return cells
  })

  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pw, 3, "F")

  drawLogos(doc, logos, pw, mx)

  doc.setFont(fonts.display, "bold")
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(title, pw / 2, 11, { align: "center" })

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(subtitle, pw / 2, 17, { align: "center" })

  const itemColWidth = computeItemColWidth(pw, mx, activeLengths.length, itemCols.length)

  autoTable(doc, {
    startY: 24,
    head: [headRow1, headRow2],
    body,
    styles: {
      fontSize: BODY_FONT_PT,
      cellPadding: BODY_CELL_PADDING_MM,
      font: fonts.body,
      textColor: DARK,
      lineColor: BORDER,
      lineWidth: 0.15,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      fontSize: HEADER_FONT_PT,
      font: fonts.display,
      fontStyle: "bold",
      cellPadding: HEAD_CELL_PADDING_MM,
    },
    // Same per-column pinning as renderTypeSection.
    columnStyles: buildColumnStyles(activeLengths.length, itemCols.length, itemColWidth),
    alternateRowStyles: { fillColor: [250, 251, 254] },
    theme: "grid",
    margin: { left: mx, right: mx, top: 24, bottom: 8 },
    // Redraw the page chrome (accent bars + footer) on every new page that
    // autoTable creates as the table overflows.
    didDrawPage: () => {
      doc.setFillColor(...PRIMARY)
      doc.rect(0, 0, pw, 3, "F")
      doc.setFillColor(...PRIMARY)
      doc.rect(0, ph - 3, pw, 3, "F")
      drawLogos(doc, logos, pw, mx)
      doc.setFont(fonts.body, "normal")
      doc.setFontSize(6)
      doc.setTextColor(...MUTED)
      doc.text("Support MTO Generator", mx, ph - 5)
      doc.text(`Generated ${new Date().toLocaleDateString("en-US")}`, pw - mx, ph - 5, { align: "right" })
    },
  })
}

export async function generatePDF(
  type: string,
  rows: SupportRow[],
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  logos?: PdfLogos,
  mapping?: ProjectMapping,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })
  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)

  renderTypeSection({ doc, fonts, type, rows, projectName, typeConfigs, logos, mapping })

  return doc.output("blob")
}

/**
 * Combined PDF: every row from every type merged into ONE continuous table.
 * autoTable paginates automatically across as many pages as needed. Rows are
 * ordered by type (grouped) so the combined sheet stays readable.
 */
export async function generateCombinedPDF(
  grouped: Record<string, SupportRow[]>,
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  logos?: PdfLogos,
  mapping?: ProjectMapping,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })
  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)

  const allRows: SupportRow[] = []
  const typesUsed: string[] = []
  for (const [type, rows] of Object.entries(grouped)) {
    // Skip type buckets that contain no real (non-placeholder) rows so a
    // type whose only rows are empty pre-allocations doesn't pollute the
    // subtitle's "X types: …" list.
    if (!rows.some(isRealRow)) continue
    typesUsed.push(type)
    for (const r of rows) {
      if (!isRealRow(r)) continue
      allRows.push(r)
    }
  }

  const subtitle = [
    projectName,
    `${allRows.length} supports`,
    typesUsed.length > 0 ? `${typesUsed.length} type${typesUsed.length !== 1 ? "s" : ""}: ${typesUsed.join(", ")}` : null,
  ].filter(Boolean).join(" | ")

  renderFlatTable({
    doc,
    fonts,
    title: "Support Schedule — Combined",
    subtitle,
    rows: allRows,
    typeConfigs,
    logos,
    mapping,
  })

  return doc.output("blob")
}

/**
 * Build a PDF for an explicit set of rows (e.g. user selection). Rendered as
 * a single continuous table — one heading, one body, autoTable paginates.
 */
export async function generateSelectionPDF(
  rows: SupportRow[],
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  logos?: PdfLogos,
  mapping?: ProjectMapping,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })
  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)

  // Filter to real rows for the subtitle counts so a selection that
  // captured a few placeholder rows doesn't inflate the headline.
  const realSelection = rows.filter(isRealRow)
  const typesUsed = Array.from(new Set(realSelection.map((r) => r.type).filter(Boolean)))
  const subtitle = [
    projectName,
    `Selected · ${realSelection.length} supports`,
    typesUsed.length > 0 ? typesUsed.join(", ") : null,
  ].filter(Boolean).join(" | ")

  // Keep same-type rows adjacent while preserving their original order.
  const buckets: Record<string, SupportRow[]> = {}
  for (const r of rows) {
    const t = r.type || "Unknown"
    if (!buckets[t]) buckets[t] = []
    buckets[t].push(r)
  }
  const ordered: SupportRow[] = []
  for (const rs of Object.values(buckets)) ordered.push(...rs)

  renderFlatTable({
    doc,
    fonts,
    title: "Support Schedule — Selection",
    subtitle,
    rows: ordered,
    typeConfigs,
    logos,
    mapping,
  })

  return doc.output("blob")
}
