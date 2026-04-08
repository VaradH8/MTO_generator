import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { BillingEntry } from "@/types/support"
import { calculateAmount } from "@/context/BillingContext"

interface InvoiceData {
  cycleId: string
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

export function generateInvoicePDF(data: InvoiceData): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = 18 // margin x

  // ─── Top accent bar ───
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pw, 4, "F")

  // ─── Logo block ───
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(mx, 14, 12, 12, 2, 2, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text("S", mx + 6, 22, { align: "center" })

  // App name
  doc.setTextColor(...DARK)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("Support PDF Generator", mx + 16, 19)

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  doc.text("Structural Support Billing", mx + 16, 24)

  // ─── INVOICE title (right side) ───
  doc.setFontSize(28)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...PRIMARY)
  doc.text("INVOICE", pw - mx, 20, { align: "right" })

  // Invoice meta
  const billedDate = new Date(data.billedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  doc.text(`#${data.cycleId.toUpperCase()}`, pw - mx, 26, { align: "right" })
  doc.text(billedDate, pw - mx, 30, { align: "right" })

  // ─── Thin divider ───
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(mx, 34, pw - mx, 34)

  // ─── Amount Due highlight box ───
  const boxY = 40
  doc.setFillColor(...PRIMARY_LIGHT)
  doc.roundedRect(mx, boxY, pw - mx * 2, 22, 3, 3, "F")

  // Left: label
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  doc.text("AMOUNT DUE", mx + 8, boxY + 9)

  doc.setFontSize(8)
  doc.text(`${data.totalSupports} unique supports, ${data.revisionCount} revision${data.revisionCount !== 1 ? "s" : ""}`, mx + 8, boxY + 15)

  // Right: amount
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...PRIMARY)
  doc.text(`$${data.amountDue.toFixed(2)}`, pw - mx - 8, boxY + 14, { align: "right" })

  // ─── Pricing Breakdown ───
  let y = boxY + 30

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...DARK)
  doc.text("Pricing Breakdown", mx, y)
  y += 2

  const additionalSupports = Math.max(data.totalSupports - 100, 0)
  const revisionCharges = data.revisionCount * 50

  const pricingRows = [
    ["Base rate — first 100 supports", data.totalSupports > 0 ? "100" : "0", "$200.00", data.totalSupports > 0 ? "$200.00" : "$0.00"],
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
      textColor: DARK,
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: SURFACE,
      textColor: MUTED,
      fontStyle: "bold",
      fontSize: 7,
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
  let lastY = ((doc as any).lastAutoTable?.finalY as number) ?? y + 30

  // Total row (manual — styled differently)
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(pw - mx - 62, lastY + 1, 62, 9, 1.5, 1.5, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text("TOTAL", pw - mx - 56, lastY + 7)
  doc.text(`$${data.amountDue.toFixed(2)}`, pw - mx - 4, lastY + 7, { align: "right" })

  // ─── Entry Details ───
  lastY += 20
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...DARK)
  doc.text("Entry Log", mx, lastY)
  lastY += 2

  const entryRows = data.entries.map((entry) => {
    const date = new Date(entry.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    const typesList = Object.entries(entry.types)
      .map(([t, c]) => `${t} (${c})`)
      .join(", ")
    return [date, entry.fileName, String(entry.supportCount), typesList]
  })

  autoTable(doc, {
    startY: lastY,
    head: [["Date", "Source File", "Supports", "Types"]],
    body: entryRows,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      textColor: DARK,
      lineColor: BORDER,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: SURFACE,
      textColor: MUTED,
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [250, 251, 254] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 60 },
    },
    margin: { left: mx, right: mx },
  })

  // ─── Footer ───
  // Bottom accent bar
  doc.setFillColor(...PRIMARY)
  doc.rect(0, ph - 4, pw, 4, "F")

  // Footer text
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  doc.text("Support PDF Generator", mx, ph - 10)
  doc.text("Pricing: $200 flat for first 100 supports, $1 per additional support, $50 per revision", mx, ph - 6.5)

  doc.setFont("helvetica", "italic")
  doc.setTextColor(...BORDER)
  doc.text(`Generated ${new Date().toLocaleDateString("en-US")}`, pw - mx, ph - 8, { align: "right" })

  return doc.output("blob")
}
