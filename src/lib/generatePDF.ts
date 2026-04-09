import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { SupportRow } from "@/types/support"
import { registerFonts, getFontNames } from "./pdfFonts"

const PRIMARY: [number, number, number] = [31, 60, 168]
const DARK: [number, number, number] = [13, 21, 48]
const MUTED: [number, number, number] = [74, 84, 120]
const BORDER: [number, number, number] = [201, 210, 228]
const SURFACE: [number, number, number] = [243, 245, 250]

const PRE_COLS = ["Support Tag Name", "Discipline", "Type", "A", "B", "C", "D", "Total"]
const POST_COLS = ["X", "Y", "Z", "X-Grid", "Y-Grid", "Remarks"]
const PRE_KEYS: (keyof SupportRow)[] = ["supportTagName", "discipline", "type", "a", "b", "c", "d", "total"]
const POST_KEYS: (keyof SupportRow)[] = ["x", "y", "z", "xGrid", "yGrid", "remarks"]

export async function generatePDF(type: string, rows: SupportRow[], projectName?: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = 14

  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)

  // Max items
  let maxItems = 0
  for (const row of rows) {
    if (row.items?.length > maxItems) maxItems = row.items.length
  }
  if (maxItems === 0) {
    for (const row of rows) {
      if (row.item03Name || row.item03Qty) { maxItems = 3; break }
      if (row.item02Name || row.item02Qty) maxItems = Math.max(maxItems, 2)
      if (row.item01Name || row.item01Qty) maxItems = Math.max(maxItems, 1)
    }
  }
  maxItems = Math.max(maxItems, 1)

  // Build headers
  const itemHeaders: string[] = []
  for (let i = 0; i < maxItems; i++) {
    const num = String(i + 1).padStart(2, "0")
    itemHeaders.push(`Item-${num} Name`, `Item-${num} Qty`)
  }
  const allHeaders = [...PRE_COLS, ...itemHeaders, ...POST_COLS]

  // Build body
  const body = rows.map((row) => {
    const pre = PRE_KEYS.map((k) => String(row[k] ?? ""))
    const items: string[] = []
    for (let i = 0; i < maxItems; i++) {
      if (row.items?.[i]) {
        items.push(row.items[i].name ?? "", row.items[i].qty ?? "")
      } else {
        const num = String(i + 1).padStart(2, "0")
        items.push(
          (row as unknown as Record<string, string>)[`item${num}Name`] ?? "",
          (row as unknown as Record<string, string>)[`item${num}Qty`] ?? ""
        )
      }
    }
    const post = POST_KEYS.map((k) => String(row[k] ?? ""))
    return [...pre, ...items, ...post]
  })

  // ─── Top accent bar ───
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pw, 3, "F")

  // ─── Logo ───
  try {
    const logoRes = await fetch("/logo.png")
    const logoBuf = await logoRes.arrayBuffer()
    const logoB64 = btoa(String.fromCharCode(...new Uint8Array(logoBuf)))
    doc.addImage(`data:image/png;base64,${logoB64}`, "PNG", mx, 7, 12, 12)
  } catch { /* no logo */ }

  // ─── Title ───
  doc.setFont(fonts.display, "bold")
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(`Support Schedule — ${type}`, mx + 16, 13)

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const subtitle = projectName ? `${projectName} | ` : ""
  doc.text(`${subtitle}${rows.length} supports, ${maxItems} item${maxItems !== 1 ? "s" : ""} per support`, mx + 16, 18)

  // ─── Table ───
  autoTable(doc, {
    startY: 24,
    head: [allHeaders],
    body,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.8,
      font: fonts.body,
      textColor: DARK,
      lineColor: BORDER,
      lineWidth: 0.15,
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

  // ─── Bottom bar + footer ───
  doc.setFillColor(...PRIMARY)
  doc.rect(0, ph - 3, pw, 3, "F")

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text("Support MTO Generator", mx, ph - 5)
  doc.text(`Generated ${new Date().toLocaleDateString("en-US")}`, pw - mx, ph - 5, { align: "right" })

  return doc.output("blob")
}
