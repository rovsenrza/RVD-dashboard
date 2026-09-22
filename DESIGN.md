---
name: РВД Кабинет
description: Control-room UI for hydraulic-hose lifecycle — dark navigation rail, warm working field, unbordered white sheets, one amber accent.
colors:
  field: '#f3f3f1'
  sheet: '#ffffff'
  sheet-muted: '#f8f8f6'
  line: '#e6e6e2'
  line-strong: '#d6d6d0'
  rail: '#161616'
  rail-raised: '#222222'
  rail-ink: '#f3f3f1'
  rail-muted: '#8a8a86'
  ink: '#191919'
  ink-secondary: '#4c4c49'
  ink-muted: '#6b6b66'
  ink-faint: '#a3a39d'
  on-brand: '#191919'
  on-status: '#ffffff'
  pop: '#ffffff'
  row-hover: '#fffaf0'
  brand: '#f5a623'
  brand-dark: '#d98c0c'
  brand-press: '#cf850b'
  brand-deep: '#9a6206'
  brand-soft: '#fff3dc'
  status-ok: '#2e9e5b'
  status-ok-soft: '#e5f5ea'
  status-ok-ink: '#1b6f3d'
  status-warn: '#e8961b'
  status-warn-soft: '#fdf1dc'
  status-warn-ink: '#8f5300'
  status-replace: '#d9463b'
  status-replace-soft: '#fbe6e4'
  status-replace-ink: '#b02a22'
  status-none: '#8b8f94'
  status-none-soft: '#eceef0'
  status-none-ink: '#5b6066'
typography:
  page-title:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '22px'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.02em'
  sheet-title:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '-0.01em'
  kpi-number:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '28px'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '-0.02em'
  body:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 'normal'
  table-cell:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 'normal'
  table-header:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: '0.025em'
  label:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '12.5px'
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 'normal'
  badge:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 500
    lineHeight: 1.65
    letterSpacing: 'normal'
rounded:
  sm: '6px'
  md: '8px'
  lg: '12px'
  sheet: '14px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  2xl: '24px'
  3xl: '32px'
components:
  sheet:
    backgroundColor: '{colors.sheet}'
    rounded: '{rounded.sheet}'
    padding: '20px'
  button-primary:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '8px 14px'
    height: '36px'
  button-primary-hover:
    backgroundColor: '{colors.brand-dark}'
  button-secondary:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '8px 14px'
    height: '36px'
  button-secondary-hover:
    backgroundColor: '{colors.sheet-muted}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-secondary}'
    rounded: '{rounded.md}'
    height: '36px'
  input:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '0 12px'
    height: '36px'
  nav-item:
    backgroundColor: 'transparent'
    textColor: '{colors.rail-muted}'
    rounded: '{rounded.md}'
    padding: '0 12px'
    height: '40px'
  nav-item-active:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.ink}'
  badge-ok:
    backgroundColor: '{colors.status-ok-soft}'
    textColor: '{colors.status-ok-ink}'
    typography: '{typography.badge}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
  badge-warn:
    backgroundColor: '{colors.status-warn-soft}'
    textColor: '{colors.status-warn-ink}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
  badge-replace:
    backgroundColor: '{colors.status-replace-soft}'
    textColor: '{colors.status-replace-ink}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
  badge-none:
    backgroundColor: '{colors.status-none-soft}'
    textColor: '{colors.status-none-ink}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
  page-current:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    height: '32px'
---

# РВД Кабинет — Design System

## Overview

A control room, not a card wall. The screen has three materials and nothing else: a near-black **rail** on the left that holds navigation, a warm-neutral **field** that is the working ground, and white **sheets** laid on the field that hold every table, chart and form. The sheet is the only container in the system and it is never outlined — depth comes from one soft, offset shadow. Amber is the single accent and it means "current" or "primary": the active nav item, the primary button, links, focus rings, the current page number. Status (норма / внимание / требуется замена / не на гарантии) has its own four-colour vocabulary that never doubles as decoration.

The world is pinned to the customer's reference (Eurohydroservice ESM): dark sidebar, amber, light content, dense data tables — executed with modern spacing, one workhorse Cyrillic typeface and no chrome the reference does not have. Mode is Operate: engineers and managers at a desk; scanability and consistency beat expression.

Source of truth for tokens: `src/index.css` (`@theme`). Primitives: `src/shared/ui/`. Domain status UI: `src/entities/product/`, `src/entities/request/`.

## Colors

- **Field** `#f3f3f1` is the page ground; **sheet** `#ffffff` sits on it. `sheet-muted` is the hover tint for secondary controls; clickable table rows use the opaque `row-hover` (amber-warmed, so a pinned sticky cell matches the row under it). **Pop** is the surface of menus, dialogs, toasts and chart tooltips — equal to the sheet in light, lifted above it in dark. `wash` is the translucent hover/pressed tint for ghost controls and menu items; `scrim` darkens the page under dialogs and the off-canvas rail.
- **Rail** `#161616` with `rail-ink` / `rail-muted` text. Hover on rail items is `rail-hover`; the active item is a solid amber fill with `on-brand` text (never amber text on black).
- **Ink** ramp: `ink` for content, `ink-secondary` for secondary cells, `ink-muted` for labels and table headers (4.5:1 on the field), `ink-faint` only for placeholders and the empty-value dash.
- **Brand** amber: `brand` for fills (buttons, active nav, current page, chart bars); `brand-deep` for text links and amber text on white (AA); `brand-soft` as the row-hover tint under a pointer and the filter-chip ground. `brand-dark` is hover and `brand-press` is pressed for amber fills. Text on any amber fill is `on-brand` (dark in both themes), never `ink`.
- **Status** has three tiers per state: the base hue for marks (dots, bars, chart slices), `-soft` for pill grounds, `-ink` for any text set in that status colour. Text on a `-soft` tint or on white is always the `-ink` tier; base hues are never used as text. Status colours are semantic and appear only on pills, bars, chart marks and the tinted KPI numbers — never as section colour or decoration.
- Hairline `line` divides rows and KPI cells; `line-strong` is the resting outline of inputs and secondary buttons (rendered as an inset ring, not a border). Nothing else is outlined.
- Tokens are named by role, so a theme only swaps values; components never pick colours per theme. Text on a status base fill (status bar segments) is `on-status`; the danger button fills with `status-replace-ink` and sets its label in `sheet`, which holds AA in both themes.
- **Dark theme** (`src/index.css`): the same properties redefined under `@media (prefers-color-scheme: dark)` for «Как в системе» and under `:root[data-theme='dark']` for an explicit choice (the user menu's «Тема» control; stored in `localStorage` as `rvd.theme` and applied in `index.html` before first paint). Depth order in dark: rail `#0b0b0a` below field `#131312` below sheet `#1b1b1a` below pop `#242422`. Amber and the status base hues are unchanged; `-soft` grounds become dark tints and `-ink` text becomes light, `brand-deep` becomes a light amber `#f6b54d` for links. `src/shared/lib/tokens.test.ts` keeps the two dark blocks identical and asserts AA for every text/ground pair in both themes.

## Typography

One family: **Golos Text** (variable 400–700, self-hosted in `public/fonts/`, Cyrillic + Latin subsets). Fallback stack `ui-sans-serif, system-ui`. No display face; hierarchy comes from size and weight steps on a ~1.125 scale.

- Page title 22/600, tracking −0.02em, `text-wrap: balance`. One per screen, left, with a 13.5px muted description under it.
- Sheet title 15/600. Table, column-group and detail-section headers are all 12/500 uppercase, tracking +0.025em, `ink-muted`. Body and table cells 14/400. Labels 12.5. Badges 12/500. Nothing below 11px.
- Sizes are tokens in `@theme` (`--text-*`), sizes only — line-height is inherited or set with `leading-*`: `text-micro` 11 (kbd, tab counts, brand sub-line, status-bar digits) · `text-caption` 12 (uppercase headers, badges, meta lines) · `text-label` 12.5 (labels, legends, chips) · `text-ui` 13.5 (nav, descriptions, small buttons) · `text-sm` 14 (body, cells) · `text-sheet-title` 15 · `text-heading` 17 · `text-title` 22 · `text-kpi` 28. Arbitrary `text-[Npx]` fails `npm run lint:arch`. A new step must also be registered with tailwind-merge in `shared/lib/utils.ts`, or `cn()` will drop it beside a text colour.
- Numerals: `font-variant-numeric: tabular-nums` is set globally (`tnum`) and reinforced with the `tabular` utility wherever digits align (tables, KPI numbers, pagination, legends).
- Dates are `dd.MM.yyyy`; numbers use `ru-RU` grouping. Empty values render through `EmptyValue` (a muted `—`), never a hard-coded dash.

## Layout

- Rail 240px fixed on ≥lg; off-canvas with a scrim below. Header 64px, white, with a 1px `line` underline; content area scrolls independently.
- Content column: max-width 1440px, padding 32px×28px on desktop, 16px×20px on phones. Every screen is `PageHeader` (title left, actions right) then sheets.
- Sheets stack with 20px gaps. The dashboard grid is KPI strip (full width) → 2/3 + 1/3 charts → full-width table. KPI strip is one sheet with a 1px `line` gap-grid: 6 columns ≥xl, 3 on md, 2 on phones.
- Tables: full-bleed inside their sheet (cells padded 20px horizontally, 12px vertically), hairline rows, header underline. Horizontal overflow scrolls inside the sheet with a right-edge fade + chevron cue; the key column pins once the table actually overflows. Toolbar row: tabs/chips left, search right (its own row on phones), column chooser at the end.
- Breakpoints are structural (rail collapse, KPI column count, hide low-priority columns), never fluid type.
- Touch (`pointer: coarse`, not a width breakpoint) raises targets without changing desktop density: buttons 40/44px (`sm`/`md`), icon buttons 40/44px, inputs and selects 44px at 16px type (iOS Safari zooms into anything smaller), menu rows 44px, chip remove 32px.
- Phones (<640px): dialogs become full-width bottom sheets whose footer buttons share the width and clear the home indicator; detail pages pin their actions to a bottom bar (`PageHeader stickyActions`, main reserves room via `:has([data-sticky-actions])`, toasts lift above it); table pagination shrinks to «‹ 12 / 19 ›». Tables become row cards inside the same sheet (hairlines, never a card per row): the key value leads, its status sits right of it, the other visible columns follow as «label value» lines. Each column declares its phone role in `meta.mobile` — `title`, `aside`, `full` (label-less, e.g. the equipment status bar) or `hide`; the column chooser still applies.

## Elevation & Depth

Two shadows only, both with offset and blur:

- `--shadow-sheet`: `0 1px 2px rgb(20 20 18 / .04), 0 2px 8px rgb(20 20 18 / .05)` — every sheet.
- `--shadow-pop`: `0 4px 12px rgb(20 20 18 / .08), 0 12px 32px rgb(20 20 18 / .1)` — menus, dialogs, toasts, tooltips.

Motion: one entrance only — `animate-sheet-in` (220 ms, expo-out, 16px rise + fade) on dialogs and bottom sheets. Everything else changes state with ≤150 ms colour transitions. `prefers-reduced-motion` collapses all of it.

In dark both shadows deepen to black at higher alpha, and `shadow-pop` gains a 1px inset white/6 hairline, because a shadow alone does not separate a pop surface from a dark sheet.

Inputs and secondary buttons express their edge with an inset ring (`inset 0 0 0 1px line-strong`), so they read as controls without adding a border vocabulary. No glass, no gradients, no coloured halos. Never nest a sheet inside a sheet; embedded tables and empty states use their `embedded` / `inset` variants.

## Shapes

- Sheet 14px. Controls (buttons, inputs, nav items, menu items, page numbers) 8px. Menus 12px. Pills, chips, avatars, status dots fully round. Icon tiles 8px.
- Icons: Lucide, 16px in controls (15px in `sm`), 17px in the rail, stroke 1.75. Never emoji or Unicode glyphs as icons.
- Status bar: 10px tall rounded track with 1px gaps between segments; counts sit beside it as 10px dots + status-ink numbers.

## Components

- **Button** (`shared/ui/Button`): `primary` amber/ink, `secondary` white with inset ring, `ghost` text-only, `rail` for the dark rail, `danger`. Sizes `sm` 32px, `md` 36px, `icon` 36px, `icon-sm` 32px, `auto` for composite triggers. Icons via `icon` / `trailingIcon`. Focus ring is the amber outline.
- **Input / SearchInput / Kbd**: 36px, inset-ring edge, amber 2px ring on focus. `aria-invalid` swaps the resting ring for `status-replace-ink` (focus still wins); the message itself goes in the `Field` error slot. Search carries a leading magnifier and an optional trailing hint (`⌘K`). The global search in the header sits on the field tint until focused.
- **Card** is the sheet: `title` + optional `action` header, 20px padding, `padded={false}` for full-bleed content.
- **KpiStrip / KpiCard**: one sheet, cells divided by 1px `line`; each cell is icon (amber) + label (12.5 muted) + 28px number (tinted by tone) + delta pill (`ok`/`replace` soft tints) + period text. Cells are buttons when they drill down.
- **DataTable**: TanStack table with sort glyphs, hairline rows, hover `row-hover`, amber current page in `1 2 3 … N` pagination with a «Стр. [№]» jump field past five pages (Enter; out-of-range numbers land on the first or last page), «N на странице» selector and «Колонки» chooser when `tools` is on, `stickyFirstColumn`, `hiddenByDefault`, `embedded` for use inside a Card, `toolbar` / `search` slots.
- **Tabs**: underline tabs, 2px amber rule under the active one, optional count pill.
- **Badge**: tones `neutral | ok | warn | replace | none | brand`, optional leading dot. Domain wrappers: `ProductStatusBadge`, `RequestStatusBadge`.
- **Chip**: removable filter, `brand-soft` ground, `brand-deep` text.
- **Menu**: click-to-open dropdown on the `pop` surface, 12px radius, `shadow-pop`, sized to its content (`w-max`, min 224px), optional header, separators, `danger` items; closes on outside click and Escape.
- **SegmentedControl**: a radio group drawn as a `field` track with one raised `pop` segment; icon-only segments keep their label for screen readers and the tooltip; arrow keys move the choice. Used for «Тема» (Как в системе / Светлая / Тёмная).
- **DescriptionList**: label/value pairs in two aligned columns — muted `dt`, tabular `dd`, missing values as `EmptyValue`; `termWidth` sets the minimum term column (140px default, 120px in the narrow equipment card).
- **DatePicker**: an `Input` that always reads `дд.мм.гггг` regardless of browser locale; typing digits inserts the dots, a pasted ISO date is accepted, and the calendar button opens the native picker. Speaks ISO (`yyyy-MM-dd`, `''` when empty). Impossible or out-of-range dates block submit through native validation and are marked `aria-invalid` once the field is left. Never use a raw `type="date"` input — it shows `mm/dd/yyyy` in an English browser.
- **Tooltip**: a short hint on the `pop` surface, `text-caption`, `shadow-pop`; opens after 350 ms of mouse hover or at once on keyboard focus, flips below when there is no room above, closes on Escape or scroll, and links itself with `aria-describedby`. Replaces native `title`. Never the only place for information a task needs.
- **`/dev/ui`** (dev builds only): the living catalogue — every colour token, the type scale and each primitive in its states. Switch «Тема» in the user menu to review both themes on one screen.
- **Scan** (`features/scan`; a header button on touch devices, and the «Сканировать код» action in ⌘K everywhere — first when the query is empty or starts «скан», «код», «камер», «qr»): a bottom sheet with the rear-camera preview, an amber aim frame over a scrim, one status line and a «Или введите номер» field that always works. A code opens its hose or machine by exact match (EHS, internal, OEM, then garage/inventory number; a URL's `ehs`/`serial` parameter or last segment is accepted); an unknown code says so in `status-replace-ink` and never guesses. The zxing decoder loads only when the sheet opens, and the camera stops on a read or on close.
- **PageHeader**: back link, title (may carry a badge), description, actions. **States**: `EmptyState`, `ErrorState` (with retry), `QueryState` wrapper; **Skeleton**, `TableSkeleton`, `KpiSkeleton` shaped like the real content.
- **Sidebar**: brand mark (amber tile + wordmark + small caps line), nav with solid amber active fill, footer with «Помощь» and the data-source line.
- **Header**: company › branch switcher (icon tile + two-line text + chevron), centred global search, amber «Связаться со специалистом», bell with red dot, avatar (amber, initials) + name + role + chevron menu; the menu holds «Тема» and, until real auth, «Роль · демо». For a branch-bound role (mechanic) the branch switcher becomes a static label with a lock and a tooltip instead of a menu.

## Do's and Don'ts

- Do put every block on a sheet and let the field show between sheets; don't outline a sheet or a section, and never nest sheets.
- Do use amber for one thing per screen region (the active item, the primary action); don't use it for decoration, icons in bulk, or backgrounds behind text.
- Do encode status with the same four colours everywhere (pill, dot, bar, slice); don't invent a fifth or use the base hue as text.
- Do keep tables dense and scannable: uppercase muted headers, tabular numbers, hairlines; don't add zebra stripes, cell borders or card-per-row lists on desktop.
- Do reach for `EmptyValue`, `EmptyState`, skeletons and the error state; don't write "Загрузка…" or a bare dash by hand.
- Do build in `shared/ui` first — the architecture guard fails CI on raw `<button>`, `<input>`, `<table>` in features.
- Don't introduce a second typeface, gradient text, glass, coloured left borders, or a kicker above a heading.
