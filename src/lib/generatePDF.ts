import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { SupportRow } from "@/types/support"

const COLUMNS = [
  "Support Tag Name", "Discipline", "Type", "A", "B", "C", "D", "Total",
  "Item-01 Name", "Item-01 Qty", "Item-02 Name", "Item-02 Qty",
  "Item-03 Name", "Item-03 Qty", "X", "Y", "Z", "X-Grid", "Y-Grid", "Remarks",
]

const ROW_KEYS: (keyof SupportRow)[] = [
  "supportTagName", "discipline", "type", "a", "b", "c", "d", "total",
  "item01Name", "item01Qty", "item02Name", "item02Qty",
  "item03Name", "item03Qty", "x", "y", "z", "xGrid", "yGrid", "remarks",
]

export function generatePDF(type: string, rows: SupportRow[]): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" })

  doc.setFontSize(16)
  doc.text(`Support Schedule — ${type}`, 14, 20)
  doc.setFontSize(10)
  doc.text(`${rows.length} supports`, 14, 28)

  autoTable(doc, {
    startY: 34,
    head: [COLUMNS],
    body: rows.map((row) => ROW_KEYS.map((key) => String(row[key] ?? ""))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [31, 60, 168], fontSize: 7 },
    theme: "grid",
  })

  return doc.output("blob")
}
