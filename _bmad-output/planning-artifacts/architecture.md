# Architecture: Support PDF Generator

> Phase 1 — Stateless, single-user web tool  
> Reference: [product-brief.md](product-brief.md)

---

## 1. Tech Stack (Locked)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Excel parsing | SheetJS (xlsx) | latest |
| PDF generation | jsPDF + jsPDF-AutoTable | latest |
| Zip bundling | JSZip | latest |
| Deployment | Vercel free tier | — |
| State management | React useState + useContext | — |
| Database | None (Phase 1) | — |
| Authentication | None (Phase 1) | — |

---

## 2. Folder and File Structure

```
support-pdf-generator/
├── public/
│   └── fonts/
│       ├── SpaceGrotesk-Variable.woff2
│       └── JosefinSans-Variable.woff2
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout — fonts, global styles, AppProvider
│   │   ├── page.tsx                    # Upload page (home)
│   │   ├── review/
│   │   │   └── page.tsx               # Missing fields review page
│   │   └── download/
│   │       └── page.tsx               # PDF download page
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx             # Primary, secondary, icon button variants
│   │   │   ├── Card.tsx               # Surface container with border/shadow
│   │   │   ├── Badge.tsx              # Status badges (type count, warnings)
│   │   │   └── Alert.tsx              # Error/warning/success messages
│   │   ├── FileUploader.tsx           # Drag-and-drop + file picker component
│   │   ├── ColumnValidationResult.tsx # Shows pass/fail for column check
│   │   ├── ReviewTable.tsx            # Editable table for missing fields
│   │   ├── ReviewRow.tsx              # Single editable row in review table
│   │   ├── TypeGroupList.tsx          # Lists all support types with row counts
│   │   ├── DownloadCard.tsx           # Single PDF download card with preview info
│   │   ├── ProgressStepper.tsx        # 3-step progress indicator (Upload → Review → Download)
│   │   └── AppHeader.tsx              # App title and progress stepper
│   │
│   ├── context/
│   │   └── AppContext.tsx             # Global state: parsed data, validation, corrected rows
│   │
│   ├── lib/
│   │   ├── excel-parser.ts            # SheetJS parsing logic — file → SupportRow[]
│   │   ├── column-validator.ts        # Validates column headers exist in parsed sheet
│   │   ├── row-validator.ts           # Checks each row for missing required fields
│   │   ├── data-grouper.ts            # Groups SupportRow[] by Type → GroupedSupports
│   │   ├── pdf-generator.ts           # jsPDF + AutoTable — generates one PDF per type
│   │   └── zip-bundler.ts             # JSZip — bundles all PDFs into a zip
│   │
│   ├── types/
│   │   └── index.ts                   # All TypeScript interfaces
│   │
│   └── styles/
│       └── globals.css                # Tailwind directives, CSS variables, font-face
│
├── tailwind.config.ts                 # Tailwind config extending with color system + fonts
├── tsconfig.json
├── next.config.js
├── package.json
└── .gitignore
```

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `app/page.tsx` | Renders FileUploader, handles file selection, triggers parsing + validation, navigates to /review or /download |
| `app/review/page.tsx` | Renders ReviewTable with rows that have missing fields, collects user edits, navigates to /download |
| `app/download/page.tsx` | Renders TypeGroupList + DownloadCards, triggers PDF generation, handles zip download |
| `context/AppContext.tsx` | Holds all session state — raw rows, validation results, corrected rows, generated PDFs |
| `lib/excel-parser.ts` | Reads ArrayBuffer → XLSX workbook → first sheet → JSON rows → SupportRow[] |
| `lib/column-validator.ts` | Compares parsed column headers against EXPECTED_COLUMNS constant |
| `lib/row-validator.ts` | Iterates rows, checks required fields, returns ValidationResult |
| `lib/data-grouper.ts` | Takes SupportRow[], returns Map<string, SupportRow[]> keyed by Type |
| `lib/pdf-generator.ts` | Takes a type name + SupportRow[], returns jsPDF instance (or Blob) |
| `lib/zip-bundler.ts` | Takes Map<string, Blob>, returns zip Blob via JSZip |

---

## 3. API Routes

**There are no API routes in Phase 1.**

### Rationale

Every operation in Phase 1 runs **client-side**:

- **Excel parsing** — SheetJS reads an ArrayBuffer in the browser. No file upload to a server.
- **Validation** — Pure data logic, no server dependency.
- **PDF generation** — jsPDF runs entirely in the browser, producing Blobs.
- **Zip bundling** — JSZip runs in the browser.

This means:
- No Vercel serverless function cold starts
- No file upload size limits from Vercel's 4.5MB body limit on free tier
- No server memory pressure from large files
- Instant feedback — no network round-trips after initial page load
- The app works even with a slow connection after the initial load

**If Phase 2 needs server-side processing** (e.g., DWG files), API routes can be added then without refactoring the client-side pipeline.

---

## 4. Data Flow

### 4.1 Complete Flow: Upload → Download

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: UPLOAD (app/page.tsx)                          │
│                                                         │
│  User drops/selects .xlsx file                          │
│       │                                                 │
│       ▼                                                 │
│  FileUploader → File object                             │
│       │                                                 │
│       ▼                                                 │
│  file.arrayBuffer()                                     │
│       │                                                 │
│       ▼                                                 │
│  excel-parser.ts                                        │
│    XLSX.read(buffer) → workbook                         │
│    workbook.Sheets[first sheet] → JSON rows             │
│    Map JSON rows → SupportRow[]                         │
│       │                                                 │
│       ▼                                                 │
│  column-validator.ts                                    │
│    Compare parsed headers vs EXPECTED_COLUMNS           │
│    Return { valid: boolean, missing: string[] }         │
│       │                                                 │
│       ├── Missing columns? → Show error, stop           │
│       │                                                 │
│       ▼                                                 │
│  row-validator.ts                                       │
│    Check each row for required fields                   │
│    Return ValidationResult                              │
│       │                                                 │
│       ├── Has missing fields? → Store in context        │
│       │   → router.push('/review')                      │
│       │                                                 │
│       └── All valid? → Store in context                 │
│           → router.push('/download')                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  STEP 2: REVIEW (app/review/page.tsx)                   │
│  (only if missing fields detected)                      │
│                                                         │
│  Read rows with missing fields from context             │
│       │                                                 │
│       ▼                                                 │
│  ReviewTable renders editable rows                      │
│    Each ReviewRow shows:                                │
│    - Support Tag Name (read-only identifier)            │
│    - Missing field cells (editable inputs)              │
│    - Valid field cells (read-only display)              │
│       │                                                 │
│       ▼                                                 │
│  User fills in missing values                           │
│       │                                                 │
│       ▼                                                 │
│  "Continue" button                                      │
│    Re-run row-validator on edited rows                  │
│    Merge corrected rows back into full dataset          │
│    Store updated SupportRow[] in context                │
│       │                                                 │
│       ├── Still missing? → Show remaining errors        │
│       │                                                 │
│       └── All valid? → router.push('/download')         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  STEP 3: DOWNLOAD (app/download/page.tsx)               │
│                                                         │
│  Read validated SupportRow[] from context               │
│       │                                                 │
│       ▼                                                 │
│  data-grouper.ts                                        │
│    Group rows by Type → GroupedSupports                 │
│       │                                                 │
│       ▼                                                 │
│  TypeGroupList shows each type + row count              │
│       │                                                 │
│       ▼                                                 │
│  User clicks "Generate PDFs"                            │
│       │                                                 │
│       ▼                                                 │
│  pdf-generator.ts (runs for each type)                  │
│    Create jsPDF instance (landscape A3)                 │
│    Add title: "Support Type: {typeName}"                │
│    Add table via autoTable with all columns             │
│    Return Blob                                          │
│       │                                                 │
│       ▼                                                 │
│  Store Map<typeName, Blob> in component state           │
│       │                                                 │
│       ▼                                                 │
│  DownloadCard per type                                  │
│    "Download PDF" → URL.createObjectURL → <a> click     │
│                                                         │
│  "Download All as ZIP"                                  │
│    zip-bundler.ts                                       │
│      JSZip → add each Blob as {typeName}.pdf            │
│      Generate zip → download via <a> click              │
└─────────────────────────────────────────────────────────┘
```

### 4.2 State Flow Through Context

```
AppContext holds:
┌──────────────────────────────────────────┐
│  rows: SupportRow[]          // all parsed rows (updated after review)
│  validationResult: ValidationResult | null
│  fileName: string | null
│  step: 'upload' | 'review' | 'download'
│                                          │
│  Actions:                                │
│  setRows(rows)              // after parse or after review corrections
│  setValidationResult(result)
│  setFileName(name)
│  setStep(step)
│  reset()                    // clear all, back to upload
└──────────────────────────────────────────┘
```

**Key rule:** Context holds the *data*. Components hold their own *UI state* (loading spinners, form inputs). PDFs are generated on-demand and held in local component state on the download page — they do not go into context.

---

## 5. Component Tree

```
RootLayout (layout.tsx)
  └── AppProvider (context/AppContext.tsx)         ← global state
      └── AppHeader                                ← title + ProgressStepper
          │
          ├── UploadPage (app/page.tsx)            ← local state: isLoading, error
          │   ├── ProgressStepper (step=upload)
          │   ├── FileUploader                     ← local state: isDragging
          │   ├── ColumnValidationResult           ← displays validation pass/fail
          │   └── Alert (if column errors)
          │
          ├── ReviewPage (app/review/page.tsx)     ← local state: editedRows
          │   ├── ProgressStepper (step=review)
          │   ├── Alert (count of rows needing review)
          │   ├── ReviewTable
          │   │   └── ReviewRow (× N)              ← local state: field inputs
          │   └── Button ("Continue")
          │
          └── DownloadPage (app/download/page.tsx) ← local state: pdfBlobs, isGenerating
              ├── ProgressStepper (step=download)
              ├── TypeGroupList
              │   └── Badge (× N type counts)
              ├── Button ("Generate PDFs")
              ├── DownloadCard (× N per type)
              └── Button ("Download All as ZIP")
```

### State Ownership

| Component | State Held | Type |
|-----------|-----------|------|
| AppContext | rows, validationResult, fileName, step | Context (global) |
| UploadPage | isLoading, parseError | useState (local) |
| FileUploader | isDragging | useState (local) |
| ReviewPage | editedRows (copy for editing) | useState (local) |
| ReviewRow | individual field values | useState (local) |
| DownloadPage | pdfBlobs, isGenerating, generationProgress | useState (local) |

---

## 6. Type Definitions

```typescript
// src/types/index.ts

/**
 * One row from the Excel file — all 20 columns.
 * All fields are strings. Empty cells become empty strings.
 */
export interface SupportRow {
  supportTagName: string;
  discipline: string;
  type: string;
  a: string;
  b: string;
  c: string;
  d: string;
  total: string;
  item01Name: string;
  item01Quantity: string;
  item02Name: string;
  item02Quantity: string;
  item03Name: string;
  item03Quantity: string;
  x: string;
  y: string;
  z: string;
  xGrid: string;
  yGrid: string;
  remarks: string;
}

/**
 * Mapping from Excel column headers to SupportRow keys.
 * Used by the parser to normalize header names.
 */
export const COLUMN_MAP: Record<string, keyof SupportRow> = {
  'Support Tag Name': 'supportTagName',
  'Discipline': 'discipline',
  'Type': 'type',
  'A': 'a',
  'B': 'b',
  'C': 'c',
  'D': 'd',
  'Total': 'total',
  'Item-01 Name': 'item01Name',
  'Item-01 Quantity': 'item01Quantity',
  'Item-02 Name': 'item02Name',
  'Item-02 Quantity': 'item02Quantity',
  'Item-03 Name': 'item03Name',
  'Item-03 Quantity': 'item03Quantity',
  'X': 'x',
  'Y': 'y',
  'Z': 'z',
  'X-Grid': 'xGrid',
  'Y-Grid': 'yGrid',
  'Remarks': 'remarks',
};

/**
 * The 20 expected Excel column headers.
 */
export const EXPECTED_COLUMNS: string[] = Object.keys(COLUMN_MAP);

/**
 * Fields that must be non-empty for a row to pass validation.
 */
export const REQUIRED_FIELDS: (keyof SupportRow)[] = [
  'supportTagName',
  'type',
];

/**
 * Rows grouped by Type value.
 */
export type GroupedSupports = Map<string, SupportRow[]>;

/**
 * Identifies one missing field on one row.
 */
export interface MissingField {
  rowIndex: number;
  field: keyof SupportRow;
  columnHeader: string;        // original Excel header for display
}

/**
 * Result of validating all rows.
 */
export interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingFields: MissingField[];
}

/**
 * Result of validating column headers.
 */
export interface ColumnValidationResult {
  valid: boolean;
  found: string[];
  missing: string[];
}

/**
 * A generated PDF ready for download.
 */
export interface GeneratedPDF {
  typeName: string;
  rowCount: number;
  blob: Blob;
  fileName: string;            // e.g., "Type-A_supports.pdf"
}
```

---

## 7. Key Implementation Decisions

### 7.1 Excel Parsing — Client-Side

**Decision:** Parse Excel entirely in the browser using SheetJS.

**How it works:**
1. User selects file via `<input>` or drag-and-drop
2. Read file as `ArrayBuffer` using `file.arrayBuffer()`
3. `XLSX.read(buffer, { type: 'array' })` → workbook object
4. Take first sheet: `workbook.Sheets[workbook.SheetNames[0]]`
5. `XLSX.utils.sheet_to_json(sheet, { header: 1 })` → raw 2D array
6. First row = headers → validate against `EXPECTED_COLUMNS`
7. Remaining rows → map to `SupportRow[]` using `COLUMN_MAP`
8. Empty cells become `""` (empty string), not `undefined`

**Why client-side:**
- No server round-trip — instant parsing
- No Vercel body size limits (free tier: 4.5MB request body)
- SheetJS is ~350KB gzipped — acceptable for a tool app
- No server memory pressure from concurrent file processing

**Trade-off:** Large files (10K+ rows) may cause a brief UI freeze. Acceptable for Phase 1 — can add a Web Worker in Phase 2 if needed.

### 7.2 PDF Generation — Client-Side

**Decision:** Generate PDFs in the browser using jsPDF + jsPDF-AutoTable.

**How it works:**
1. For each type group, create a new `jsPDF` instance
2. Page setup: landscape A3 to fit all 20 columns
3. Add header text: type name, generation date, row count
4. Call `autoTable()` with:
   - `head`: column headers array
   - `body`: row data as 2D string array
   - `styles`: small font (7-8pt), compact padding for density
   - `headStyles`: Cobalt Blue primary color as background
5. Return `doc.output('blob')` → `Blob`

**Why client-side:**
- Same rationale as parsing — no server needed
- jsPDF + AutoTable is ~200KB gzipped
- Keeps the app fully stateless and serverless

**PDF layout specifics:**
- Landscape A3 (420mm × 297mm) — necessary to fit 20 columns readably
- Column widths: proportional, with wider columns for names/remarks and narrow columns for single-letter fields (A, B, C, D, X, Y, Z)
- Header row: primary color background (#1f3ca8), white text
- Alternating row shading using surface-2 color
- Footer: page numbers

### 7.3 Missing Field Review Screen

**Decision:** Inline editable table showing only rows with missing required fields.

**How it works:**
1. After parsing, `row-validator.ts` checks every row against `REQUIRED_FIELDS`
2. Returns `ValidationResult` with list of `MissingField` entries
3. Review page filters to only rows that have at least one missing required field
4. Each row renders with:
   - Read-only cells for fields that have values
   - Editable `<input>` cells (highlighted) for missing fields
   - The Support Tag Name column always visible as row identifier
5. User fills in values and clicks "Continue"
6. Re-validate — if still missing, highlight remaining issues
7. When all valid, merge edits back into the full `rows[]` array in context

**Key UX detail:** The review screen shows the *entire row* (not just the missing fields) so the user has context when filling in values. Missing fields are visually distinct — highlighted background with a border.

### 7.4 Zip Download

**Decision:** Bundle all PDFs into a zip using JSZip, entirely client-side.

**How it works:**
1. After PDF generation, all blobs are stored in component state as `GeneratedPDF[]`
2. "Download All as ZIP" button triggers `zip-bundler.ts`
3. Create `new JSZip()`
4. For each `GeneratedPDF`, call `zip.file(fileName, blob)`
5. `zip.generateAsync({ type: 'blob' })` → zip Blob
6. Create temporary `<a>` element, set `href` to `URL.createObjectURL(zipBlob)`
7. Set `download` attribute to `support-pdfs-{date}.zip`
8. Programmatic click → browser download dialog
9. Revoke object URL after download

**JSZip is ~45KB gzipped** — negligible addition to bundle.

### 7.5 Navigation and Routing

**Decision:** Use Next.js App Router with `router.push()` for page transitions. No dynamic routes needed.

| Route | Purpose | Entry Condition |
|-------|---------|-----------------|
| `/` | Upload page | Default / reset |
| `/review` | Fix missing fields | Redirected from upload when invalid rows found |
| `/download` | Generate + download PDFs | Redirected from upload (all valid) or review (all fixed) |

**Guard behavior:** Each page checks context on mount. If the required data isn't there (e.g., navigating directly to `/download` with no rows), redirect to `/`.

### 7.6 File Naming Conventions

| Output | Naming Pattern | Example |
|--------|---------------|---------|
| Single PDF | `{type-name}_supports.pdf` | `Spring-Hanger_supports.pdf` |
| Zip bundle | `support-pdfs_{YYYY-MM-DD}.zip` | `support-pdfs_2026-04-08.zip` |

Type names are sanitized for filenames: spaces → hyphens, special characters stripped.

---

## 8. What Is Explicitly NOT in This Phase

| Excluded | Rationale |
|----------|-----------|
| API routes | All processing is client-side. No server endpoints needed. |
| Database | No persistence. Data lives only in React context for the session. |
| Authentication | Single anonymous user per session. No accounts. |
| File storage | No uploaded files or generated PDFs are stored server-side. |
| Web Workers | Parsing/PDF generation runs on main thread. Acceptable for typical file sizes. Add if perf issues arise. |
| Server-Side Rendering for data pages | Upload, review, download pages use client-side state only. SSR adds no value here. |
| DWG processing | Different input format, different libraries, different architecture. Future phase. |
| AutoCAD integration | Requires plugin or desktop tooling. Out of scope. |
| Custom PDF templates | One fixed table layout per type. Custom layouts are a future feature. |
| Multi-file upload | One file at a time. Upload a new file = start over. |
| Job history / persistence | No local storage, no IndexedDB, no server storage. Refresh = reset. |
| Error recovery / auto-save | If the user refreshes mid-review, they re-upload. Acceptable for Phase 1. |
| Internationalization | English only. |
| Accessibility audit | Basic semantic HTML and keyboard support, but no formal WCAG audit in Phase 1. |

---

## 9. Dependency List

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "xlsx": "^0.18.5",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "jszip": "^3.10.1"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.0.0",
    "autoprefixer": "^10.0.0"
  }
}
```

**Total client-side library overhead:** ~600KB gzipped (SheetJS ~350KB, jsPDF+AutoTable ~200KB, JSZip ~45KB). Acceptable for an internal tool — these are loaded once and cached.

---

## 10. Vercel Free Tier Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| 4.5MB request body limit | No impact — no server upload | Client-side parsing |
| 10s serverless function timeout | No impact — no serverless functions | Client-side everything |
| 100GB bandwidth/month | Minimal — static app + JS bundles only | CDN caching handles repeat visits |
| 1000 build minutes/month | Low build frequency expected | Only rebuilds on deploy |

The architecture is **deliberately designed** to avoid all Vercel free tier pain points by keeping everything client-side.
