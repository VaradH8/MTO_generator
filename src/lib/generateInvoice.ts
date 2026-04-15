import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { BillingEntry } from "@/types/support"
import { calculateAmount } from "@/context/BillingContext"
import { registerFonts, getFontNames } from "./pdfFonts"

interface InvoiceData {
  invoiceNumber: string       // e.g. "ClientName_001"
  billedAt: string
  entries: BillingEntry[]
  totalSupports: number
  revisionCount: number
  amountDue: number
}

// Brand colors
const PRIMARY: [number, number, number] = [31, 60, 168]
const PRIMARY_LIGHT: [number, number, number] = [235, 239, 252]
const DARK: [number, number, number] = [13, 21, 48]
const MUTED: [number, number, number] = [74, 84, 120]
const BORDER: [number, number, number] = [201, 210, 228]
const SURFACE: [number, number, number] = [243, 245, 250]

export async function generateInvoicePDF(data: InvoiceData): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = 18

  const customLoaded = await registerFonts(doc)
  const fonts = getFontNames(customLoaded)

  // ─── Top accent bar ───
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pw, 4, "F")

  // ─── Logo — original aspect ratio ───
  const logoMaxH = 30
  const logoPad = 3
  let logoBoxW = logoMaxH + logoPad * 2
  let logoBoxH = logoMaxH + logoPad * 2
  try {
    const logoRes = await fetch("/logo.png")
    const logoBuf = await logoRes.arrayBuffer()
    const bytes = new Uint8Array(logoBuf)
    const logoB64 = btoa(String.fromCharCode(...bytes))
    // Read PNG dimensions from IHDR chunk (bytes 16-23)
    let pngW = 0, pngH = 0
    if (bytes[0] === 0x89 && bytes[1] === 0x50) { // PNG signature
      pngW = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      pngH = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
    }
    let logoW = logoMaxH, logoH = logoMaxH
    if (pngW > 0 && pngH > 0) {
      const aspect = pngW / pngH
      if (aspect >= 1) { logoH = logoMaxH; logoW = logoMaxH * aspect }
      else { logoW = logoMaxH; logoH = logoMaxH / aspect }
    }
    logoBoxW = logoW + logoPad * 2
    logoBoxH = logoH + logoPad * 2
    doc.setFillColor(...DARK)
    doc.roundedRect(mx, 8, logoBoxW, logoBoxH, 3, 3, "F")
    doc.addImage(`data:image/png;base64,${logoB64}`, "PNG", mx + logoPad, 8 + logoPad, logoW, logoH)
  } catch {
    doc.setFillColor(...DARK)
    doc.roundedRect(mx, 8, logoBoxW, logoBoxH, 3, 3, "F")
  }

  // App name — positioned to the right of the logo
  const textX = mx + logoBoxW + 6
  doc.setTextColor(...DARK)
  doc.setFontSize(13)
  doc.setFont(fonts.display, "bold")
  doc.text("Support MTO", textX, 21)

  doc.setFontSize(8)
  doc.setFont(fonts.body, "normal")
  doc.setTextColor(...MUTED)
  doc.text("Structural Support Billing", textX, 27)

  // ─── INVOICE title ───
  doc.setFontSize(28)
  doc.setFont(fonts.display, "bold")
  doc.setTextColor(...PRIMARY)
  doc.text("INVOICE", pw - mx, 20, { align: "right" })

  // Invoice meta
  const billedDate = new Date(data.billedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  })
  doc.setFontSize(8)
  doc.setFont(fonts.body, "normal")
  doc.setTextColor(...MUTED)
  doc.text(`#${data.invoiceNumber}`, pw - mx, 26, { align: "right" })
  doc.text(billedDate, pw - mx, 30, { align: "right" })

  // ─── Divider ───
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(mx, 44, pw - mx, 44)

  // ─── Amount Due box ───
  const boxY = 50
  doc.setFillColor(...PRIMARY_LIGHT)
  doc.roundedRect(mx, boxY, pw - mx * 2, 22, 3, 3, "F")

  doc.setFontSize(9)
  doc.setFont(fonts.display, "normal")
  doc.setTextColor(...MUTED)
  doc.text("AMOUNT DUE", mx + 8, boxY + 9)

  doc.setFontSize(8)
  doc.setFont(fonts.body, "normal")
  doc.text(`${data.totalSupports} unique supports, ${data.revisionCount} revision${data.revisionCount !== 1 ? "s" : ""}`, mx + 8, boxY + 15)

  doc.setFontSize(22)
  doc.setFont(fonts.display, "bold")
  doc.setTextColor(...PRIMARY)
  doc.text(`$${data.amountDue.toFixed(2)}`, pw - mx - 8, boxY + 14, { align: "right" })

  // ─── Pricing Breakdown ───
  let y = boxY + 30

  doc.setFontSize(10)
  doc.setFont(fonts.display, "bold")
  doc.setTextColor(...DARK)
  doc.text("Pricing Breakdown", mx, y)
  y += 2

  const additionalSupports = Math.max(data.totalSupports - 100, 0)
  const revisionCharges = data.revisionCount * 50

  const pricingRows = [
    ["Base rate \u2014 first 100 supports", data.totalSupports > 0 ? "100" : "0", "$200.00", data.totalSupports > 0 ? "$200.00" : "$0.00"],
    ["Additional supports @ $1.00/ea", String(additionalSupports), "$1.00", `$${additionalSupports.toFixed(2)}`],
    ["Revisions @ $50.00/ea", String(data.revisionCount), "$50.00", `$${revisionCharges.toFixed(2)}`],
  ]

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: pricingRows,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: DARK, lineColor: BORDER, lineWidth: 0.2, font: fonts.body,
    },
    headStyles: {
      fillColor: SURFACE, textColor: MUTED, fontStyle: "bold",
      fontSize: 7, font: fonts.display,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [250, 251, 254] },
    margin: { left: mx, right: mx },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = ((doc as any).lastAutoTable?.finalY as number) ?? y + 30

  // Total pill
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(pw - mx - 62, lastY + 1, 62, 9, 1.5, 1.5, "F")
  doc.setFontSize(9)
  doc.setFont(fonts.display, "bold")
  doc.setTextColor(255, 255, 255)
  doc.text("TOTAL", pw - mx - 56, lastY + 7)
  doc.text(`$${data.amountDue.toFixed(2)}`, pw - mx - 4, lastY + 7, { align: "right" })

  // ─── Footer — just accent bar + generation date ───
  doc.setFillColor(...PRIMARY)
  doc.rect(0, ph - 4, pw, 4, "F")

  doc.setFont(fonts.body, "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...BORDER)
  doc.text(`Generated ${new Date().toLocaleDateString("en-US")}`, pw - mx, ph - 7, { align: "right" })

  return doc.output("blob")
}
