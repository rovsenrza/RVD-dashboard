# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: engineers and managers of industrial companies (mining, construction, logistics fleets) who own heavy equipment fitted with high-pressure hydraulic hoses (РВД). They work at a desk, on a desktop browser, for planning and control: which hoses are installed on which machine, which are nearing end of life, what to order. Secondary: field mechanics who record a replacement or raise a request from a tablet/phone in a workshop; and the supplier's managers who process requests in their own 1С system (outside this product).

Roles: механик (own branch, read + record replacement + create request), инженер (all branches of the company), руководитель (+ reports and comparisons), администратор (users, settings).

## Product Purpose

A client cabinet ("личный кабинет") where a customer of a hose supplier sees the full lifecycle of every hose delivered to them: installed → on warranty → approaching end of service life → needs replacement → replaced, tied to the machine and the exact installation point. It exists to turn unplanned equipment downtime (hose failure; 6–10 days to replace incl. logistics) into planned replacements ordered before failure. Success: the customer orders replacements ahead of time and downtime from hose failures drops; every hose on every machine is findable in seconds by EHS number, OEM number, or garage number.

## Positioning

The supplier already manufactures and serialises every hose and records its lifecycle in 1С. This cabinet is the customer-facing window into that same data — not a separate inventory the customer must maintain — plus the actions the customer owns (replacement facts, mileage, requests). The reference product (Eurohydroservice ESM by Киберэкс) has no KPI dashboard, no equipment hierarchy view, no notifications and no export in its manager panel; those are this product's differentiators.

## Operating Context

- Source of truth for hoses, assemblies, customers, branches, catalog, OEM numbers and lifecycle history is the supplier's 1С (platform 8.5, custom configuration on БСП), exposed via OData. Requests and replacement facts created here are sent to 1С, which runs its own business logic.
- Data scale in the reference deployment: ~170 000 serialised hoses, ~62 000 assemblies, ~16 000 OEM numbers, ~780 customer companies. Server-side pagination and search are mandatory.
- Domain model is two-level: **Рукав в сборе** (assembly / BOM: hose + 2 fittings + 2 couplings + optional protection, seals, plates, bolts, adapters; identified by number ЕГС) → **Изделие** (serialised unit, number ESM/EHS, shipped to a customer, installed on a machine under a garage number).
- Hierarchy the customer thinks in: Компания → Филиал → Единица техники (гаражный номер) → Узел / место установки → РВД.
- Lifecycle phases used by the supplier: Рабочий → Середина срока годности → Требуется замена → Не на гарантии; warranty quick values 90 / 180 / 270 / 360 days; mileage is recorded as километры or моточасы.
- Replacement reasons: гарантийная замена, капитальный ремонт, по требованию заказчика.
- Notification lead times required: 30 / 14 / 7 days before warranty end, planned replacement, service-life overrun, inspection.
- Reports must export to Excel and PDF.

## Capabilities and Constraints

- Sections required by the ТЗ: Главная (KPI dashboard with норма / внимание / замена colour states), Мои изделия (registry + card), Моя техника (hierarchy), История замен, Заявки и заказы, Уведомления, Отчёты, Администрирование.
- Product card must show full technical data, current status, remaining days to planned replacement, warranty status, equipment and installation place, photos/documents, repair/replacement history, specialist comments, and a one-click request for replacement or an identical hose.
- Access is scoped per company and branch; users of one company never see another's data.
- Browser-only, no installation; must work on tablet and phone as a secondary path.
- Undecided (open with customer): exact status thresholds (fixed 10–11.99 months vs. percentage of service life), where photos/documents are stored (here or 1С), which 1С object receives requests, hosting (customer server vs. ours), SMTP for e-mail notifications.
- Current codebase: React 19, TypeScript, Vite, Tailwind v4, TanStack Query/Table, Recharts, MSW mocks; component layers `shared/ui` → `entities` → `features` → `app`, enforced by CI. Backend (BFF + Postgres + 1С sync) is planned, not built.

## Brand Commitments

- Product/customer name and logo are not yet provided; the UI carries the placeholder «РВД Кабинет» until the customer supplies brand assets. Do not invent a company name.
- Binding visual reference set by the user: stay close to the Eurohydroservice ESM reference (dark sidebar, amber accent, light content area, dense data tables) while executing it more modern; avoid generic "AI-template" looks such as uniform bordered cards on every block.
- Interface language: Russian only. Domain terms are Russian (РВД, ЕГС/EHS, ESM, гаражный номер, моточасы) and must be used verbatim.

## Evidence on Hand

- Customer technical specification: `docs/customer/TZ_client_RVD.docx` (not committed).
- Reference case PDF (Киберэкс / Eurohydroservice ESM): `docs/customer/Kiberex_reference_case.pdf`; screen-recording of the ESM manager panel and 84 extracted frames: `docs/customer/video-frames/`; written analysis: `docs/competitor-esm-analysis.md`.
- Answers from the customer's 1С developer (platform, configuration, integration direction) recorded in `docs/PLAN.md` §0 and §5.
- No real customer data, testimonials, or metrics of this product exist yet; do not fabricate any. The "40 % less downtime" figure belongs to the reference product's case study, not to this one.

## Product Principles

1. **1С is the truth; the cabinet is the lens.** Never make the customer re-enter what the supplier already knows; only capture what the customer alone knows (installation, mileage, replacement facts, requests).
2. **Attention before inventory.** The first screen answers "what needs my action this month", then lets the user drill to the hose.
3. **Every hose reachable in one search.** EHS, OEM, garage number, client number — one field, one result list.
4. **Scan, don't read.** Status is encoded in colour and shape consistently everywhere (table cell, card, chart, equipment bar).
5. **Built for 170 000 rows.** Every list is paginated, sortable and filterable on the server; nothing assumes the whole dataset is in the browser.
