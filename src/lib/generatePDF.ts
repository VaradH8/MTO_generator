import { jsPDF } from "jspdf"
import autoTable, { type CellDef } from "jspdf-autotable"
import { LENGTH_KEYS } from "@/types/support"
import type { SupportRow, SupportTypeConfig, LengthKey } from "@/types/support"
import { registerFonts, getFontNames } from "./pdfFonts"

const PRIMARY: [number, number, number] = [31, 60, 168]
const DARK: [number, number, number] = [13, 21, 48]
const MUTED: [number, number, number] = [74, 84, 120]
const BORDER: [number, number, number] = [201, 210, 228]

/** Meta columns that appear before the LENGTH block. */
const PRE_LENGTH: { key: keyof SupportRow; label: string }[] = [
  { key: "slNo", label: "SL NO" },
  { key: "level", label: "LEVEL" },
  { key: "tagNumber", label: "TAG NUMBER" },
  { key: "type", label: "TYPE" },
  { key: "withPlate", label: "WITH PLATE" },
  { key: "withoutPlate", label: "WITHOUT PLATE" },
]

interface ItemColumn {
  itemName: string
  /** Variant label; empty string for single-column (no variants) items. */
  variantLabel: string
}

/** Variant dedupe key — trims whitespace + lowercases so "Z", " Z " and "z"
 *  collapse into one column instead of creating parallel ones. */
function normVariant(label: string): string {
  return label.trim().toLowerCase()
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

  // Pass 2 — emit columns, skipping the empty-label variant for any item
  // that also has at least one named variant.
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
 *  versa) instead of looking empty in the PDF. */
function readItemValue(row: SupportRow, itemName: string, variantLabel: string): string {
  const map = row.itemQtys?.[itemName]
  if (!map) return ""
  const direct = map[variantLabel]
  if (direct !== undefined && direct !== "") return direct
  const target = normVariant(variantLabel)
  for (const [k, v] of Object.entries(map)) {
    if (normVariant(k) === target && v !== undefined && v !== "") return v
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

interface RenderSectionParams {
  doc: jsPDF
  fonts: { display: string; body: string }
  type: string
  rows: SupportRow[]
  projectName?: string
  typeConfigs: SupportTypeConfig[]
  logoDataUrl?: string | null
  /** Optional subtitle override (e.g. "Selected rows · 12 supports"). */
  subtitleOverride?: string
}

function renderTypeSection(params: RenderSectionParams): void {
  const { doc, fonts, type, rows, projectName, typeConfigs, logoDataUrl, subtitleOverride } = params
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = 14

  const lastLength = maxLengthKey(rows)
  const lastLengthIdx = LENGTH_KEYS.indexOf(lastLength)
  const activeLengths = LENGTH_KEYS.slice(0, lastLengthIdx + 1)

  const typesInRows = new Set(rows.map((r) => r.type.trim().toLowerCase()).filter(Boolean))
  const scopedConfigs = typeConfigs.filter((tc) => typesInRows.has(tc.typeName.trim().toLowerCase()))
  const itemCols = buildItemColumns(scopedConfigs.length > 0 ? scopedConfigs : typeConfigs)

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
  headRow1.push({ content: "LENGTH", colSpan: activeLengths.length, styles: headStyles })
  for (const k of activeLengths) headRow2.push({ content: k.toUpperCase(), styles: headStyles })
  headRow1.push({ content: "TOTAL", rowSpan: 2, styles: headStyles })

  for (const g of itemGroups) {
    const isVariant = g.variantLabels.length > 1 || (g.variantLabels.length === 1 && g.variantLabels[0] !== "")
    if (isVariant) {
      headRow1.push({ content: g.itemName.toUpperCase(), colSpan: g.variantLabels.length, styles: headStyles })
      for (const label of g.variantLabels) headRow2.push({ content: label, styles: headStyles })
    } else {
      headRow1.push({ content: g.itemName.toUpperCase(), rowSpan: 2, styles: headStyles })
    }
  }

  headRow1.push({ content: "REMARKS", rowSpan: 2, styles: headStyles })

  const body = rows.map((row) => {
    const cells: string[] = []
    for (const c of PRE_LENGTH) cells.push(String(row[c.key] ?? ""))
    for (const k of activeLengths) cells.push(String(row.lengths[k] ?? ""))
    cells.push(String(row.total ?? ""))
    for (const ic of itemCols) {
      cells.push(readItemValue(row, ic.itemName, ic.variantLabel))
    }
    cells.push(String(row.remarks ?? ""))
    return cells
  })

  // Top accent bar
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pw, 3, "F")

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", mx, 7, 12, 12)
    } catch { /* ignore */ }
  }

  doc.setFont(fonts.display, "bold")
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(`Support Schedule — ${type}`, mx + 16, 13)

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const subtitle = subtitleOverride ?? `${projectName ? `${projectName} | ` : ""}${rows.length} supports`
  doc.text(subtitle, mx + 16, 18)

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
  logoDataUrl?: string | null
}

/**
 * Single continuous table across every row regardless of type. The column set
 * is the UNION of all length letters that appear and all item columns from the
 * provided typeConfigs, so rows whose type doesn't use a given column just
 * render an empty cell. autoTable handles pagination on its own.
 */
function renderFlatTable(params: RenderFlatParams): void {
  const { doc, fonts, title, subtitle, rows, typeConfigs, logoDataUrl } = params
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
  headRow1.push({ content: "LENGTH", colSpan: activeLengths.length, styles: headStyles })
  for (const k of activeLengths) headRow2.push({ content: k.toUpperCase(), styles: headStyles })
  headRow1.push({ content: "TOTAL", rowSpan: 2, styles: headStyles })

  for (const g of itemGroups) {
    const isVariant = g.variantLabels.length > 1 || (g.variantLabels.length === 1 && g.variantLabels[0] !== "")
    if (isVariant) {
      headRow1.push({ content: g.itemName.toUpperCase(), colSpan: g.variantLabels.length, styles: headStyles })
      for (const label of g.variantLabels) headRow2.push({ content: label, styles: headStyles })
    } else {
      headRow1.push({ content: g.itemName.toUpperCase(), rowSpan: 2, styles: headStyles })
    }
  }

  headRow1.push({ content: "REMARKS", rowSpan: 2, styles: headStyles })

  const body = rows.map((row) => {
    const cells: string[] = []
    for (const c of PRE_LENGTH) cells.push(String(row[c.key] ?? ""))
    for (const k of activeLengths) cells.push(String(row.lengths[k] ?? ""))
    cells.push(String(row.total ?? ""))
    for (const ic of itemCols) {
      cells.push(readItemValue(row, ic.itemName, ic.variantLabel))
    }
    cells.push(String(row.remarks ?? ""))
    return cells
  })

  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pw, 3, "F")

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", mx, 7, 12, 12)
    } catch { /* ignore */ }
  }

  doc.setFont(fonts.display, "bold")
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(title, mx + 16, 13)

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(subtitle, mx + 16, 18)

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
      doc.setFont(fonts.body, "normal")
      doc.setFontSize(6)
      doc.setTextColor(...MUTED)
      doc.text("Support MTO Generator", mx, ph - 5)
      doc.text(`Generated ${new Date().toLocaleDateString("en-US")}`, pw - mx, ph - 5, { align: "right" })
    },
  })
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const logoRes = await fetch("/logo.png")
    const logoBuf = await logoRes.arrayBuffer()
    const logoB64 = btoa(String.fromCharCode(...new Uint8Array(logoBuf)))
    return `data:image/png;base64,${logoB64}`
  } catch {
    return null
  }
}

export async function generatePDF(
  type: string,
  rows: SupportRow[],
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })
  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)
  const logoDataUrl = await loadLogoDataUrl()

  renderTypeSection({ doc, fonts, type, rows, projectName, typeConfigs, logoDataUrl })

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
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })
  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)
  const logoDataUrl = await loadLogoDataUrl()

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
    logoDataUrl,
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
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })
  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)
  const logoDataUrl = await loadLogoDataUrl()

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
    logoDataUrl,
  })

  return doc.output("blob")
}
