# Component Library — Support PDF Generator

**Last Updated:** 2026-04-08
**Components:** 10
**Token Reference:** [tokens.md](tokens.md)
**Page Reference:** [pages.md](pages.md)

---

## 1. AppHeader

Sticky top bar present on all pages.

### Props

| Prop       | Type       | Default                    | Description                   |
| ---------- | ---------- | -------------------------- | ----------------------------- |
| `logoSrc`  | `string`   | `/logo.svg`                | Path to logo image            |
| `appName`  | `string`   | `"Support PDF Generator"`  | Display name in header        |
| `darkMode` | `boolean`  | `false`                    | Current theme state           |
| `onToggleTheme` | `() => void` | —                   | Theme toggle callback         |

### Anatomy

```
[Logo 28px] [space-3] [App Name]  ──flex-grow──  [ThemeToggle]
```

### Styles

| Property     | Value                                 |
| ------------ | ------------------------------------- |
| Height       | 56px                                  |
| Background   | `color-surface`                       |
| Border-bottom| 1px solid `color-border`              |
| Shadow       | `shadow-sm`                           |
| Padding-x    | `space-6`                             |
| Position     | sticky, top: 0                        |
| Z-index      | `z-sticky` (200)                      |
| Display      | flex, align-items: center             |

**App name:** `font-display`, `text-lg`, `font-bold`, `color-text`

**Theme toggle button:** 32x32px, `radius-full`, `color-text-muted`, hover: `color-text`, `transition-fast`. Icon swaps between sun/moon based on `darkMode`.

### Mobile (< `bp-md`)

- Padding-x: `space-4`
- App name: `text-base`

---

## 2. FileUploadZone

Drag-and-drop area with click-to-browse fallback and file selection display.

### Props

| Prop           | Type                       | Default    | Description                          |
| -------------- | -------------------------- | ---------- | ------------------------------------ |
| `accept`       | `string`                   | `".xlsx,.xls"` | Accepted file extensions         |
| `maxSizeMB`    | `number`                   | `10`       | Max file size in megabytes           |
| `file`         | `File \| null`             | `null`     | Currently selected file              |
| `status`       | `Status`                   | `"idle"`   | See states below                     |
| `errorMessage` | `string \| null`           | `null`     | Validation error text                |
| `onFileSelect` | `(file: File) => void`     | —          | File selected callback               |
| `onFileRemove` | `() => void`               | —          | Remove file callback                 |

**Status type:** `"idle" | "validating" | "valid" | "invalid"`

### Anatomy

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   ← dashed border, shown when file === null
│                                       │
│         [Upload icon 48px]            │
│                                       │
│    Drag & drop your file here         │
│    or click to browse                 │
│                                       │
│    .xlsx, .xls — max 10 MB           │
│                                       │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘

┌───────────────────────────────────────┐   ← solid border, shown when file !== null
│ [FileIcon 20px]  name.xlsx  12 KB [×]│
└───────────────────────────────────────┘

┌ ▎ Valid Excel file. Ready to parse.   │   ← validation feedback, shown when status !== idle
└───────────────────────────────────────┘
```

### Styles — Drop Zone

| Property     | Value                                     |
| ------------ | ----------------------------------------- |
| Border       | 2px dashed `color-border`                 |
| Background   | `color-surface`                           |
| Radius       | `radius-lg` (10px)                        |
| Padding      | `space-12` (48px)                         |
| Text-align   | center                                    |
| Min-height   | 200px                                     |
| Cursor       | pointer                                   |
| Transition   | `transition-base`                         |

**Icon:** 48px, `color-text-faint`, margin-bottom `space-4`
**Primary text:** `font-display`, `text-base`, `font-medium`, `color-text`
**Secondary text:** `font-body`, `text-sm`, `color-text-muted`
**Format hint:** `font-body`, `text-xs`, `color-text-faint`, margin-top `space-3`

### Styles — File Info Bar

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Background   | `color-surface`                              |
| Border       | 1px solid `color-border`                     |
| Radius       | `radius-md`                                  |
| Padding      | `space-3` x `space-4`                        |
| Display      | flex, align-items: center, gap: `space-3`    |
| Shadow       | `shadow-sm`                                  |

- File icon: 20px, `color-primary`
- File name: `font-body`, `text-sm`, `font-medium`, `color-text`, ellipsis at 300px
- File size: `font-body`, `text-xs`, `color-text-muted`
- Remove (x): 24x24px, `color-text-faint`, hover `color-error`

### Styles — Validation Feedback

| Property     | Value                          |
| ------------ | ------------------------------ |
| Radius       | `radius-sm`                    |
| Padding      | `space-3` x `space-4`         |
| Font         | `font-body`, `text-sm`         |
| Margin-top   | `space-4`                      |
| Border-left  | 3px solid (variant color)      |
| Display      | flex, align-items: center, gap: `space-3` |

| Variant   | Background          | Border/Icon color | Icon    |
| --------- | ------------------- | ----------------- | ------- |
| `valid`   | `color-success-soft` | `color-success`  | check   |
| `invalid` | `color-error-soft`   | `color-error`    | x-circle|

### States

| State        | Drop zone | File bar | Feedback  | Notes                                          |
| ------------ | --------- | -------- | --------- | ---------------------------------------------- |
| `idle`       | visible   | hidden   | hidden    | Default. Dashed border.                        |
| `drag-over`  | visible   | hidden   | hidden    | Border: `color-primary`, bg: `color-primary-soft`, icon: `color-primary` |
| `validating` | hidden    | visible  | hidden    | Inline spinner in file bar if > 200ms          |
| `valid`      | hidden    | visible  | success   | Green left border on feedback                  |
| `invalid`    | hidden    | visible  | error     | Red left border, `errorMessage` displayed      |

### Mobile (< `bp-md`)

- Drop zone padding: `space-8`, icon: 36px
- File name ellipsis: 200px

---

## 3. SupportTable

Horizontally scrollable 20-column data table with warning-row highlighting.

### Props

| Prop              | Type                          | Default | Description                              |
| ----------------- | ----------------------------- | ------- | ---------------------------------------- |
| `rows`            | `SupportRow[]`                | `[]`    | Parsed support data                      |
| `columns`         | `ColumnDef[]`                 | (all 20)| Column definitions with key, label, width, align, type |
| `onCellEdit`      | `(rowIdx, colKey, value) => void` | — | Callback when a missing cell is filled   |
| `disabled`        | `boolean`                     | `false` | Disables all interaction (during PDF gen) |

**SupportRow:** Object with keys matching the 20 columns. Missing values are `null`.

**ColumnDef:**
```ts
{ key: string; label: string; minWidth: number; align: "left" | "center"; type: "text" | "number" }
```

### Column Definitions

| Key              | Label            | minWidth | align  | type   |
| ---------------- | ---------------- | -------- | ------ | ------ |
| `supportTagName` | Support Tag Name | 160px    | left   | text   |
| `discipline`     | Discipline       | 100px    | left   | text   |
| `type`           | Type             | 100px    | left   | text   |
| `a`              | A                | 56px     | center | number |
| `b`              | B                | 56px     | center | number |
| `c`              | C                | 56px     | center | number |
| `d`              | D                | 56px     | center | number |
| `total`          | Total            | 64px     | center | number |
| `item01Name`     | Item-01 Name     | 140px    | left   | text   |
| `item01Qty`      | Item-01 Qty      | 72px     | center | number |
| `item02Name`     | Item-02 Name     | 140px    | left   | text   |
| `item02Qty`      | Item-02 Qty      | 72px     | center | number |
| `item03Name`     | Item-03 Name     | 140px    | left   | text   |
| `item03Qty`      | Item-03 Qty      | 72px     | center | number |
| `x`              | X                | 64px     | center | number |
| `y`              | Y                | 64px     | center | number |
| `z`              | Z                | 64px     | center | number |
| `xGrid`          | X-Grid           | 80px     | left   | text   |
| `yGrid`          | Y-Grid           | 80px     | left   | text   |
| `remarks`        | Remarks          | 200px    | left   | text   |

### Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ SUPPORT TAG NAME │ DISCIPLINE │ TYPE │ A │ B │ ... │ REMARKS│  ← sticky header
├──────────────────┼────────────┼──────┼───┼───┼─────┼────────┤
│ ST-001           │ Mech       │ Beam │ 2 │ 3 │ ... │ OK     │  ← normal row
│▎ST-002           │ Elec       │ Col  │ — │ 1 │ ... │ —      │  ← warning row (left accent)
│ ST-003           │ Civil      │ Beam │ 4 │ 2 │ ... │ Note   │  ← striped row
└─────────────────────────────────────────────────────────────┘
                                                        ← horizontal scroll
```

### Styles — Wrapper

| Property     | Value                               |
| ------------ | ----------------------------------- |
| Background   | `color-surface`                     |
| Border       | 1px solid `color-border`            |
| Radius       | `radius-lg` (10px)                  |
| Shadow       | `shadow-md`                         |
| Overflow-x   | auto (smooth scroll on touch)       |

### Styles — Header Cells

| Property        | Value                                 |
| --------------- | ------------------------------------- |
| Background      | `color-surface-2`                     |
| Font            | `font-display`, `text-xs`, `font-semibold` |
| Text-transform  | uppercase                             |
| Letter-spacing  | `tracking-wide`                       |
| Color           | `color-text-muted`                    |
| Padding         | `space-2` x `space-3`                |
| Border-bottom   | 1px solid `color-border`              |
| Position        | sticky, top: 0                        |
| White-space     | nowrap                                |

### Styles — Body Cells

| Property     | Value                                    |
| ------------ | ---------------------------------------- |
| Font         | `font-body`, `text-sm`                   |
| Color        | `color-text`                             |
| Padding      | `space-2` x `space-3`                    |
| Border-bottom| 1px solid `color-border`                 |
| White-space  | nowrap                                   |
| Vertical-align | middle                                |

**Row striping:** Even rows background `color-surface-2`.

### Warning Row

A row where any cell value is `null`.

| Property     | Value                                    |
| ------------ | ---------------------------------------- |
| Background   | `color-warning-soft` (overrides stripe)  |
| Border-left  | 3px solid `color-warning`                |

Null cells within warning rows render as `<EditableCell>`.

### States

| State      | Visual                                                     |
| ---------- | ---------------------------------------------------------- |
| Default    | Table with data, scroll if wider than container            |
| Disabled   | `pointer-events: none`, `opacity: 0.7` on entire table    |
| Empty      | Replaced by `<EmptyState>` with message "No support data found in file." |

### Mobile (< `bp-md`)

- Wrapper: full-bleed (negative margin-x to fill viewport)
- First column (`supportTagName`): sticky left: 0, `color-surface` background, right box-shadow `2px 0 4px color-shadow` for scroll cue
- Touch: `-webkit-overflow-scrolling: touch`

---

## 4. EditableCell

Inline cell editor. Renders read-only text when a value exists, an editable input when the value is `null`.

### Props

| Prop         | Type                              | Default  | Description                          |
| ------------ | --------------------------------- | -------- | ------------------------------------ |
| `value`      | `string \| number \| null`        | —        | Current cell value                   |
| `columnType` | `"text" \| "number"`              | `"text"` | Determines input mode & validation   |
| `onCommit`   | `(value: string \| number) => void` | —     | Called on successful blur/Enter      |
| `disabled`   | `boolean`                         | `false`  | Blocks editing (during PDF gen)      |

### Behavior

```
value !== null  →  render <span> (read-only, no interaction)
value === null  →  render editable placeholder, click/focus opens input
```

### States

| State        | Border                      | Background           | Content                      |
| ------------ | --------------------------- | -------------------- | ---------------------------- |
| Read-only    | inherits cell border        | inherits row bg      | value in `color-text`        |
| Empty        | 1px dashed `color-warning`  | `color-warning-soft` | "—" in `color-text-faint`    |
| Focused      | 1px solid `color-primary`   | `color-surface`      | blinking cursor, input active|
| Valid input   | 1px solid `color-border`   | inherits row bg      | entered value in `color-text`|
| Invalid input| 1px solid `color-error`     | `color-error-soft`   | value stays, tooltip shows error |

**Focus ring:** `shadow-focus` on the cell when focused.

### Validation Rules

| `columnType` | Rule                                | Error message              |
| ------------ | ----------------------------------- | -------------------------- |
| `number`     | Integer >= 0, no decimals, no text  | "Must be a whole number"   |
| `text`       | Non-empty after trim                | "Cannot be empty"          |

### Keyboard

| Key      | Action                                        |
| -------- | --------------------------------------------- |
| Enter    | Commit value, move focus to next null cell     |
| Tab      | Commit value, move focus to next null cell     |
| Escape   | Cancel edit, revert to empty ("—")             |

### Styles

Input inherits table cell font (`font-body`, `text-sm`), padding (`space-2` x `space-3`), and alignment from column definition. No extra height — input fits flush within the cell. `outline: none` (focus ring via `box-shadow`).

---

## 5. TypeCard

Displays a support type with its count and a download action. Used on the Output page.

### Props

| Prop          | Type               | Default    | Description                          |
| ------------- | ------------------ | ---------- | ------------------------------------ |
| `typeName`    | `string`           | —          | Support type label                   |
| `count`       | `number`           | —          | Number of supports of this type      |
| `status`      | `CardStatus`       | `"ready"`  | Download state                       |
| `onDownload`  | `() => void`       | —          | Download button callback             |

**CardStatus:** `"ready" | "downloading" | "error"`

### Anatomy

```
┌──────────────────────────────────────────────────┐
│ [PDF icon 32px]  Type Name   (count)    [Button] │
└──────────────────────────────────────────────────┘
```

### Styles

| Property     | Value                               |
| ------------ | ----------------------------------- |
| Background   | `color-surface`                     |
| Border       | 1px solid `color-border`            |
| Radius       | `radius-lg` (10px)                  |
| Padding      | `space-6` (24px)                    |
| Shadow       | `shadow-md`                         |
| Display      | flex, align-items: center, gap: `space-4` |
| Margin-bottom| `space-4`                           |

- **PDF icon:** 32x32px, `color-error` (red for PDF)
- **Type name:** `font-display`, `text-lg`, `font-semibold`, `color-text`
- **Count badge:** uses `<StatusBadge variant="info">` — displays count
- **Spacer:** flex-grow
- **Download button:** `<ActionButton variant="secondary" size="sm">` — "Download PDF" with download icon

### States

| State          | Button text       | Button icon       | Notes                          |
| -------------- | ----------------- | ----------------- | ------------------------------ |
| `ready`        | "Download PDF"    | download arrow    | Default                        |
| `downloading`  | "Downloading..."  | spinner (14px)    | Button disabled                |
| `error`        | "Retry"           | refresh icon      | Button enabled, `color-error`  |

### Mobile (< `bp-md`)

- Flex-wrap: wrap
- Row 1: icon + name + badge
- Row 2: download button, full-width, margin-top `space-3`

---

## 6. StatusBadge

Small pill for categorical labels and counts.

### Props

| Prop      | Type          | Default   | Description              |
| --------- | ------------- | --------- | ------------------------ |
| `variant` | `Variant`     | `"info"`  | Color scheme             |
| `children`| `ReactNode`   | —         | Badge content (text/num) |

**Variant:** `"success" | "warning" | "error" | "info"`

### Styles (shared)

| Property     | Value                               |
| ------------ | ----------------------------------- |
| Height       | 24px (`badge-height`)               |
| Padding-x    | `space-2` (8px)                     |
| Font         | `font-display`, `text-xs`, `font-medium` |
| Radius       | `radius-full` (pill)                |
| Display      | inline-flex, align-items: center    |
| White-space  | nowrap                              |
| Line-height  | 1                                   |

### Variant Styles

| Variant    | Background           | Color            |
| ---------- | -------------------- | ---------------- |
| `success`  | `color-success-soft` | `color-success`  |
| `warning`  | `color-warning-soft` | `color-warning`  |
| `error`    | `color-error-soft`   | `color-error`    |
| `info`     | `color-surface-2`    | `color-text-muted` |

---

## 7. ActionButton

Unified button component used across all pages.

### Props

| Prop       | Type          | Default     | Description                          |
| ---------- | ------------- | ----------- | ------------------------------------ |
| `variant`  | `Variant`     | `"primary"` | Visual style                         |
| `size`     | `Size`        | `"md"`      | Height and padding                   |
| `disabled` | `boolean`     | `false`     | Disables interaction                 |
| `loading`  | `boolean`     | `false`     | Shows spinner, disables button       |
| `iconLeft` | `ReactNode`   | —           | Leading icon (14-16px)               |
| `iconRight`| `ReactNode`   | —           | Trailing icon (14-16px)              |
| `fullWidth`| `boolean`     | `false`     | Stretches to container width         |
| `onClick`  | `() => void`  | —           | Click handler                        |
| `children` | `ReactNode`   | —           | Button label                         |

**Variant:** `"primary" | "secondary" | "ghost" | "destructive"`
**Size:** `"sm" | "md"`

### Shared Styles

| Property     | Value                                         |
| ------------ | --------------------------------------------- |
| Font         | `font-display`, `font-semibold`               |
| Radius       | `radius-md` (6px)                             |
| Cursor       | pointer (default), not-allowed (disabled)     |
| Transition   | `transition-fast`                             |
| Display      | inline-flex, align-items: center, gap: `space-2` |
| White-space  | nowrap                                        |
| Focus        | `shadow-focus`, outline: none                 |

### Size Tokens

| Size | Height | Padding-x | Font-size  |
| ---- | ------ | --------- | ---------- |
| `sm` | 32px   | `space-4`  | `text-sm`  |
| `md` | 40px   | `space-5`  | `text-sm`  |

### Variant Styles

| Variant       | Background          | Color        | Border                    | Hover bg              | Shadow       |
| ------------- | ------------------- | ------------ | ------------------------- | --------------------- | ------------ |
| `primary`     | `color-primary`     | `#ffffff`    | none                      | `color-primary-hover` | `shadow-sm`  |
| `secondary`   | transparent         | `color-primary` | 1px solid `color-primary`| `color-primary-soft`  | none         |
| `ghost`       | transparent         | `color-primary` | none                   | `color-primary-soft`  | none         |
| `destructive` | `color-error`       | `#ffffff`    | none                      | darken 10%            | `shadow-sm`  |

### Disabled State

All variants: `opacity: 0.45`, `pointer-events: none`.

### Loading State

- `disabled` becomes `true` automatically
- Label text replaced by `loading` text (passed as children) or kept
- Icon slot shows a 16px (md) / 14px (sm) spinner animation replacing `iconLeft` or `iconRight`
- Spinner color matches the variant's text color

---

## 8. PageLoader

Full-page centered loading indicator with optional message. Used during parsing and PDF generation transitions.

### Props

| Prop      | Type     | Default        | Description           |
| --------- | -------- | -------------- | --------------------- |
| `message` | `string` | `"Loading..."` | Text below spinner    |

### Anatomy

```
          ┌─────────────────┐
          │                 │
          │    [Spinner]    │     ← centered in viewport
          │                 │
          │    Loading...   │
          │                 │
          └─────────────────┘
```

### Styles

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Position     | fixed, inset: 0 (covers viewport)            |
| Background   | `color-bg` at 80% opacity                    |
| Display      | flex, align-items: center, justify-content: center, flex-direction: column |
| Z-index      | `z-modal` (300)                              |
| Gap          | `space-4`                                    |

**Spinner:** 32px diameter, 3px stroke, `color-primary`, CSS animation `spin 0.8s linear infinite`.

**Message:** `font-display`, `text-sm`, `font-medium`, `color-text-muted`.

---

## 9. EmptyState

Placeholder shown when a content area has no data. Used in the table area when parsing returns 0 rows.

### Props

| Prop          | Type         | Default | Description                       |
| ------------- | ------------ | ------- | --------------------------------- |
| `icon`        | `ReactNode`  | —       | Illustrative icon (48px)          |
| `title`       | `string`     | —       | Heading text                      |
| `message`     | `string`     | —       | Descriptive body text             |
| `action`      | `ActionProps \| null` | `null` | Optional CTA button        |

**ActionProps:** `{ label: string; onClick: () => void }` — renders as `<ActionButton variant="secondary" size="sm">`.

### Anatomy

```
┌──────────────────────────────────┐
│                                  │
│          [Icon 48px]             │
│                                  │
│       No data found              │
│  Description of what to do.      │
│                                  │
│         [ Action ]               │   ← optional
│                                  │
└──────────────────────────────────┘
```

### Styles

| Property     | Value                                     |
| ------------ | ----------------------------------------- |
| Background   | `color-surface`                           |
| Border       | 1px solid `color-border`                  |
| Radius       | `radius-lg` (10px)                        |
| Padding      | `space-12` (48px) vertical, `space-6` horizontal |
| Text-align   | center                                    |
| Max-width    | 400px                                     |
| Margin       | 0 auto                                    |

- **Icon:** 48px, `color-text-faint`, margin-bottom `space-4`
- **Title:** `font-display`, `text-lg`, `font-semibold`, `color-text`, margin-bottom `space-2`
- **Message:** `font-body`, `text-sm`, `color-text-muted`, `leading-normal`, margin-bottom `space-6` (only if action present)

---

## 10. ErrorBanner

Dismissible error strip pinned to the top of the page content area. Used for parse errors, generation failures, and download errors.

### Props

| Prop          | Type         | Default | Description                          |
| ------------- | ------------ | ------- | ------------------------------------ |
| `message`     | `string`     | —       | Error description                    |
| `onDismiss`   | `() => void` | —       | Close button callback                |
| `autoDismiss` | `number \| null` | `8000` | Auto-dismiss in ms, `null` to disable |

### Anatomy

```
┌─▎──────────────────────────────────────────────── [×] ─┐
│  [!] PDF generation failed. Please try again.          │
└────────────────────────────────────────────────────────┘
```

### Styles

| Property     | Value                                     |
| ------------ | ----------------------------------------- |
| Background   | `color-error-soft`                        |
| Border-left  | 3px solid `color-error`                   |
| Border       | 1px solid (color-error at 20% opacity)    |
| Radius       | `radius-sm` (4px)                         |
| Padding      | `space-3` x `space-4`                     |
| Display      | flex, align-items: center, gap: `space-3` |
| Margin-bottom| `space-4`                                 |
| Shadow       | `shadow-sm`                               |

- **Alert icon (!):** 16px, `color-error`
- **Message text:** `font-body`, `text-sm`, `color-text`, flex: 1
- **Dismiss button (x):** 20x20px, `color-text-faint`, hover `color-text`

### States

| State       | Visual                                               |
| ----------- | ---------------------------------------------------- |
| Visible     | Full opacity, slides down with `transition-slow`     |
| Dismissing  | Fades out over `transition-base` (200ms), then removed from DOM |
| Auto-dismiss| Starts `autoDismiss` timer on mount. Timer resets on hover. |

### Behavior

- Stacks: multiple banners stack vertically with `space-2` gap between them
- Enter animation: translate-y from -8px to 0, opacity 0 to 1, `transition-slow`
- Exit animation: opacity 1 to 0, `transition-base`
- Hover pauses the auto-dismiss countdown

---

## Component Dependency Map

```
AppHeader           — standalone
FileUploadZone      — standalone (contains internal file bar + validation)
SupportTable        — contains EditableCell
EditableCell        — standalone (used only inside SupportTable)
TypeCard            — contains StatusBadge, ActionButton
StatusBadge         — standalone
ActionButton        — standalone
PageLoader          — standalone
EmptyState          — contains ActionButton (optional)
ErrorBanner         — standalone
```

---

**These component specs are the single source of truth for reusable UI implementation.**
