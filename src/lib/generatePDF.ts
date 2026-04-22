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

/** Union across all configured types, preserving first-seen ordering. */
function buildItemColumns(typeConfigs: SupportTypeConfig[]): ItemColumn[] {
  const cols: ItemColumn[] = []
  const seen = new Set<string>()
  for (const tc of typeConfigs) {
    for (const item of tc.items) {
      if (item.variants && item.variants.length > 0) {
        for (const v of item.variants) {
          const k = `${item.itemName}::${v.label}`
          if (seen.has(k)) continue
          seen.add(k)
          cols.push({ itemName: item.itemName, variantLabel: v.label })
        }
      } else {
        const k = `${item.itemName}::`
        if (seen.has(k)) continue
        seen.add(k)
        cols.push({ itemName: item.itemName, variantLabel: "" })
      }
    }
  }
  return cols
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
      cells.push(String(row.itemQtys?.[ic.itemName]?.[ic.variantLabel] ?? ""))
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
 * Combined PDF: every type's schedule rendered back-to-back into a single
 * document, one type per page (or more if autoTable overflows).
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

  const entries = Object.entries(grouped).filter(([, rows]) => rows.length > 0)
  entries.forEach(([type, rows], idx) => {
    if (idx > 0) doc.addPage()
    renderTypeSection({ doc, fonts, type, rows, projectName, typeConfigs, logoDataUrl })
  })

  return doc.output("blob")
}

/**
 * Build a PDF for an explicit set of rows (e.g. user selection), grouped by
 * their own type. Pages are added per type. Subtitle is tagged as a selection.
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

  const grouped: Record<string, SupportRow[]> = {}
  for (const r of rows) {
    const t = r.type || "Unknown"
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(r)
  }

  const entries = Object.entries(grouped).filter(([, rs]) => rs.length > 0)
  entries.forEach(([type, rs], idx) => {
    if (idx > 0) doc.addPage()
    renderTypeSection({
      doc,
      fonts,
      type,
      rows: rs,
      projectName,
      typeConfigs,
      logoDataUrl,
      subtitleOverride: `${projectName ? `${projectName} | ` : ""}Selected · ${rs.length} supports`,
    })
  })

  return doc.output("blob")
}
