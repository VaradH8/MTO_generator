# Page Specifications — Support PDF Generator

**Last Updated:** 2026-04-08
**Pages:** 3 (Upload, Review, Output)
**Token Reference:** [tokens.md](tokens.md)

---

## Global Shell

All three pages share a common shell layout.

### App Header

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Height          | 56px                                               |
| Background      | `color-surface`                                    |
| Border bottom   | 1px solid `color-border`                           |
| Shadow          | `shadow-sm`                                        |
| Padding-x       | `space-6` (24px)                                   |
| Z-index         | `z-sticky` (200)                                   |
| Position        | sticky top: 0                                      |

**Contents (left to right):**

1. **Logo** — 28x28px icon, `space-3` gap to text
2. **App name** — `font-display`, `text-lg` (18px), `font-bold`, `color-text`
3. **Spacer** — flex-grow
4. **Theme toggle** (optional) — icon button, 32x32px, `radius-full`

### Page Container

| Property   | Value                          |
| ---------- | ------------------------------ |
| Max-width  | `container-max` (1120px)       |
| Padding-x  | `container-pad-x` (24px)      |
| Padding-y  | `space-10` (40px)              |
| Margin     | 0 auto                        |
| Background | `color-bg`                     |
| Min-height | calc(100vh - 56px)             |

### Page Title

| Property       | Value                                    |
| -------------- | ---------------------------------------- |
| Font           | `font-display` (Space Grotesk)           |
| Size           | `text-2xl` (24px)                        |
| Weight         | `font-bold` (700)                        |
| Color          | `color-text`                             |
| Margin-bottom  | `space-2` (8px)                          |
| Letter-spacing | `tracking-tight` (-0.01em)               |

### Page Subtitle

| Property       | Value                                    |
| -------------- | ---------------------------------------- |
| Font           | `font-body` (Josefin Sans)               |
| Size           | `text-base` (16px)                       |
| Weight         | `font-normal` (400)                      |
| Color          | `color-text-muted`                       |
| Margin-bottom  | `space-8` (32px)                         |

---

## Page 1 — Upload

**Route:** `/` (default)
**Purpose:** User uploads an Excel file (.xlsx / .xls), validates it, and triggers parsing.

### Layout

```
+--------------------------------------------------+
| [Logo] Support PDF Generator          [theme]    |
+--------------------------------------------------+
|                                                  |
|  Upload Excel File                               |
|  Select the support schedule spreadsheet.        |
|                                                  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |        [upload icon]                       |  |
|  |                                            |  |
|  |   Drag & drop your file here              |  |
|  |   or click to browse                      |  |
|  |                                            |  |
|  |   .xlsx, .xls — max 10 MB                 |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|  +--------------------------------------------+  |
|  | [file icon]  filename.xlsx    12 KB   [x]  |  |
|  +--------------------------------------------+  |
|                                                  |
|  [validation message area]                       |
|                                                  |
|                        [ Parse File  ->]         |
|                                                  |
+--------------------------------------------------+
```

### Component List

#### 1. Upload Zone

| Property        | Value                                     |
| --------------- | ----------------------------------------- |
| Border          | `upload-border-width` (2px), `upload-border-style` (dashed), `upload-border-color` |
| Background      | `upload-bg` (`color-surface`)             |
| Border-radius   | `upload-radius` (`radius-lg`, 10px)       |
| Padding         | `upload-padding` (`space-12`, 48px)       |
| Text-align      | center                                    |
| Min-height      | 200px                                     |
| Cursor          | pointer                                   |
| Transition      | `transition-base` (200ms)                 |

**Upload icon:**
- Size: 48x48px
- Color: `color-text-faint`
- Margin-bottom: `space-4`

**Primary text:** `font-display`, `text-base`, `font-medium`, `color-text`
**Secondary text:** `font-body`, `text-sm`, `color-text-muted`
**Format hint:** `font-body`, `text-xs`, `color-text-faint`, margin-top: `space-3`

**Accepts:** `.xlsx`, `.xls` (set via input accept attribute)
**Max size:** 10 MB (client-side validation)

#### 2. File Info Bar

Appears below the upload zone after a file is selected. Replaces the upload zone visually (upload zone collapses to a compact strip or is hidden).

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Background   | `color-surface`                              |
| Border       | 1px solid `color-border`                     |
| Radius       | `radius-md` (6px)                            |
| Padding      | `space-3` x `space-4`                        |
| Display      | flex, align-items: center, gap: `space-3`    |
| Shadow       | `shadow-sm`                                  |

**Contents:**
- File type icon — 20x20px, `color-primary`
- File name — `font-body`, `text-sm`, `font-medium`, `color-text`, truncate with ellipsis at 300px max-width
- File size — `font-body`, `text-xs`, `color-text-muted`
- Remove button (x) — 24x24px icon button, `color-text-faint`, hover: `color-error`

#### 3. Validation Feedback

Appears below the file info bar. Only visible when validation has run.

| Variant  | Border-left              | Background             | Icon color      | Text color        |
| -------- | ------------------------ | ---------------------- | --------------- | ----------------- |
| Success  | 3px solid `color-success`| `color-success-soft`   | `color-success` | `color-text`      |
| Error    | 3px solid `color-error`  | `color-error-soft`     | `color-error`   | `color-text`      |

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Radius       | `radius-sm` (4px)                            |
| Padding      | `space-3` x `space-4`                        |
| Font         | `font-body`, `text-sm`                       |
| Margin-top   | `space-4`                                    |

**Success message:** "Valid Excel file. Ready to parse."
**Error messages:**
- "Invalid file type. Please upload .xlsx or .xls"
- "File exceeds 10 MB limit."
- "File appears to be empty or corrupted."

#### 4. Parse File Button

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Height       | `button-height` (40px)                       |
| Padding-x    | `button-padding-x` (20px)                   |
| Font         | `button-font-family` (Space Grotesk)         |
| Font-size    | `button-font-size` (14px)                    |
| Font-weight  | `button-font-weight` (600)                   |
| Radius       | `button-radius` (6px)                        |
| Shadow       | `button-shadow` (`shadow-sm`)                |
| Alignment    | right-aligned within container               |
| Margin-top   | `space-6`                                    |

**Includes:** trailing arrow icon (16px), `space-2` gap

### States

#### Empty (default)

- Upload zone visible at full size with dashed border
- File info bar hidden
- Validation feedback hidden
- Parse button **disabled**: `opacity: 0.45`, `cursor: not-allowed`, `background: color-primary`

#### File Selected — Validating

- Upload zone collapses / hides
- File info bar visible
- Validation feedback hidden (or shows a subtle inline spinner if validation takes >200ms)
- Parse button remains **disabled**

#### File Selected — Valid

- File info bar visible
- Validation feedback visible (success variant)
- Parse button **enabled**: `background: color-primary`, `color: #fff`, hover: `background: color-primary-hover`

#### File Selected — Invalid

- File info bar visible
- Validation feedback visible (error variant)
- Parse button **disabled**

#### Drag Over

- Upload zone: `border-color: upload-border-active` (`color-primary`), `background: upload-bg-active` (`color-primary-soft`)
- Upload icon color: `color-primary`
- Transition: `transition-fast` (120ms)

#### Loading (Parsing)

- Parse button text changes to "Parsing..." with a 16px spinner icon replacing the arrow
- Parse button **disabled** during loading
- File info bar and validation feedback remain visible
- Optional: progress bar below file info bar (indeterminate), height 3px, `color-primary`, `radius-full`

#### Parse Error

- Validation feedback area shows error variant with message from server
- Parse button re-enabled so user can retry
- Example: "Failed to parse file. Check that the sheet contains valid support data."

### Mobile Behavior (< `bp-md` / 768px)

- Upload zone padding reduces to `space-8` (32px)
- Upload icon size reduces to 36x36px
- Parse button becomes full-width
- File name truncation reduced to 200px
- Page padding-x: `space-4` (16px)

---

## Page 2 — Review

**Route:** `/review`
**Purpose:** User reviews parsed data, fills in missing fields via inline editing, then generates PDFs.

### Layout

```
+--------------------------------------------------+
| [Logo] Support PDF Generator          [theme]    |
+--------------------------------------------------+
|                                                  |
|  [<- Back]                                       |
|                                                  |
|  Review Support Data                             |
|  Verify and complete any missing fields.         |
|                                                  |
|  +------+  +------+  +------+                    |
|  | 248  |  |  4   |  |  12  |                    |
|  | Rows |  |Types |  |Miss. |                    |
|  +------+  +------+  +------+                    |
|                                                  |
|  +--------------------------------------------+  |
|  | Support Tag | Disc | Type | A | B | ...    |  |
|  |-------------|------|------|---|---|---------|  |
|  | ST-001      | Mech | Typ1 | 2 | 3 | ...   |  |
|  | ST-002      | Elec | Typ2 | _ | 1 | ...   |  |  <- warning row
|  | ...         |      |      |   |   |       |  |
|  +--------------------------------------------+  |
|                                                  |
|                   [ Generate PDFs  ->]           |
|                                                  |
+--------------------------------------------------+
```

### Component List

#### 1. Back Button

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Variant      | ghost / text button                          |
| Height       | `button-height-sm` (32px)                    |
| Font         | `button-font-family`, `text-sm`, `font-semibold` |
| Color        | `color-primary`                              |
| Hover        | `color-primary-hover`, underline             |
| Padding-x    | `space-2`                                    |
| Icon         | left arrow, 16px, `space-1` gap              |
| Margin-bottom| `space-4`                                    |

#### 2. Summary Bar

Three stat cards in a horizontal row.

**Outer container:**

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Display      | flex, gap: `space-4`                         |
| Margin-bottom| `space-6`                                    |

**Each stat card:**

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Background   | `card-bg` (`color-surface`)                  |
| Border       | `card-border` (1px solid `color-border`)     |
| Radius       | `radius-md` (6px)                            |
| Padding      | `space-4` x `space-5`                        |
| Shadow       | `shadow-sm`                                  |
| Min-width    | 120px                                        |
| Flex         | 1 1 0                                        |

**Stat value:** `font-display`, `text-2xl` (24px), `font-bold`, `color-text`
**Stat label:** `font-body`, `text-xs`, `color-text-muted`, `tracking-wide`, uppercase, margin-top: `space-1`

| Card             | Value source      | Label          | Accent                                        |
| ---------------- | ----------------- | -------------- | ---------------------------------------------- |
| Total Rows       | row count         | "Rows"         | none                                           |
| Types Found      | distinct type count | "Types"      | none                                           |
| Missing Fields   | missing cell count| "Missing"      | value color: `color-warning` when > 0          |

The Missing Fields card border-left changes to 3px solid `color-warning` when count > 0, and 3px solid `color-success` when count === 0.

#### 3. Data Table

A horizontally scrollable table with 20 columns.

**Table wrapper:**

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Background   | `color-surface`                              |
| Border       | 1px solid `color-border`                     |
| Radius       | `card-radius` (`radius-lg`, 10px)            |
| Shadow       | `card-shadow` (`shadow-md`)                  |
| Overflow-x   | auto                                         |
| Margin-bottom| `space-6`                                    |

**Table element:**

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Width        | 100% (min-width: ~1600px for 20 columns)     |
| Border-collapse | separate, border-spacing: 0               |

**Column definitions (min-widths):**

| Column           | Min-Width | Align  |
| ---------------- | --------- | ------ |
| Support Tag Name | 160px     | left   |
| Discipline       | 100px     | left   |
| Type             | 100px     | left   |
| A                | 56px      | center |
| B                | 56px      | center |
| C                | 56px      | center |
| D                | 56px      | center |
| Total            | 64px      | center |
| Item-01 Name     | 140px     | left   |
| Item-01 Qty      | 72px      | center |
| Item-02 Name     | 140px     | left   |
| Item-02 Qty      | 72px      | center |
| Item-03 Name     | 140px     | left   |
| Item-03 Qty      | 72px      | center |
| X                | 64px      | center |
| Y                | 64px      | center |
| Z                | 64px      | center |
| X-Grid           | 80px      | left   |
| Y-Grid           | 80px      | left   |
| Remarks          | 200px     | left   |

**Table header row:**

| Property     | Value                                            |
| ------------ | ------------------------------------------------ |
| Background   | `table-header-bg` (`color-surface-2`)            |
| Font         | `table-header-font` (Space Grotesk)              |
| Size         | `table-header-size` (`text-xs`, 12px)            |
| Weight       | `table-header-weight` (`font-semibold`)          |
| Tracking     | `table-header-tracking` (`tracking-wide`)        |
| Text-transform | uppercase                                      |
| Color        | `color-text-muted`                               |
| Padding      | `table-cell-padding-y` x `table-cell-padding-x`  |
| Border-bottom| 1px solid `color-border`                         |
| Position     | sticky top: 0 (within scroll container)          |
| White-space  | nowrap                                           |

**Table body cells:**

| Property     | Value                                            |
| ------------ | ------------------------------------------------ |
| Font         | `table-cell-font` (Josefin Sans)                 |
| Size         | `table-cell-size` (`text-sm`, 14px)              |
| Color        | `color-text`                                     |
| Padding      | `table-cell-padding-y` x `table-cell-padding-x`  |
| Border-bottom| 1px solid `color-border`                         |
| White-space  | nowrap                                           |
| Vertical-align | middle                                        |

**Alternating row stripe:** even rows get `table-stripe-bg` (`color-surface-2`)

#### 4. Warning Rows (Missing Fields)

Rows containing one or more missing/empty required cells.

| Property           | Value                                     |
| ------------------ | ----------------------------------------- |
| Background         | `color-warning-soft` (overrides stripe)   |
| Border-left        | 3px solid `color-warning`                 |

**Missing cells within warning rows:**

| Property           | Value                                     |
| ------------------ | ----------------------------------------- |
| Background         | `color-warning-soft` (slightly stronger, e.g., opacity 0.18) |
| Border             | 1px dashed `color-warning`                |
| Cursor             | text (indicates editable)                 |

#### 5. Inline Editable Cells

Only cells that are **missing** (empty/null) are editable. Cells with existing data are read-only.

**Default (empty, not focused):**
- Display a subtle placeholder dash "—" in `color-text-faint`
- Dashed border: 1px dashed `color-warning`
- Background: `color-warning-soft`

**Focused / Editing:**

| Property      | Value                                         |
| ------------- | --------------------------------------------- |
| Border        | 1px solid `color-primary`                     |
| Background    | `color-surface`                               |
| Box-shadow    | `shadow-focus`                                |
| Outline       | none                                          |
| Font          | inherits table cell styling                   |
| Padding       | same as table cell padding                    |

**Filled (user entered value):**
- Border reverts to normal cell border (1px solid `color-border`)
- Background reverts to normal row background
- Value displayed in `color-text`
- Cell is no longer editable (locks after entry — or remains editable until navigating away; implementation preference)

**Validation on edit:**
- Numeric columns (A, B, C, D, Total, Qty, X, Y, Z): accept only integers >= 0
- Text columns: accept non-empty strings, trim whitespace
- On invalid input: `border-color: color-error`, show tooltip/title with error message

#### 6. Generate PDFs Button

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Height       | `button-height` (40px)                       |
| Padding-x    | `button-padding-x` (20px)                   |
| Font         | `button-font-family`, `button-font-size`, `button-font-weight` |
| Radius       | `button-radius` (6px)                        |
| Shadow       | `button-shadow`                              |
| Alignment    | right-aligned within container               |
| Icon         | trailing arrow, 16px                         |

### States

#### Data Loaded — Has Missing Fields

- Summary bar: Missing Fields card shows count > 0 in `color-warning`
- Warning rows highlighted in table
- Generate PDFs button **disabled**: `opacity: 0.45`, `cursor: not-allowed`
- Tooltip on disabled button: "Fill in all missing fields to continue"

#### Data Loaded — No Missing Fields

- Summary bar: Missing Fields card shows "0" in `color-success`, border-left: `color-success`
- No warning rows in table
- Generate PDFs button **enabled**: `background: color-primary`, hover: `color-primary-hover`

#### Editing a Cell

- Active cell has focus ring (`shadow-focus`)
- Tab / Enter moves focus to next missing cell
- Escape cancels edit, reverts to empty

#### Generating PDFs (Loading)

- Generate PDFs button text: "Generating..." with 16px spinner
- Button **disabled**
- Table becomes non-interactive (pointer-events: none, `opacity: 0.7`)
- Optional: overlay with indeterminate progress bar at top of table wrapper

#### Generation Error

- Toast notification at top-right (or inline error below button)
- Toast: `color-surface`, `shadow-lg`, border-left 3px `color-error`, auto-dismiss 8s
- Message: "PDF generation failed. Please try again."
- Button re-enables

#### Empty Table (Edge Case)

- If parsing returns 0 rows: table area shows empty state card
- Card: `color-surface`, centered, `space-12` padding
- Icon: empty-document, 48px, `color-text-faint`
- Text: "No support data found in file.", `font-body`, `text-base`, `color-text-muted`
- Back button remains available

### Mobile Behavior (< `bp-md` / 768px)

- Summary bar: cards stack vertically (flex-direction: column), full width
- Table wrapper: full-bleed (negative margin-x to use full viewport width), horizontal scroll with momentum
- Sticky first column: "Support Tag Name" column position: sticky left: 0 with `color-surface` background and right border shadow for scroll indication
- Generate PDFs button: full-width
- Back button: remains top-left, same styling
- Page padding-x: `space-4`

---

## Page 3 — Output

**Route:** `/output`
**Purpose:** User downloads individual PDFs per support type or all as a ZIP archive.

### Layout

```
+--------------------------------------------------+
| [Logo] Support PDF Generator          [theme]    |
+--------------------------------------------------+
|                                                  |
|  PDFs Ready                                      |
|  Download individual files or all at once.       |
|                                                  |
|  +--------------------------------------------+  |
|  | [pdf icon]  Beam Supports          (24)    |  |
|  |                        [ Download PDF ]    |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  | [pdf icon]  Column Supports        (12)    |  |
|  |                        [ Download PDF ]    |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  | [pdf icon]  Brace Supports          (8)    |  |
|  |                        [ Download PDF ]    |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  | [pdf icon]  Misc Supports           (6)    |  |
|  |                        [ Download PDF ]    |  |
|  +--------------------------------------------+  |
|                                                  |
|  [ Download All as ZIP ]    [ Start Over ]       |
|                                                  |
+--------------------------------------------------+
```

### Component List

#### 1. Support Type Card

One card per distinct support type found in the data.

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Background   | `card-bg` (`color-surface`)                  |
| Border       | `card-border` (1px solid `color-border`)     |
| Radius       | `card-radius` (`radius-lg`, 10px)            |
| Padding      | `card-padding` (`space-6`, 24px)             |
| Shadow       | `card-shadow` (`shadow-md`)                  |
| Display      | flex, align-items: center, gap: `space-4`    |
| Margin-bottom| `space-4`                                    |

**Card contents (left to right):**

1. **PDF icon** — 32x32px, `color-error` (red tint for PDF association)
2. **Type name** — `font-display`, `text-lg` (18px), `font-semibold`, `color-text`
3. **Support count badge** — `badge-height` (24px), `badge-padding-x` (8px), `badge-font` (Space Grotesk), `badge-font-size` (12px), `badge-font-weight` (500), `badge-radius` (`radius-full`), background: `color-surface-2`, color: `color-text-muted`
4. **Spacer** — flex-grow
5. **Download PDF button** — outlined variant:
   - Height: `button-height-sm` (32px)
   - Border: 1px solid `color-primary`
   - Color: `color-primary`
   - Background: transparent
   - Hover: `background: color-primary-soft`
   - Font: `button-font-family`, `text-sm`, `font-semibold`
   - Radius: `button-radius`
   - Icon: download arrow, 14px, leading, `space-2` gap

#### 2. Download All as ZIP Button

Primary action button.

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Height       | `button-height` (40px)                       |
| Background   | `color-primary`                              |
| Color        | `#ffffff`                                    |
| Hover        | `color-primary-hover`                        |
| Font         | `button-font-family`, `button-font-size`, `button-font-weight` |
| Radius       | `button-radius` (6px)                        |
| Shadow       | `button-shadow`                              |
| Icon         | archive/zip icon, 16px, leading, `space-2` gap |

#### 3. Start Over Button

Secondary action — resets app to Upload page.

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Height       | `button-height` (40px)                       |
| Background   | transparent                                  |
| Border       | 1px solid `color-border`                     |
| Color        | `color-text`                                 |
| Hover        | `background: color-surface-2`               |
| Font         | `button-font-family`, `button-font-size`, `button-font-weight` |
| Radius       | `button-radius` (6px)                        |

#### 4. Action Bar

Container for the two bottom buttons.

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Display      | flex, gap: `space-4`                         |
| Justify      | flex-end                                     |
| Margin-top   | `space-8` (32px)                             |
| Padding-top  | `space-6` (24px)                             |
| Border-top   | 1px solid `color-border`                     |

### States

#### Success (Default)

- All cards visible with type names, counts, and download buttons
- Download All as ZIP and Start Over both enabled
- No errors

#### Downloading Individual PDF

- Clicked Download PDF button text: "Downloading..." with 14px spinner
- Button disabled during download
- Other cards remain interactive
- On complete: browser triggers file download, button reverts to "Download PDF"

#### Downloading ZIP

- Download All as ZIP button text: "Preparing ZIP..." with spinner
- Button disabled
- Individual card download buttons also disabled during ZIP preparation
- On complete: browser triggers file download, all buttons re-enable

#### Download Error

- Toast notification: `color-surface`, `shadow-lg`, border-left 3px `color-error`
- Message: "Download failed. Please try again."
- Auto-dismiss: 8 seconds
- Affected button re-enables

#### Single Type (Edge Case)

- Only one card displayed
- Download All as ZIP button still available but labeled "Download PDF" (no ZIP needed for single file — or keep ZIP label for consistency; implementation choice)

#### Start Over Confirmation

- No confirmation modal — immediate navigation back to Upload page
- All generated data cleared from client state

### Mobile Behavior (< `bp-md` / 768px)

- Cards: full width, stack vertically
- Within each card: flex-wrap, download button drops below the type name row on narrow screens
  - Type name + badge: row 1
  - Download button: row 2, full width, margin-top: `space-3`
- Action bar: flex-direction: column-reverse (Start Over on top, Download All below — primary action thumb-accessible at bottom)
- Both action buttons: full width
- Page padding-x: `space-4`

---

## Interaction & Navigation Summary

| From       | Action                 | To       |
| ---------- | ---------------------- | -------- |
| Upload     | Parse File (success)   | Review   |
| Review     | Back button            | Upload   |
| Review     | Generate PDFs (success)| Output   |
| Output     | Start Over             | Upload   |

**Transitions:** Page changes use a simple crossfade, `transition-slow` (300ms). No route-based slide animations.

**Keyboard navigation:**
- Tab order follows visual layout top-to-bottom, left-to-right
- All interactive elements have visible focus ring: `shadow-focus`
- Escape closes any active inline edit
- Enter on Upload zone opens file picker

---

**These specs are the single source of truth for page-level UI implementation.**
