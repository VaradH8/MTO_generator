# Design Tokens — Support PDF Generator

**Last Updated:** 2026-04-08
**Token Count:** 89
**Theme:** Cobalt Blue-Slate, dual-mode (light + dark)

---

## Typography

### Font Families

```yaml
font-display: "'Space Grotesk', system-ui, sans-serif"   # headings, labels, badges
font-body: "'Josefin Sans', system-ui, sans-serif"        # content, tables, forms
font-mono: "'JetBrains Mono', 'Fira Code', monospace"     # code, data values (optional)
```

### Font Sizes

```yaml
text-xs:   0.75rem    # 12px — captions, badges
text-sm:   0.875rem   # 14px — secondary text, table cells
text-base: 1rem       # 16px — body default
text-lg:   1.125rem   # 18px — emphasized body
text-xl:   1.25rem    # 20px — section headings
text-2xl:  1.5rem     # 24px — page headings
text-3xl:  1.875rem   # 30px — display heading
```

### Font Weights

```yaml
font-normal:   400    # body text
font-medium:   500    # labels, table headers
font-semibold: 600    # subheadings, buttons
font-bold:     700    # page titles, emphasis
```

### Line Heights

```yaml
leading-tight:  1.25   # headings
leading-normal: 1.5    # body text
leading-loose:  1.75   # relaxed reading
```

### Letter Spacing

```yaml
tracking-tight:  -0.01em   # display headings
tracking-normal:  0         # body
tracking-wide:    0.02em    # labels, uppercase text
```

---

## Colors — Light Mode

### Surfaces

```yaml
color-bg:             "#f3f5fa"    # page background
color-surface:        "#ffffff"    # cards, panels, modals
color-surface-2:      "#e9edf6"    # secondary surface, table stripe
color-surface-offset: "#dce3f0"    # inset areas, sidebar bg
color-border:         "#c9d2e4"    # borders, dividers
color-shadow:         "rgba(15, 25, 60, 0.08)"  # box shadows
```

### Text

```yaml
color-text:       "#0d1530"    # primary text
color-text-muted: "#4a5478"    # secondary text, descriptions
color-text-faint: "#7a8299"    # placeholders, disabled labels
```

### Brand / Interactive

```yaml
color-primary:       "#1f3ca8"                  # buttons, links, active states
color-primary-hover: "#15307f"                  # hover on primary elements
color-primary-soft:  "rgba(31, 60, 168, 0.13)"  # selected row bg, subtle highlights
```

### Semantic

```yaml
color-success: "#1f7a4d"   # valid states, success messages
color-warning: "#9a6400"   # caution banners, missing-field flags
color-error:   "#b02a37"   # validation errors, destructive actions
```

### Semantic Soft Backgrounds

```yaml
color-success-soft: "rgba(31, 122, 77, 0.10)"
color-warning-soft: "rgba(154, 100, 0, 0.10)"
color-error-soft:   "rgba(176, 42, 55, 0.10)"
```

---

## Colors — Dark Mode

Derived from the same blue-slate family. Surface luminance inverted; accent hues shifted lighter for contrast on dark backgrounds.

### Surfaces

```yaml
color-bg:             "#0c0f1a"    # page background
color-surface:        "#151929"    # cards, panels, modals
color-surface-2:      "#1c2236"    # secondary surface, table stripe
color-surface-offset: "#232a42"    # inset areas, sidebar bg
color-border:         "#2e3754"    # borders, dividers
color-shadow:         "rgba(0, 0, 0, 0.32)"  # box shadows
```

### Text

```yaml
color-text:       "#e8ebf4"    # primary text
color-text-muted: "#9ba3c0"    # secondary text, descriptions
color-text-faint: "#626d8c"    # placeholders, disabled labels
```

### Brand / Interactive

```yaml
color-primary:       "#5b7ce6"                  # buttons, links, active states
color-primary-hover: "#7a98f0"                  # hover on primary elements
color-primary-soft:  "rgba(91, 124, 230, 0.15)" # selected row bg, subtle highlights
```

### Semantic

```yaml
color-success: "#34c47a"   # valid states, success messages
color-warning: "#d4a020"   # caution banners, missing-field flags
color-error:   "#e05564"   # validation errors, destructive actions
```

### Semantic Soft Backgrounds

```yaml
color-success-soft: "rgba(52, 196, 122, 0.12)"
color-warning-soft: "rgba(212, 160, 32, 0.12)"
color-error-soft:   "rgba(224, 85, 100, 0.12)"
```

---

## Spacing

4px base unit. Scale in pixels and rem equivalents.

```yaml
space-1:   4px    # 0.25rem
space-2:   8px    # 0.5rem
space-3:  12px    # 0.75rem
space-4:  16px    # 1rem
space-5:  20px    # 1.25rem
space-6:  24px    # 1.5rem
space-8:  32px    # 2rem
space-10: 40px    # 2.5rem
space-12: 48px    # 3rem
space-16: 64px    # 4rem
space-20: 80px    # 5rem
space-24: 96px    # 6rem
```

---

## Border Radius

```yaml
radius-sm:   4px      # inputs, small chips
radius-md:   6px      # buttons, cards
radius-lg:  10px      # modals, panels
radius-xl:  16px      # large containers, hero sections
radius-full: 9999px   # pills, avatars, circular elements
```

---

## Shadows

Using `color-shadow` token as base.

```yaml
shadow-sm:  "0 1px 2px var(--color-shadow)"                                  # subtle lift
shadow-md:  "0 2px 6px var(--color-shadow)"                                   # cards at rest
shadow-lg:  "0 4px 12px var(--color-shadow), 0 1px 3px var(--color-shadow)"   # elevated panels
shadow-xl:  "0 8px 24px var(--color-shadow), 0 2px 6px var(--color-shadow)"   # modals, dropdowns
shadow-focus: "0 0 0 3px var(--color-primary-soft)"                           # focus ring
```

---

## Transitions

```yaml
transition-fast:   "120ms ease-out"   # hover color, opacity
transition-base:   "200ms ease-out"   # general interactions
transition-slow:   "300ms ease-out"   # layout shifts, panels
```

---

## Z-Index Scale

```yaml
z-base:     0
z-dropdown: 100
z-sticky:   200
z-modal:    300
z-toast:    400
z-tooltip:  500
```

---

## Layout

### Breakpoints

```yaml
bp-sm:  640px
bp-md:  768px
bp-lg: 1024px
bp-xl: 1280px
```

### Container

```yaml
container-max:    1120px   # max content width
container-pad-x:  space-6  # horizontal gutter (24px)
```

---

## Component-Specific Tokens

### Button

```yaml
button-height:        40px
button-height-sm:     32px
button-padding-x:     space-5       # 20px
button-padding-x-sm:  space-4       # 16px
button-font-family:   font-display  # Space Grotesk
button-font-size:     text-sm       # 14px
button-font-weight:   font-semibold # 600
button-radius:        radius-md     # 6px
button-shadow:        shadow-sm
```

### Input

```yaml
input-height:       40px
input-height-sm:    32px
input-padding-x:    space-3        # 12px
input-font-family:  font-body      # Josefin Sans
input-font-size:    text-sm        # 14px
input-border-color: color-border
input-border-width: 1px
input-radius:       radius-md      # 6px
input-focus-ring:   shadow-focus
```

### Table

```yaml
table-header-bg:        color-surface-2
table-header-font:      font-display     # Space Grotesk
table-header-weight:    font-semibold
table-header-size:      text-xs          # 12px
table-header-tracking:  tracking-wide
table-cell-padding-x:   space-3          # 12px
table-cell-padding-y:   space-2          # 8px
table-cell-font:        font-body        # Josefin Sans
table-cell-size:        text-sm          # 14px
table-stripe-bg:        color-surface-2
table-border:           color-border
```

### Card / Panel

```yaml
card-bg:       color-surface
card-radius:   radius-lg       # 10px
card-padding:  space-6         # 24px
card-shadow:   shadow-md
card-border:   "1px solid var(--color-border)"
```

### Badge / Chip

```yaml
badge-height:      24px
badge-padding-x:   space-2       # 8px
badge-font:        font-display  # Space Grotesk
badge-font-size:   text-xs       # 12px
badge-font-weight: font-medium   # 500
badge-radius:      radius-full   # pill shape
```

### Upload Zone

```yaml
upload-border-style:  dashed
upload-border-width:  2px
upload-border-color:  color-border
upload-border-active: color-primary
upload-bg:            color-surface
upload-bg-active:     color-primary-soft
upload-radius:        radius-lg     # 10px
upload-padding:       space-12      # 48px
```

---

## CSS Custom Properties (Copy-Paste Ready)

### Light Mode

```css
:root {
  /* Typography */
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-body: 'Josefin Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Surfaces */
  --color-bg: #f3f5fa;
  --color-surface: #ffffff;
  --color-surface-2: #e9edf6;
  --color-surface-offset: #dce3f0;
  --color-border: #c9d2e4;
  --color-shadow: rgba(15, 25, 60, 0.08);

  /* Text */
  --color-text: #0d1530;
  --color-text-muted: #4a5478;
  --color-text-faint: #7a8299;

  /* Brand */
  --color-primary: #1f3ca8;
  --color-primary-hover: #15307f;
  --color-primary-soft: rgba(31, 60, 168, 0.13);

  /* Semantic */
  --color-success: #1f7a4d;
  --color-warning: #9a6400;
  --color-error: #b02a37;
  --color-success-soft: rgba(31, 122, 77, 0.10);
  --color-warning-soft: rgba(154, 100, 0, 0.10);
  --color-error-soft: rgba(176, 42, 55, 0.10);

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px var(--color-shadow);
  --shadow-md: 0 2px 6px var(--color-shadow);
  --shadow-lg: 0 4px 12px var(--color-shadow), 0 1px 3px var(--color-shadow);
  --shadow-xl: 0 8px 24px var(--color-shadow), 0 2px 6px var(--color-shadow);
  --shadow-focus: 0 0 0 3px var(--color-primary-soft);

  /* Transitions */
  --transition-fast: 120ms ease-out;
  --transition-base: 200ms ease-out;
  --transition-slow: 300ms ease-out;
}
```

### Dark Mode

```css
[data-theme="dark"] {
  /* Surfaces */
  --color-bg: #0c0f1a;
  --color-surface: #151929;
  --color-surface-2: #1c2236;
  --color-surface-offset: #232a42;
  --color-border: #2e3754;
  --color-shadow: rgba(0, 0, 0, 0.32);

  /* Text */
  --color-text: #e8ebf4;
  --color-text-muted: #9ba3c0;
  --color-text-faint: #626d8c;

  /* Brand */
  --color-primary: #5b7ce6;
  --color-primary-hover: #7a98f0;
  --color-primary-soft: rgba(91, 124, 230, 0.15);

  /* Semantic */
  --color-success: #34c47a;
  --color-warning: #d4a020;
  --color-error: #e05564;
  --color-success-soft: rgba(52, 196, 122, 0.12);
  --color-warning-soft: rgba(212, 160, 32, 0.12);
  --color-error-soft: rgba(224, 85, 100, 0.12);
}
```

---

## UI Direction Notes

- **Alignment:** Left-aligned throughout. No centered hero sections.
- **Density:** Compact spacing — prefer `space-2` to `space-4` for internal padding; `space-4` to `space-6` for section gaps.
- **Decorative elements:** None. No gradient buttons, no blobs, no illustrations.
- **Primary color usage:** Reserved for CTAs (buttons, links). Do not use for decorative borders or backgrounds — use `color-primary-soft` for subtle active-state highlights only.
- **Surface hierarchy:** `color-bg` > `color-surface` (cards) > `color-surface-2` (nested/stripe) > `color-surface-offset` (recessed).
- **Typography pairing:** Space Grotesk for anything the user scans (headings, labels, table headers, buttons). Josefin Sans for anything the user reads (body, descriptions, table cells, form inputs).

---

**Tokens are the single source of truth for all UI implementation in this project.**
