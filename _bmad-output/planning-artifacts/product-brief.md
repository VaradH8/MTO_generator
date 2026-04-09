# Product Brief: Support PDF Generator

## Executive Summary

Support PDF Generator is a web-based utility that converts structured Excel data into organized, type-grouped PDF documents. It targets engineering and construction teams who manage piping or structural support data in spreadsheets and need clean, print-ready documentation grouped by support type.

The app eliminates the manual, error-prone process of copying support data from spreadsheets into formatted documents. A user uploads an Excel file, the app validates and groups the data by support type, flags any missing fields for review, and generates one PDF per type — ready for download individually or as a bundled zip.

Phase 1 is a focused, single-user, stateless tool: upload, validate, review, generate, download. No accounts, no database, no history. Ship the smallest thing that proves the workflow works.

## The Problem

Engineering teams maintain support schedules in Excel spreadsheets with 20+ columns of data per support — tag names, disciplines, types, dimensional data, item lists, coordinates, grid references, and remarks. When they need to produce documentation grouped by support type, the current process is:

1. Manually filter or sort the spreadsheet by type
2. Copy-paste rows into a document or separate sheets
3. Format tables for print or PDF export
4. Repeat for every support type in the file

This is tedious, error-prone, and breaks every time the source data changes. Missing fields go unnoticed until someone catches them downstream. The larger the dataset, the worse it gets.

## The Solution

A single-purpose web app with a clear three-step workflow:

1. **Upload** — Drag or select an Excel file. The app parses it instantly using SheetJS and validates that all expected columns exist.
2. **Review** — If any rows have missing required fields, a review screen presents them for the user to fill in before proceeding. No bad data makes it into the output.
3. **Download** — The app groups all rows by the "Type" column and generates one PDF per type, each containing a formatted table of all supports of that type. Download individually or grab them all as a zip.

No signup. No setup. Open the page, upload your file, get your PDFs.

## Who This Serves

**Primary User: The Support Engineer / Design Engineer**
Works in piping, structural, or mechanical disciplines. Maintains support data in Excel. Needs to produce grouped documentation for submittals, reviews, or field use. Technically competent but not a developer — comfortable with spreadsheets and web tools.

They care about:
- Speed — upload to PDFs in under a minute
- Accuracy — every row accounted for, no missing data slipping through
- Simplicity — no learning curve, no account creation

## Data Model

The app reads and processes these 20 columns from the uploaded Excel file:

| Column | Description |
|--------|-------------|
| Support Tag Name | Unique identifier for the support |
| Discipline | Engineering discipline (Piping, Structural, etc.) |
| Type | Support type — **the grouping key** |
| A, B, C, D | Dimensional parameters |
| Total | Computed or entered total value |
| Item-01 Name | First item name |
| Item-01 Quantity | First item quantity |
| Item-02 Name | Second item name |
| Item-02 Quantity | Second item quantity |
| Item-03 Name | Third item name |
| Item-03 Quantity | Third item quantity |
| X, Y, Z | Coordinate values |
| X-Grid | X grid reference |
| Y-Grid | Y grid reference |
| Remarks | Free-text notes |

**Required fields for PDF generation:** Support Tag Name, Type (at minimum — these are needed for grouping and identification). Other fields may be blank and will render as empty cells in the PDF.

**Grouping logic:** All rows sharing the same "Type" value are collected into one PDF. Each PDF contains a table with all columns for all supports of that type.

## Design Direction

- **Visual system:** Cobalt Blue color scheme (custom CSS variables defined)
- **Typography:** Space Grotesk for headings, Josefin Sans for body text
- **Feel:** Dashboard / internal tool aesthetic — left-aligned, clean, technical
- **Not:** A marketing page, a SaaS product landing page, or anything with decorative elements

### Color System

```
--color-bg:             #f3f5fa
--color-surface:        #ffffff
--color-surface-2:      #e9edf6
--color-surface-offset: #dce3f0
--color-border:         #c9d2e4
--color-text:           #0d1530
--color-text-muted:     #4a5478
--color-text-faint:     #7a8299
--color-primary:        #1f3ca8
--color-primary-hover:  #15307f
--color-primary-soft:   rgba(31, 60, 168, 0.13)
--color-success:        #1f7a4d
--color-warning:        #9a6400
--color-error:          #b02a37
--color-shadow:         rgba(15, 25, 60, 0.08)
```

## Phase 1 Scope

### In Scope

| Feature | Description |
|---------|-------------|
| File upload page | Drag-and-drop or file picker for .xlsx/.xls files |
| Excel parsing | Client-side parsing with SheetJS |
| Column validation | Verify all 20 expected columns exist in the uploaded file |
| Data grouping | Group all parsed rows by the "Type" column |
| Missing field review | Present rows with missing required fields for user to complete |
| PDF generation | One PDF per support type with a formatted data table |
| Download page | Individual PDF download + "download all as zip" option |

### Explicitly Out of Scope

| Feature | Reason |
|---------|--------|
| DWG file processing | Future phase — different input format entirely |
| AutoCAD integration | Future phase — requires desktop tooling or plugin work |
| User authentication | No multi-user need in phase 1 |
| Database / persistence | Stateless tool — no data stored between sessions |
| Multi-user support | Single user, single session model |
| Job history | No persistence means no history — future phase if needed |

## Success Criteria

| Signal | Metric |
|--------|--------|
| Core workflow works | User can go from Excel upload to downloaded PDFs in under 60 seconds for a typical file |
| Data integrity | Every row from the source file appears in exactly one output PDF, grouped correctly by type |
| Missing field detection | 100% of rows with missing required fields are caught and presented for review |
| Zero friction start | No signup, no install — open URL, upload file, get results |
| Deployment works | App runs reliably on Vercel free tier with no cold-start issues affecting UX |

## Vision

If Phase 1 validates the workflow, future phases could expand into:

- **DWG processing** — Extract support data directly from AutoCAD drawings
- **AutoCAD integration** — Bi-directional sync between drawings and support data
- **Templates** — Custom PDF layouts per organization or project
- **Job history** — Persist past generations for re-download or comparison
- **Team features** — Shared access, approval workflows, audit trails
- **API access** — Programmatic generation for CI/build pipelines

But that's all speculation until Phase 1 ships and real users confirm the core workflow is worth building on. Ship first, expand later.
