## PURPOSE

«РВД Кабинет» — client cabinet for a hydraulic-hose (РВД) supplier's customers: every serialised hose → machine (гаражный номер) → installation place → lifecycle status → planned replacement → request. 1С (platform 8.5, custom БСП config, OData) is the source of truth; the cabinet is the lens plus the actions the customer owns (installation facts, mileage, replacement facts, requests). Russian-only UI. Reference: Eurohydroservice ESM. Plan: docs/PLAN.md, docs/PLAN-STATUS.md; product: PRODUCT.md; design: DESIGN.md.

## STACK

Frontend only so far: React 19, TypeScript 6, Vite 8, Tailwind v4 (@theme tokens in src/index.css: role colours for light + dark, type scale text-micro…text-kpi registered with tailwind-merge in cn; lint:arch rejects text-[Npx] and raw colours), React Router 7, TanStack Query + Table v8, Recharts, lucide-react, @zxing/browser (barcode/QR, loaded on demand), read-excel-file + write-excel-file (xlsx import and templates, loaded on demand), class-variance-authority, date-fns, MSW mocks (VITE_USE_MOCKS=true), Vitest, Playwright (visual regression: `npm run test:visual`, 22 screens, macOS baselines, local only), oxlint, Prettier. Font: Golos Text self-hosted (public/fonts). Planned (PLAN.md §1): monorepo apps/web + apps/api (Node 22, Fastify, Prisma, Postgres, BullMQ/Redis) + packages/contracts (Zod); BFF between SPA and 1С OData with Postgres cache, sync worker, outbox for requests/replacements → 1С.

## ARCHITECTURE

Layers (import direction enforced by scripts/check-arch.sh, `npm run lint:arch`, in CI): shared → entities → features → app.

- src/shared/ui — the only place with raw <button|input|table>: Button, Input/SearchInput/Kbd, Badge, Chip, Card (the sheet), KpiStrip/KpiCard, DataTable (sort, paging, column chooser, sticky key column, embedded; `handle.visibleRows()` = filtered+sorted rows for export), ExportMenu (Excel/CSV), SimpleTable (print), DescriptionList, Checkbox, FileButton, Textarea, Thumbnail, Tabs, Menu, PageHeader, SegmentedControl, DatePicker (dd.MM.yyyy, ISO in/out), Tooltip, States (EmptyState/ErrorState/QueryState), Skeleton, EmptyValue/valueOr.
- src/shared/api — client.ts (fetch wrapper, VITE_API_BASE_URL) + queries.ts (TanStack hooks). SINGLE swap point for real API.
- src/shared/mocks — MSW handlers + deterministic data generator (seed 42).
- src/entities — types.ts (domain from ТЗ, not 1С), product/ (STATUS_LABEL/TONE/COLOR/TEXT_CLASS/ORDER, ProductStatusBadge, ProductStatusBar), request/ (REQUEST_STATUS_*, RequestStatusBadge), user/ (UserRole labels and scopes, isBranchBound), audit/ (action and object labels), replacement/ (reasons, usage units).
- src/features — dashboard, products, equipment, replacements (journal, ReplacementDialog), requests, compare (models side by side; manager+admin), reports (7 reports + /reports/print; manager+admin), admin (users, branches, settings, import, audit log; admin only), scan (camera/typed code → hose or machine), attachments (hose-card sheet, viewer, form picker + useUploads, history strip, paperclip count in tables), dev (UiPage — the /dev/ui catalogue, routed only when import.meta.env.DEV). Pages are composition only: PageHeader + QueryState + DataTable/components.
- src/app — layout/ (Layout, Sidebar rail, Header: branch switcher, ⌘K search, contact button, bell, user menu), session.tsx (SessionProvider/useSession mock until auth; demo role switch in the user menu, stored as rvd.role; branch-bound roles lock the branch), theme.ts (theme preference), router.tsx, providers.tsx.
  Routes (mock): GET /dashboard/summary, /products, /products/:id, /equipment, /replacements, /requests; POST /requests; admin (company-wide, never branch-scoped): /admin/users (GET/POST/PATCH, reset-password), /admin/branches, /admin/settings (warnPercent re-derives statuses), /admin/audit; POST /replacements (writes the old hose off, installs the new one in its place), GET /products/:id/replacements, GET /equipment/:id/replacements; GET /analytics/models; GET /reports/:id?branch&from&to; files (Д25): GET /products/:id/attachments, POST /attachments (multipart; a draft without `productId`), GET /attachments/:id/file, DELETE /attachments/:id (hose files only); POST /requests and /replacements take `attachmentIds`.

## PATTERNS

- Two independent status axes (Д2, from the 1С demo): `ProductStatus` — resource health computed by us from installedAt + serviceLifeDays (warn at last 20%), the primary UI axis; `ProductLifecycle` — the 1С workflow (Изготавливается → На складе → Отгружен → В эксплуатации → Требует замены → Списан), carried as-is and rendered from ReleaseDocument history. Thresholds still to be agreed (PLAN.md §5 q4). Text in a status colour always uses the -ink tier (AA).
- The two-level model is Каталожный номер → Изделие, not the ESM naming: `CatalogNumber` is the reference типоразмер (life, warranty, diameter, braid count, default composition) and `Product` copies those plus its own `composition` (hose + couplings + fittings from `ComponentItem`). Заявка maps to the 1С «Заказ клиента» (СВЦБ-number, branch, positions, shipment status), which syncs to a separate 1С:УТ base — see docs/1c/entities.md.
- Adding a feature: type in entities → hook in shared/api/queries → MSW handler + generator → page from shared/ui primitives → lint:arch green.
- UI work: impeccable skill + `impeccable context`, follow DESIGN.md; no bordered cards; detector clean; finish review before a redesign ships.
- Empty values via EmptyValue; loading via shaped skeletons; errors via ErrorState with retry.
- Files (Д25): `Attachment.url`/`previewUrl` come from the server (BFF route or signed link). Forms upload each file as a draft on pick and submit the ids; the server binds them. Limits in `entities/attachment`, checked by form and server; antivirus: EICAR on mocks, ClamAV on the BFF. Downloads via fetch → Blob (carries the session). Stored in the cabinet, not 1С БСП (PLAN.md §5 q5).
- Reports (Д21): the server builds a `Report` (typed columns, all rows in scope, totals); the browser writes Excel from it and prints /reports/print (A4 landscape, always light) for PDF; the BFF will serve .xlsx/.pdf for the same query. Registry «Экспорт» = what the table shows. Excel dates are UTC midnights.
- Every mutation writes an action-log line (who, when, object, changed fields before → after) as display strings, so the log reads right even after the object changes; unchanged saves write nothing. On mocks the handlers record it; on the BFF it is middleware (Д23).

## TRADEOFFS

- Mocks first, integration later: UI is stable against 1С schema churn because adapters map 1С → entities/types.ts; cost is a second data model to maintain.
- Client-side pagination now; server-side mandatory from Д5 (reference has 170k hoses).
- Dark theme via role tokens: light values in @theme, dark set redefined for prefers-color-scheme and data-theme (rvd.theme, applied pre-paint); tokens.test.ts guards parity and AA. No real auth yet (session is mocked).
- impeccable skill vendored in .claude/skills without its 12 MB binary (re-run `npx impeccable install`).
- Customer docs, video frames, .env*, review screenshots are gitignored.
- The ADR lives in the codebase-memory DB and is wiped on tool updates; docs/ADR.md is the committed copy — restore with `codebase-memory-mcp cli manage_adr --args-file` when `manage_adr get` returns no_adr.

## PHILOSOPHY

1С is the truth, the cabinet is the lens. Attention before inventory (first screen = what needs action). Every hose reachable in one search. Scan, don't read (status encoded in colour + shape consistently). Built for 170 000 rows. Agents: graph first, read a file only to edit it.
