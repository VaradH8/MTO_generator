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

function totalForRow(row: SupportRow, mapping: ProjectMapping | undefined): string {
  const m = mapping?.[row.type]
  return computeMappedTotal(row.lengths, m)
}

const PRIMARY: [number, number, number] = [31, 60, 168]
const DARK: [number, number, number] = [13, 21, 48]
const MUTED: [number, number, number] = [74, 84, 120]
const BORDER: [number, number, number] = [201, 210, 228]

/** Meta columns before the LENGTH block. With Plate / Without Plate are
 *  derived per-row from the row's type config (one tick per type, not
 *  per item) — they render "Yes" or blank, never free text. */
const PRE_LENGTH: { key: keyof SupportRow | "withPlate" | "withoutPlate"; label: string }[] = [
  { key: "slNo", label: "SL NO" },
  { key: "level", label: "LEVEL" },
  { key: "tagNumber", label: "TAG NUMBER" },
  { key: "type", label: "TYPE" },
  { key: "material", label: "MATERIAL" },
  { key: "withPlate", label: "WITH PLATE" },
  { key: "withoutPlate", label: "WITHOUT PLATE" },
]

/** Resolve the type-level plate quantities for a row by matching its type +
 *  classification against the project's typeConfigs. Falls back to a
 *  classification-agnostic match, then to empty strings (column blank). */
function platesForType(typeConfigs: SupportTypeConfig[], row: SupportRow): { withPlate: string; withoutPlate: string } {
  const t = row.type.trim().toLowerCase()
  const cls = row.classification ?? "internal"
  const tc =
    typeConfigs.find((c) => c.typeName.trim().toLowerCase() === t && (c.classification ?? "internal") === cls) ||
    typeConfigs.find((c) => c.typeName.trim().toLowerCase() === t)
  if (!tc) return { withPlate: "", withoutPlate: "" }
  return { withPlate: tc.withPlate ?? "", withoutPlate: tc.withoutPlate ?? "" }
}

interface ItemColumn {
  itemName: string
  /** Variant label, or empty string for non-variant items. */
  variantLabel: string
}

/** Variant dedupe key — trims whitespace + lowercases so "Z", " Z " and "z"
 *  collapse into one column instead of creating parallel ones. */
function normVariant(label: string): string {
  return label.trim().toLowerCase()
}

/** Look up the (variant-aware) model for the given row+item. Variant model
 *  wins over the parent item model; falls back to the parent. Used to render
 *  "<qty> (<model>)" inside item cells in both renderers. */
function modelForRow(
  typeConfigs: SupportTypeConfig[],
  row: SupportRow,
  itemName: string,
  variantLabel: string,
): string {
  const t = row.type.trim().toLowerCase()
  const cls = row.classification ?? "internal"
  const tc =
    typeConfigs.find((c) => c.typeName.trim().toLowerCase() === t && (c.classification ?? "internal") === cls) ||
    typeConfigs.find((c) => c.typeName.trim().toLowerCase() === t)
  if (!tc) return ""
  const item = tc.items.find((i) => i.itemName === itemName)
  if (!item) return ""
  if (variantLabel && item.variants) {
    const vNorm = normVariant(variantLabel)
    const v = item.variants.find((vv) => normVariant(vv.label) === vNorm)
    if (v?.model) return v.model
  }
  return item.model || ""
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
function buildItemColumns(typeConfigs: SupportTypeConfig[]): ItemColumn[] {
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
function readItemValue(row: SupportRow, itemName: string, variantLabel: string, isPrimary = false): string {
  const map = row.itemQtys?.[itemName]
  if (!map) return ""
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
  return ""
}

/** Highest length letter (a..p) that has any non-empty value across the given rows. */
function maxLengthKey(rows: SupportRow[]): LengthKey {
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

/** Add both corner logos to whatever is currently the active page. Safe to
 *  call inside autoTable's didDrawPage so each overflow page keeps them. */
function drawLogos(doc: jsPDF, logos: PdfLogos | undefined, pw: number, mx: number): void {
  if (!logos) return
  const y = 5
  const w = 20
  const h = 14
  if (logos.left) {
    try { doc.addImage(logos.left, logoFormat(logos.left), mx, y, w, h, undefined, "FAST") } catch { /* ignore */ }
  }
  if (logos.right) {
    try { doc.addImage(logos.right, logoFormat(logos.right), pw - mx - w, y, w, h, undefined, "FAST") } catch { /* ignore */ }
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
  const { doc, fonts, type, rows, projectName, typeConfigs, logos, subtitleOverride, mapping } = params
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = 14

  const lastLength = maxLengthKey(rows)
  const lastLengthIdx = LENGTH_KEYS.indexOf(lastLength)
  const activeLengths = LENGTH_KEYS.slice(0, lastLengthIdx + 1)

  const typesInRows = new Set(rows.map((r) => r.type.trim().toLowerCase()).filter(Boolean))
  const scopedConfigs = typeConfigs.filter((tc) => typesInRows.has(tc.typeName.trim().toLowerCase()))
  const activeConfigs = scopedConfigs.length > 0 ? scopedConfigs : typeConfigs
  const itemCols = buildItemColumns(activeConfigs)

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
    const heading = g.itemName.toUpperCase()
    if (isVariant) {
      headRow1.push({ content: heading, colSpan: g.variantLabels.length, styles: headStyles })
      for (const label of g.variantLabels) headRow2.push({ content: label, styles: headStyles })
    } else {
      headRow1.push({ content: heading, rowSpan: 2, styles: headStyles })
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
    for (const k of activeLengths) cells.push(String(row.lengths[k] ?? ""))
    cells.push(totalForRow(row, mapping))
    for (const ic of itemCols) {
      const isPrimary = primaryCol.has(`${ic.itemName}::${ic.variantLabel}`)
      const qty = readItemValue(row, ic.itemName, ic.variantLabel, isPrimary)
      if (!qty) { cells.push(""); continue }
      const model = modelForRow(activeConfigs, row, ic.itemName, ic.variantLabel)
      cells.push(model ? `${qty} (${model})` : qty)
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

  autoTable(doc, {
    startY: 24,
    head: [headRow1, headRow2],
    body,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.6,
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
      fontSize: 6,
      font: fonts.display,
      fontStyle: "bold",
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: [250, 251, 254] },
    theme: "grid",
    margin: { left: mx, right: mx },
  })

  // Bottom bar + footer
  doc.setFillColor(...PRIMARY)
  doc.rect(0, ph - 3, pw, 3, "F")

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text("Support MTO Generator", mx, ph - 5)
  doc.text(`Generated ${new Date().toLocaleDateString("en-US")}`, pw - mx, ph - 5, { align: "right" })
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
  const { doc, fonts, title, subtitle, rows, typeConfigs, logos, mapping } = params
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = 14

  const lastLength = maxLengthKey(rows)
  const lastLengthIdx = LENGTH_KEYS.indexOf(lastLength)
  const activeLengths = LENGTH_KEYS.slice(0, lastLengthIdx + 1)

  // Union of item columns across every configured type — mixed-type rows need
  // the full column set so each row can fill in just its own items.
  const itemCols = buildItemColumns(typeConfigs)

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
    const heading = g.itemName.toUpperCase()
    if (isVariant) {
      headRow1.push({ content: heading, colSpan: g.variantLabels.length, styles: headStyles })
      for (const label of g.variantLabels) headRow2.push({ content: label, styles: headStyles })
    } else {
      headRow1.push({ content: heading, rowSpan: 2, styles: headStyles })
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
    for (const k of activeLengths) cells.push(String(row.lengths[k] ?? ""))
    cells.push(totalForRow(row, mapping))
    for (const ic of itemCols) {
      const isPrimary = primaryCol.has(`${ic.itemName}::${ic.variantLabel}`)
      const qty = readItemValue(row, ic.itemName, ic.variantLabel, isPrimary)
      if (!qty) { cells.push(""); continue }
      const model = modelForRow(typeConfigs, row, ic.itemName, ic.variantLabel)
      cells.push(model ? `${qty} (${model})` : qty)
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

  autoTable(doc, {
    startY: 24,
    head: [headRow1, headRow2],
    body,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.6,
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
      fontSize: 6,
      font: fonts.display,
      fontStyle: "bold",
      cellPadding: 2,
    },
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
    if (!rows.length) continue
    typesUsed.push(type)
    for (const r of rows) allRows.push(r)
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

  const typesUsed = Array.from(new Set(rows.map((r) => r.type).filter(Boolean)))
  const subtitle = [
    projectName,
    `Selected · ${rows.length} supports`,
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
