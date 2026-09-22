## PURPOSE

«РВД Кабинет» — client cabinet for a hydraulic-hose (РВД) supplier's customers: every serialised hose → machine (гаражный номер) → installation place → lifecycle status → planned replacement → request. 1С (platform 8.5, custom БСП config, OData) is the source of truth; the cabinet is the lens plus the actions the customer owns (installation facts, mileage, replacement facts, requests). Russian-only UI. Reference product: Eurohydroservice ESM (Kiberex). Plan of record: docs/PLAN.md (40 days), status: docs/PLAN-STATUS.md. Product truth: PRODUCT.md. Design system: DESIGN.md (+ .impeccable/design.json).

## STACK

Frontend only so far: React 19, TypeScript 6, Vite 8, Tailwind v4 (@theme tokens in src/index.css: role colours for light + dark, type scale text-micro…text-kpi registered with tailwind-merge in cn; lint:arch rejects text-[Npx] and raw colours), React Router 7, TanStack Query + Table v8, Recharts, lucide-react, @zxing/browser (barcode/QR, loaded on demand), class-variance-authority, date-fns, MSW mocks (VITE_USE_MOCKS=true), Vitest, oxlint, Prettier. Font: Golos Text self-hosted (public/fonts). Planned (PLAN.md §1): monorepo apps/web + apps/api (Node 22, Fastify, Prisma, Postgres, BullMQ/Redis) + packages/contracts (Zod); BFF between SPA and 1С OData with Postgres cache, sync worker, outbox for requests/replacements → 1С.

## ARCHITECTURE

Layers (import direction enforced by scripts/check-arch.sh, `npm run lint:arch`, in CI): shared → entities → features → app.

- src/shared/ui — the only place with raw <button|input|table>: Button, Input/SearchInput/Kbd, Badge, Chip, Card (= "sheet", the only container, never outlined), KpiStrip/KpiCard, DataTable (sort, pagination with page jump, column chooser, page size, sticky key column, toolbar/search slots, embedded mode), DescriptionList, Checkbox, Tabs, Menu, PageHeader, SegmentedControl, DatePicker (dd.MM.yyyy, ISO in/out), Tooltip, States (EmptyState/ErrorState/QueryState), Skeleton, EmptyValue/valueOr.
- src/shared/api — client.ts (fetch wrapper, VITE_API_BASE_URL) + queries.ts (TanStack hooks: useDashboard, useProducts, useProduct, useEquipment, useReplacements, useRequests, useCreateRequest). SINGLE swap point for real API.
- src/shared/mocks — MSW handlers + deterministic data generator (seed 42).
- src/entities — types.ts (domain from ТЗ, not 1С), product/ (STATUS_LABEL/TONE/COLOR/TEXT_CLASS/ORDER, ProductStatusBadge, ProductStatusBar), request/ (REQUEST_STATUS_*, RequestStatusBadge), user/ (UserRole labels and scopes, isBranchBound).
- src/features — dashboard (KpiGrid, ReplacementsChart, StatusDonut, UpcomingTable), products (ProductsPage, ProductPage, columns, ProductDetails), equipment, replacements, requests, admin (AdminPage: users / branches / settings tabs, admin role only), scan (ScanDialog + matchCode: camera or typed code → hose/machine by exact number), dev (UiPage — the /dev/ui catalogue, routed only when import.meta.env.DEV). Pages are composition only: PageHeader + QueryState + DataTable/components.
- src/app — layout/ (Layout, Sidebar rail, Header: branch switcher, ⌘K search, contact button, bell, user menu), session.tsx (SessionProvider/useSession mock until auth; demo role switch in the user menu, stored as rvd.role; branch-bound roles lock the branch), theme.ts (theme preference), router.tsx, providers.tsx.
  Routes (mock): GET /dashboard/summary, /products, /products/:id, /equipment, /replacements, /requests; POST /requests; admin (company-wide, never branch-scoped): GET/POST /admin/users, PATCH /admin/users/:id, POST /admin/users/:id/reset-password, GET /admin/branches, GET/PATCH /admin/settings — settings.warnPercent re-derives every hose status.

## PATTERNS

- Two independent status axes (Д2, from the 1С demo): `ProductStatus` — resource health computed by us from installedAt + serviceLifeDays (warn at last 20%), the primary UI axis; `ProductLifecycle` — the 1С workflow (Изготавливается → На складе → Отгружен → В эксплуатации → Требует замены → Списан), carried as-is and rendered from ReleaseDocument history. Thresholds still to be agreed (PLAN.md §5 q4). Text in a status colour always uses the -ink tier (AA).
- The two-level model is Каталожный номер → Изделие, not the ESM naming: `CatalogNumber` is the reference типоразмер (life, warranty, diameter, braid count, default composition) and `Product` copies those plus its own `composition` (hose + couplings + fittings from `ComponentItem`). Заявка maps to the 1С «Заказ клиента» (СВЦБ-number, branch, positions, shipment status), which syncs to a separate 1С:УТ base — see docs/1c/entities.md.
- Adding a feature: type in entities → hook in shared/api/queries → MSW handler + generator → page from shared/ui primitives → lint:arch green.
- UI work: load the impeccable skill, run `.claude/skills/impeccable/scripts/impeccable context`, follow DESIGN.md; never reintroduce bordered cards; detector must be clean; finish review before shipping a redesign.
- Empty values via EmptyValue; loading via shaped skeletons; errors via ErrorState with retry.

## TRADEOFFS

- Mocks first, integration later: UI is stable against 1С schema churn because adapters map 1С → entities/types.ts; cost is a second data model to maintain.
- Client-side pagination now; server-side mandatory from Д5 (reference has 170k hoses).
- Dark theme via role tokens: light values in @theme, dark set redefined for prefers-color-scheme and data-theme (user menu «Тема», localStorage rvd.theme, applied pre-paint in index.html); tokens.test.ts guards block parity and AA. No real auth yet (session is mocked).
- impeccable skill vendored in .claude/skills without its 12 MB binary (re-run `npx impeccable install`).
- Customer docs, video frames, .env*, review screenshots are gitignored.
- The ADR lives in the codebase-memory DB and is wiped on tool updates; docs/ADR.md is the committed copy — restore with `codebase-memory-mcp cli manage_adr --args-file` when `manage_adr get` returns no_adr.

## PHILOSOPHY

1С is the truth, the cabinet is the lens. Attention before inventory (first screen = what needs action). Every hose reachable in one search. Scan, don't read (status encoded in colour + shape consistently). Built for 170 000 rows. Token discipline for agents: query the graph (search_graph/get_code_snippet/trace_path) before reading files; read a file only to edit it; never cat whole directories.
