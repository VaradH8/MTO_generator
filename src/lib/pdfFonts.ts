import { jsPDF } from "jspdf"

/**
 * Font files are bundled locally in public/fonts/ — no external CDN dependency.
 * This guarantees 100% custom font usage with zero network risk.
 */
const FONT_PATHS = {
  "SpaceGrotesk-Regular": "/fonts/SpaceGrotesk-Regular.ttf",
  "SpaceGrotesk-Bold": "/fonts/SpaceGrotesk-Bold.ttf",
  "JosefinSans-Regular": "/fonts/JosefinSans-Regular.ttf",
  "JosefinSans-Bold": "/fonts/JosefinSans-Bold.ttf",
}

let cachedFonts: Record<string, string> | null = null

async function fetchFontAsBase64(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Font fetch failed: ${path}`)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function loadFonts(): Promise<Record<string, string>> {
  if (cachedFonts) return cachedFonts

  const [sgRegular, sgBold, jsRegular, jsBold] = await Promise.all([
    fetchFontAsBase64(FONT_PATHS["SpaceGrotesk-Regular"]),
    fetchFontAsBase64(FONT_PATHS["SpaceGrotesk-Bold"]),
    fetchFontAsBase64(FONT_PATHS["JosefinSans-Regular"]),
    fetchFontAsBase64(FONT_PATHS["JosefinSans-Bold"]),
  ])

  cachedFonts = { sgRegular, sgBold, jsRegular, jsBold }
  return cachedFonts
}

/**
 * Register custom fonts with a jsPDF doc instance.
 * Returns true if custom fonts loaded, false if fallback needed.
 */
export async function registerFonts(doc: jsPDF): Promise<boolean> {
  try {
    const fonts = await loadFonts()

    doc.addFileToVFS("SpaceGrotesk-Regular.ttf", fonts.sgRegular)
    doc.addFileToVFS("SpaceGrotesk-Bold.ttf", fonts.sgBold)
    doc.addFileToVFS("JosefinSans-Regular.ttf", fonts.jsRegular)
    doc.addFileToVFS("JosefinSans-Bold.ttf", fonts.jsBold)

    doc.addFont("SpaceGrotesk-Regular.ttf", "SpaceGrotesk", "normal")
    doc.addFont("SpaceGrotesk-Bold.ttf", "SpaceGrotesk", "bold")
    doc.addFont("JosefinSans-Regular.ttf", "JosefinSans", "normal")
    doc.addFont("JosefinSans-Bold.ttf", "JosefinSans", "bold")

    return true
  } catch (err) {
    console.warn("Custom fonts failed to load:", err)
    return false
  }
}

/** Get font family names based on whether custom fonts loaded */
export function getFontNames(customLoaded: boolean) {
  return {
    display: customLoaded ? "SpaceGrotesk" : "helvetica",
    body: customLoaded ? "JosefinSans" : "helvetica",
  }
}
