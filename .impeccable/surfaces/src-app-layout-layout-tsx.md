---
version: 1
slug: "src-app-layout-layout-tsx"
primary_target: "src/app/layout/Layout.tsx"
related_targets: ["src/features/dashboard/DashboardPage.tsx","src/features/products/ProductsPage.tsx","src/index.css"]
---

# Surface: app shell + dashboard + registries (src/app, src/features/*)

Mode: Operate. Audience: engineers/managers at a desk, desktop browser, planning hose replacements; mechanics on tablet as secondary.
Job: see what needs action this month, find any hose in one search, drill to product/equipment, raise a request.
Constraints: Russian only; reference pinned by user = Eurohydroservice ESM (dark sidebar, amber accent, light content, dense tables) executed more modern; user explicitly rejects uniform bordered cards ("AI slop"), an empty header, and a bare profile block. Placeholder brand «РВД Кабинет» until assets arrive.
Unresolved: brand logo/colours; dark theme (deferred, tokens must allow it); branch switcher data (mock session for now).

## Direction contract

THESIS: A control room, not a card wall. One dark rail of navigation, one light working field, and white *sheets* laid on it — the sheet is the only container, and it is never outlined. Refuses: the dashboard-of-identical-bordered-cards and the hero-metric grid.

OWN-WORLD: Warm-neutral field #F3F3F1; white sheets with a 1px-offset soft shadow, radius 14; near-black rail #161616 with amber #F5A623 as the single accent (active nav fill, primary button, links, focus ring, current page); semantic status green/amber/red/grey only on pills, bars and chart marks. Type: Golos Text (Russian-designed UI sans, full Cyrillic) at a 1.125 scale, tabular numerals everywhere digits align. Hairlines #E6E6E2 divide rows and KPI cells, never wrap blocks. Icons: Lucide, 16px, 1.75 stroke.

STORY: The user lands, reads six numbers in one strip, sees the red slice, clicks it, lands on a filtered registry, opens a hose, presses «Создать заявку». Every screen: title left, actions right, sheet below.

FIRST VIEWPORT (Главная, 1440): 240px rail; header 64px with company › branch switcher, global search (⌘K) centred, «Связаться со специалистом» amber, bell, avatar+name+role menu. Field: h1 «Главная» + period control; KPI strip = one sheet, 6 cells divided by hairlines (icon, label, 28px number, delta pill); below: 2/3 bar chart sheet + 1/3 status donut sheet; then «Ближайшие плановые замены» sheet with borderless table.

FORM: Reference-pinned by user (Kiberex ESM), position 1 of 1; no seed (pinned brief beats the roll).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
