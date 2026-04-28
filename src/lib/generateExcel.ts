import * as XLSX from "xlsx-js-style"
import JSZip from "jszip"
import { LENGTH_KEYS } from "@/types/support"
import type { SupportRow, SupportTypeConfig, GroupedSupports, TypeMapping } from "@/types/support"
import {
  PRE_LENGTH,
  platesForType,
  dominantMaterial,
  buildItemModels,
  buildItemColumns,
  composeHeader,
  normVariant,
  readItemValue,
  maxLengthKey,
  totalForRow,
  type PdfLogos,
} from "./generatePDF"

type ProjectMapping = Record<string, TypeMapping>

/**
 * Excel exporter that mirrors the PDF Support Schedule layout cell-for-cell:
 *   - Row 0 is reserved for the top-corner logos (anchored via OOXML drawing
 *     parts injected after sheetjs writes the workbook — see injectLogos).
 *   - Title + subtitle + two header rows below, all styled to match the PDF
 *     (primary blue header fills, white bold header text, light borders,
 *     alternating row bands in the body).
 *   - Body cells carry just the quantity; material+model lives in the
 *     header column labels exactly like the PDF.
 *
 * Styling is provided by `xlsx-js-style`, a drop-in fork of the community
 * `xlsx` package that adds the `s` (style) property on cells so we can ship
 * fills, fonts, alignment, and borders without manually editing styles.xml.
 */

/** Color palette mirroring the PDF tokens (PRIMARY/DARK/MUTED/BORDER) so
 *  both surfaces look like they came out of the same template. ARGB hex —
 *  Excel ignores the AA. */
const COLOR = {
  primary: "1F3CA8",
  dark: "0D1530",
  muted: "4A5478",
  border: "C9D2E4",
  rowAlt: "FAFBFE",
  white: "FFFFFF",
}

type CellStyle = NonNullable<XLSX.CellObject["s"]>

const TITLE_STYLE: CellStyle = {
  font: { name: "Calibri", sz: 16, bold: true, color: { rgb: COLOR.dark } },
  alignment: { horizontal: "center", vertical: "center" },
}
const SUBTITLE_STYLE: CellStyle = {
  font: { name: "Calibri", sz: 10, color: { rgb: COLOR.muted } },
  alignment: { horizontal: "center", vertical: "center" },
}
const HEADER_STYLE: CellStyle = {
  font: { name: "Calibri", sz: 9, bold: true, color: { rgb: COLOR.white } },
  fill: { patternType: "solid", fgColor: { rgb: COLOR.primary } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: COLOR.border } },
    bottom: { style: "thin", color: { rgb: COLOR.border } },
    left: { style: "thin", color: { rgb: COLOR.border } },
    right: { style: "thin", color: { rgb: COLOR.border } },
  },
}
function bodyStyle(zebra: boolean): CellStyle {
  return {
    font: { name: "Calibri", sz: 9, color: { rgb: COLOR.dark } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: zebra ? { patternType: "solid", fgColor: { rgb: COLOR.rowAlt } } : undefined,
    border: {
      top: { style: "thin", color: { rgb: COLOR.border } },
      bottom: { style: "thin", color: { rgb: COLOR.border } },
      left: { style: "thin", color: { rgb: COLOR.border } },
      right: { style: "thin", color: { rgb: COLOR.border } },
    },
  }
}

interface BuildSchemaParams {
  rows: SupportRow[]
  typeConfigs: SupportTypeConfig[]
  /** When true, restrict typeConfigs to those whose name appears in `rows`
   *  (matches the per-type PDF section behavior). Combined/selection paths
   *  pass the full union. */
  scopeToRows?: boolean
}

interface SheetSchema {
  /** Two-row header. Each top-row cell may carry rowSpan/colSpan that we
   *  translate to !merges. Bottom row may be sparse (placeholders) for
   *  spans the top row covers. */
  headRow1: { content: string; rowSpan?: number; colSpan?: number }[]
  headRow2: (string | null)[]
  /** Body rows aligned to the column order produced by the header expansion. */
  body: string[][]
  /** Total number of columns (after expanding spans). */
  width: number
}

function buildSchema(params: BuildSchemaParams, mapping: ProjectMapping | undefined): SheetSchema {
  const { rows, typeConfigs, scopeToRows } = params

  const lastLength = maxLengthKey(rows)
  const lastLengthIdx = LENGTH_KEYS.indexOf(lastLength)
  const activeLengths = LENGTH_KEYS.slice(0, lastLengthIdx + 1)

  let activeConfigs = typeConfigs
  if (scopeToRows) {
    const typesInRows = new Set(rows.map((r) => r.type.trim().toLowerCase()).filter(Boolean))
    const scoped = typeConfigs.filter((tc) => typesInRows.has(tc.typeName.trim().toLowerCase()))
    if (scoped.length > 0) activeConfigs = scoped
  }

  const itemCols = buildItemColumns(activeConfigs)
  const models = buildItemModels(activeConfigs)
  const material = dominantMaterial(rows)

  const itemGroups: { itemName: string; variantLabels: string[] }[] = []
  for (const ic of itemCols) {
    const existing = itemGroups.find((g) => g.itemName === ic.itemName)
    if (existing) existing.variantLabels.push(ic.variantLabel)
    else itemGroups.push({ itemName: ic.itemName, variantLabels: [ic.variantLabel] })
  }

  const headRow1: SheetSchema["headRow1"] = []
  const headRow2: (string | null)[] = []

  // Pre-length meta columns — rowSpan over the two header rows.
  for (const c of PRE_LENGTH) {
    headRow1.push({ content: c.label, rowSpan: 2 })
    headRow2.push(null)
  }
  // LENGTH (mm) parent + A..N children
  headRow1.push({ content: "LENGTH (mm)", colSpan: activeLengths.length })
  for (const k of activeLengths) headRow2.push(k.toUpperCase())
  // TOTAL — rowSpan
  headRow1.push({ content: "TOTAL", rowSpan: 2 })
  headRow2.push(null)

  // Item columns. Variant items: parent header is just ITEM, each variant
  // subcolumn carries the full MATERIAL-MODEL — same as the PDF.
  for (const g of itemGroups) {
    const isVariant = g.variantLabels.length > 1 || (g.variantLabels.length === 1 && g.variantLabels[0] !== "")
    const upper = g.itemName.toUpperCase()
    if (isVariant) {
      headRow1.push({ content: upper, colSpan: g.variantLabels.length })
      const variantModels = models.variant.get(g.itemName)
      for (const label of g.variantLabels) {
        const model = variantModels?.get(normVariant(label)) ?? ""
        headRow2.push(composeHeader(label, [material, model]))
      }
    } else {
      const model = models.parent.get(g.itemName) ?? ""
      headRow1.push({ content: composeHeader(upper, [material, model]), rowSpan: 2 })
      headRow2.push(null)
    }
  }

  headRow1.push({ content: "REMARKS", rowSpan: 2 })
  headRow2.push(null)

  // Primary-variant promotion so a row stored under "" still surfaces under
  // the leading variant column instead of vanishing — mirrors the PDF.
  const primaryCol = new Set<string>()
  {
    const seenItems = new Set<string>()
    for (const ic of itemCols) {
      if (seenItems.has(ic.itemName)) continue
      seenItems.add(ic.itemName)
      primaryCol.add(`${ic.itemName}::${ic.variantLabel}`)
    }
  }

  const body: string[][] = rows.map((row) => {
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
      cells.push(readItemValue(row, ic.itemName, ic.variantLabel, isPrimary))
    }
    cells.push(String(row.remarks ?? ""))
    return cells
  })

  // Width = sum of colSpans (or 1 each).
  let width = 0
  for (const cell of headRow1) width += cell.colSpan ?? 1

  return { headRow1, headRow2, body, width }
}

interface BuildSheetParams {
  title: string
  subtitle: string
  schema: SheetSchema
  /** True when the workbook has at least one usable logo. The logo row stays
   *  in the layout regardless so the title/header positions don't drift
   *  between exports, but the row is sized smaller when there's nothing to
   *  put there. */
  hasLogo: boolean
}

/** Cell address helper — XLSX uses A1-style references, indexed (row, col). */
function addr(row: number, col: number): string {
  return XLSX.utils.encode_cell({ r: row, c: col })
}

/** Apply a style to a single cell (creating it if missing). */
function styleCell(ws: XLSX.WorkSheet, row: number, col: number, style: CellStyle): void {
  const ref = addr(row, col)
  const cell = (ws[ref] as XLSX.CellObject | undefined) ?? { t: "s", v: "" }
  cell.s = style
  ;(ws as Record<string, unknown>)[ref] = cell
}

/** Convert the schema to an XLSX worksheet with merged header cells, styled
 *  to match the PDF (primary header fill, bordered body, alternating rows).
 *  Row 0 is the logo row — kept tall enough to seat the 25mm × 18mm logo
 *  without overlapping the title text below. */
function buildSheet({ title, subtitle, schema, hasLogo }: BuildSheetParams): XLSX.WorkSheet {
  const { headRow1, headRow2, body, width } = schema

  // Row layout (zero-indexed):
  //   0 — logo strip (empty cells; row height ~22mm to seat both logos)
  //   1 — title (merged across every column)
  //   2 — subtitle (merged)
  //   3 — header row 1
  //   4 — header row 2
  //   5+ — body
  const LOGO_ROW = 0
  const TITLE_ROW = 1
  const SUBTITLE_ROW = 2
  const H1_ROW = 3
  const H2_ROW = 4
  const BODY_START_ROW = 5

  const merges: XLSX.Range[] = []

  const logoRow: string[] = new Array(width).fill("")
  const titleRow: string[] = [title, ...new Array(Math.max(0, width - 1)).fill("")]
  const subtitleRow: string[] = [subtitle, ...new Array(Math.max(0, width - 1)).fill("")]
  if (width > 1) {
    merges.push({ s: { r: LOGO_ROW, c: 0 }, e: { r: LOGO_ROW, c: width - 1 } })
    merges.push({ s: { r: TITLE_ROW, c: 0 }, e: { r: TITLE_ROW, c: width - 1 } })
    merges.push({ s: { r: SUBTITLE_ROW, c: 0 }, e: { r: SUBTITLE_ROW, c: width - 1 } })
  }

  // Expand headRow1 spans into a flat row aligned to the workbook grid. Cells
  // covered by a colSpan are filled with "" so the array is rectangular, and
  // we record merge ranges separately.
  const flatHead1: string[] = []
  let col = 0
  for (const cell of headRow1) {
    flatHead1.push(cell.content)
    const span = cell.colSpan ?? 1
    for (let i = 1; i < span; i++) flatHead1.push("")
    if (span > 1) {
      merges.push({ s: { r: H1_ROW, c: col }, e: { r: H1_ROW, c: col + span - 1 } })
    }
    if (cell.rowSpan === 2) {
      merges.push({ s: { r: H1_ROW, c: col }, e: { r: H2_ROW, c: col } })
    }
    col += span
  }
  const flatHead2: string[] = headRow2.map((v) => v ?? "")

  const data: string[][] = [logoRow, titleRow, subtitleRow, flatHead1, flatHead2, ...body]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws["!merges"] = merges

  // Column widths — meta columns narrow, header-text columns wider.
  const cols: { wch: number }[] = []
  for (let i = 0; i < width; i++) {
    const h1 = flatHead1[i] ?? ""
    const h2 = flatHead2[i] ?? ""
    const headerLen = Math.max(h1.length, h2.length)
    cols.push({ wch: Math.min(40, Math.max(8, headerLen + 2)) })
  }
  ws["!cols"] = cols

  // Row heights — taller logo + title rows, normal everywhere else.
  const rows: { hpt?: number }[] = []
  rows[LOGO_ROW] = { hpt: hasLogo ? 62 : 6 }
  rows[TITLE_ROW] = { hpt: 24 }
  rows[SUBTITLE_ROW] = { hpt: 16 }
  rows[H1_ROW] = { hpt: 22 }
  rows[H2_ROW] = { hpt: 22 }
  ws["!rows"] = rows

  // ── Styling ──
  styleCell(ws, TITLE_ROW, 0, TITLE_STYLE)
  styleCell(ws, SUBTITLE_ROW, 0, SUBTITLE_STYLE)
  for (let c = 0; c < width; c++) {
    styleCell(ws, H1_ROW, c, HEADER_STYLE)
    styleCell(ws, H2_ROW, c, HEADER_STYLE)
  }
  for (let r = 0; r < body.length; r++) {
    const zebra = r % 2 === 1
    const style = bodyStyle(zebra)
    for (let c = 0; c < width; c++) {
      styleCell(ws, BODY_START_ROW + r, c, style)
    }
  }

  // Freeze under the two header rows so the schema stays visible while
  // scrolling through hundreds of rows. SheetJS reads `!views` for frozen
  // pane configuration; the legacy `!freeze` property had no effect.
  ;(ws as Record<string, unknown>)["!views"] = [{ state: "frozen", xSplit: 0, ySplit: BODY_START_ROW }]

  return ws
}

function workbookToBlob(wb: XLSX.WorkBook): Blob {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

/* ─────────────────────────── Logo injection ───────────────────────────
 *
 * The community sheetjs build cannot write images. To match the PDF (which
 * carries the user's uploaded logo at the top corners of every page), we
 * post-process the generated .xlsx zip and inject the OOXML drawing parts
 * by hand. Strictly additive — every artifact lives in fresh paths, so
 * existing sheet content is untouched.
 *
 * For a single-sheet workbook (which is all generateExcel produces) the
 * additions are:
 *   xl/media/image1.<ext>            — the logo file bytes
 *   xl/media/image2.<ext>            — optional right logo
 *   xl/drawings/drawing1.xml         — anchor + size + image refs
 *   xl/drawings/_rels/drawing1.xml.rels
 *   xl/worksheets/_rels/sheet1.xml.rels  (created or merged)
 *   xl/worksheets/sheet1.xml         (one <drawing r:id="..."/> appended)
 *   [Content_Types].xml              (Default + Override entries)
 */

interface ParsedLogo {
  ext: "png" | "jpeg"
  body: string
}

/** Decode a `data:image/png;base64,...` URL into the bits xlsx needs. WEBP
 *  isn't supported by older Excel builds so it's filtered out — the PDF
 *  still renders it; the .xlsx silently skips it. */
function parseLogoDataUrl(dataUrl: string | undefined): ParsedLogo | null {
  if (!dataUrl || typeof dataUrl !== "string") return null
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i)
  if (!m) return null
  const ext = m[1].toLowerCase().replace("jpg", "jpeg") as "png" | "jpeg"
  return { ext, body: m[2] }
}

const SHEET_PATH = "xl/worksheets/sheet1.xml"
const SHEET_RELS_PATH = "xl/worksheets/_rels/sheet1.xml.rels"

function buildDrawingXml(images: { rId: string; isLeft: boolean; sheetWidth: number }[]): string {
  // ~25mm × 18mm in EMU (914400 per inch, 360000 per cm).
  const cx = 900000
  const cy = 648000
  const anchors = images
    .map((img, idx) => {
      const fromCol = img.isLeft ? 0 : Math.max(0, img.sheetWidth - 1)
      return `  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>${fromCol}</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>0</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="${cx}" cy="${cy}"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="${idx + 1}" name="Logo${idx + 1}"/>
        <xdr:cNvPicPr/>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${img.rId}"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>`
    })
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
${anchors}
</xdr:wsDr>`
}

function buildDrawingRels(rels: { rId: string; target: string }[]): string {
  const items = rels
    .map(
      (r) =>
        `  <Relationship Id="${r.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${r.target}"/>`,
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${items}
</Relationships>`
}

/** Pick the next free `rIdN` for a rels XML doc. Each rels file has its own
 *  Id namespace so we count locally to avoid colliding with sheetjs's own
 *  shared-strings / styles relationships. */
function nextRelId(xml: string): string {
  let max = 0
  for (const m of xml.matchAll(/Id="rId(\d+)"/g)) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  return `rId${max + 1}`
}

/** Append a single `<Relationship>` to a rels XML, creating the file if it
 *  didn't exist. Returns the chosen rId. */
function appendRel(existing: string | null, type: string, target: string): { xml: string; id: string } {
  if (!existing || !existing.trim()) {
    const id = "rId1"
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${id}" Type="${type}" Target="${target}"/>
</Relationships>`
    return { xml, id }
  }
  const id = nextRelId(existing)
  const xml = existing.replace(
    /<\/Relationships>\s*$/,
    `  <Relationship Id="${id}" Type="${type}" Target="${target}"/>\n</Relationships>`,
  )
  return { xml, id }
}

/** Add the `<drawing r:id="..."/>` reference to the worksheet XML. Per the
 *  OOXML schema the drawing element must appear toward the end of
 *  `<worksheet>`, so injecting just before `</worksheet>` is safe. */
function attachDrawingToSheet(sheetXml: string, drawingRelId: string): string {
  if (sheetXml.includes("<drawing ")) return sheetXml
  return sheetXml.replace(/<\/worksheet>\s*$/, `<drawing r:id="${drawingRelId}"/></worksheet>`)
}

/** Make sure [Content_Types].xml declares the image extensions and the
 *  drawing override. The Default Extension entries are idempotent — if the
 *  extension is already declared (e.g., sheetjs already added "png" for
 *  some reason), we skip. */
function patchContentTypes(xml: string, exts: Set<string>, drawingPart: string): string {
  let out = xml
  for (const ext of exts) {
    const mime = ext === "jpeg" ? "image/jpeg" : `image/${ext}`
    if (!new RegExp(`Default[^/]*Extension="${ext}"`).test(out)) {
      out = out.replace(
        /<Types([^>]*)>/,
        `<Types$1><Default Extension="${ext}" ContentType="${mime}"/>`,
      )
    }
  }
  if (!out.includes(`PartName="${drawingPart}"`)) {
    out = out.replace(
      /<\/Types>\s*$/,
      `<Override PartName="${drawingPart}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    )
  }
  return out
}

async function injectLogosIntoXlsx(blob: Blob, logos: PdfLogos | undefined, sheetWidth: number): Promise<Blob> {
  const left = parseLogoDataUrl(logos?.left)
  const right = parseLogoDataUrl(logos?.right)
  if (!left && !right) return blob

  const buf = await blob.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)

  const drawingRels: { rId: string; target: string }[] = []
  const exts = new Set<string>()
  const anchors: { rId: string; isLeft: boolean; sheetWidth: number }[] = []

  let imgIdx = 0
  if (left) {
    imgIdx++
    const file = `image${imgIdx}.${left.ext}`
    zip.file(`xl/media/${file}`, left.body, { base64: true })
    drawingRels.push({ rId: `rId${imgIdx}`, target: `../media/${file}` })
    anchors.push({ rId: `rId${imgIdx}`, isLeft: true, sheetWidth })
    exts.add(left.ext)
  }
  if (right) {
    imgIdx++
    const file = `image${imgIdx}.${right.ext}`
    zip.file(`xl/media/${file}`, right.body, { base64: true })
    drawingRels.push({ rId: `rId${imgIdx}`, target: `../media/${file}` })
    anchors.push({ rId: `rId${imgIdx}`, isLeft: false, sheetWidth })
    exts.add(right.ext)
  }

  zip.file("xl/drawings/drawing1.xml", buildDrawingXml(anchors))
  zip.file("xl/drawings/_rels/drawing1.xml.rels", buildDrawingRels(drawingRels))

  // Sheet rels — append the drawing relationship (sheetjs doesn't always
  // emit this file for plain sheets, so appendRel handles the missing case).
  const existingSheetRels = (await zip.file(SHEET_RELS_PATH)?.async("text")) ?? null
  const drawingRel = appendRel(
    existingSheetRels,
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
    "../drawings/drawing1.xml",
  )
  zip.file(SHEET_RELS_PATH, drawingRel.xml)

  const sheetXml = await zip.file(SHEET_PATH)!.async("text")
  zip.file(SHEET_PATH, attachDrawingToSheet(sheetXml, drawingRel.id))

  const ctXml = await zip.file("[Content_Types].xml")!.async("text")
  zip.file("[Content_Types].xml", patchContentTypes(ctXml, exts, "/xl/drawings/drawing1.xml"))

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function hasUsableLogo(logos?: PdfLogos): boolean {
  return !!(parseLogoDataUrl(logos?.left) || parseLogoDataUrl(logos?.right))
}

/** Per-type Excel — one sheet, same layout as a per-type PDF. */
export async function generateExcel(
  type: string,
  rows: SupportRow[],
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  mapping?: ProjectMapping,
  logos?: PdfLogos,
): Promise<Blob> {
  const schema = buildSchema({ rows, typeConfigs, scopeToRows: true }, mapping)
  const subtitle = `${projectName ? `${projectName} | ` : ""}${rows.length} supports`
  const ws = buildSheet({ title: `Support Schedule — ${type}`, subtitle, schema, hasLogo: hasUsableLogo(logos) })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, type.slice(0, 31) || "Schedule")
  const blob = workbookToBlob(wb)
  return injectLogosIntoXlsx(blob, logos, schema.width)
}

/** Combined Excel — every row across every type in one continuous sheet,
 *  rows grouped by type to match the PDF. */
export async function generateCombinedExcel(
  grouped: GroupedSupports,
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  mapping?: ProjectMapping,
  logos?: PdfLogos,
): Promise<Blob> {
  const allRows: SupportRow[] = []
  const typesUsed: string[] = []
  for (const [type, rows] of Object.entries(grouped)) {
    if (!rows.length) continue
    typesUsed.push(type)
    for (const r of rows) allRows.push(r)
  }
  const schema = buildSchema({ rows: allRows, typeConfigs }, mapping)
  const subtitle = [
    projectName,
    `${allRows.length} supports`,
    typesUsed.length > 0 ? `${typesUsed.length} type${typesUsed.length !== 1 ? "s" : ""}: ${typesUsed.join(", ")}` : null,
  ].filter(Boolean).join(" | ")
  const ws = buildSheet({ title: "Support Schedule — Combined", subtitle, schema, hasLogo: hasUsableLogo(logos) })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Combined")
  const blob = workbookToBlob(wb)
  return injectLogosIntoXlsx(blob, logos, schema.width)
}

/** Selection Excel — explicit row set, same layout. Same as combined but
 *  with a different title and no group header. */
export async function generateSelectionExcel(
  rows: SupportRow[],
  projectName?: string,
  typeConfigs: SupportTypeConfig[] = [],
  mapping?: ProjectMapping,
  logos?: PdfLogos,
): Promise<Blob> {
  const buckets: Record<string, SupportRow[]> = {}
  for (const r of rows) {
    const t = r.type || "Unknown"
    if (!buckets[t]) buckets[t] = []
    buckets[t].push(r)
  }
  const ordered: SupportRow[] = []
  for (const rs of Object.values(buckets)) ordered.push(...rs)
  const typesUsed = Array.from(new Set(rows.map((r) => r.type).filter(Boolean)))
  const schema = buildSchema({ rows: ordered, typeConfigs }, mapping)
  const subtitle = [
    projectName,
    `Selected · ${rows.length} supports`,
    typesUsed.length > 0 ? typesUsed.join(", ") : null,
  ].filter(Boolean).join(" | ")
  const ws = buildSheet({ title: "Support Schedule — Selection", subtitle, schema, hasLogo: hasUsableLogo(logos) })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Selection")
  const blob = workbookToBlob(wb)
  return injectLogosIntoXlsx(blob, logos, schema.width)
}
