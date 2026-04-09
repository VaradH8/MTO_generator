import JSZip from "jszip"

interface PdfEntry {
  name: string
  blob: Blob
}

export async function generateZip(pdfs: PdfEntry[]): Promise<Blob> {
  const zip = new JSZip()

  for (const pdf of pdfs) {
    zip.file(`${pdf.name}.pdf`, pdf.blob)
  }

  return zip.generateAsync({ type: "blob" })
}
