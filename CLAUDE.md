# Claude Code Guidelines — RVD Dashboard

## Project Overview

- **Type:** React 19 + TypeScript dashboard for high-pressure hose (РВД) lifecycle management
- **Stack:** Vite, Tailwind v4, React Router, TanStack Query/Table, Recharts, MSW (mock API)
- **Domain:** ТЗ-based (customer requirements), not 1C-derived
- **Integration stage:** Frontend-only; 1C OData integration is phase 2

## Before Any Code Operation

### 0. **Read the Plan** (every session)

- [docs/PLAN.md](docs/PLAN.md) — 40-day implementation plan, architecture, DoD, risks
- [docs/PLAN-STATUS.md](docs/PLAN-STATUS.md) — what is done / in progress / blocked; **update it at the end of each working day**
- [docs/competitor-esm-analysis.md](docs/competitor-esm-analysis.md) — reference system analysis (two-level model: Рукав в сборе → Изделие)
- `docs/1c/` — OData metadata, entity list, mapping (appears from Д1)
- [DESIGN.md](DESIGN.md) + [PRODUCT.md](PRODUCT.md) — design system tokens/rules and product truth (impeccable). **Any UI work: load the `impeccable` skill, run `impeccable context`, follow DESIGN.md; never reintroduce bordered cards.**

### 1. **Query the Codebase Graph First** (Not File Read)

Every session, before `Read`, `grep`, or `ls`:

```bash
# Find existing code
search_graph(name_pattern="useDashboard")
search_graph(label="Component")

# Trace dependencies
trace_path("DataTable", mode="calls")
trace_path("useProducts", mode="cross_service")

# Get exact snippet
get_code_snippet("DashboardPage", module="features/dashboard/DashboardPage.tsx")

# Complex patterns
query_graph("""
  MATCH (p:Export {name: 'useDashboard'})-[r:HAS_RETURN]->(t)
  RETURN p.name, t.name
""")
```

**Why:** Graph queries cost ~500 chars/answer; file reads cost 5KB+. 10x token efficiency.

### 2. **Architectural Context**

When planning changes:

```bash
get_architecture(aspects=["routing", "data_flow", "components"])
```

Returns high-level module relationships without reading files.

---

## Project Structure (via codebase-memory)

```
src/
  app/              layout (sidebar + header), router, providers
  entities/types.ts domain model — NOT from 1C, from ТЗ §3
  features/         dashboard, products, equipment, replacements, requests
  shared/
    api/            fetch client + Query hooks ← SINGLE POINT FOR 1C SWAP
    mocks/          MSW handlers + deterministic data gen
    ui/             Button, Input/SearchInput, Badge, Chip, Card(=sheet), KpiStrip/KpiCard,
                    DataTable, Tabs, Menu, PageHeader, States, Skeleton, EmptyValue
    lib/utils.ts    cn, formatDate (null-safe), formatNumber, daysLeft
  entities/product  STATUS_* vocab, ProductStatusBadge, ProductStatusBar
  app/session.tsx   SessionProvider/useSession (mock until auth)
  app/layout/       Layout, Sidebar (rail), Header (branch switcher, ⌘K search, user menu)
docs/customer/      ТЗ + Kiberex (in .gitignore, never committed)
.codebase-memory/   graph.db.zst (29 KB, shared with team)
```

---

## Key Principles

### 1. **Domain Types Are Golden** (`src/entities/types.ts`)

- Derived from **customer ТЗ**, not 1C schema
- Never change to match 1C structure; instead, **adapt 1C → our types** in `shared/api`
- Gives UI stability even as 1C configuration evolves

### 2. **API Is One Adapter Layer**

File: `src/shared/api/client.ts` + `src/shared/api/queries.ts`

When 1C OData lands:

- Modify only these two files + optional `shared/api/adapters/` folder
- Feature hooks (`useDashboard`, `useProducts`) **do not change**
- UI stays stable; zero component rewrites

### 3. **Mock Data = Real Schema**

File: `src/shared/mocks/data.ts`

Mock data structure already matches `entities/types.ts`. MSW is drop-in replacement for real API — same request/response shapes.

### 4. **Secrets & Customer Docs**

- `.gitignore`: Never commit `.env*` (except `.env.example`), `*.pem`, `*.key`, `docs/customer/`
- `.env.local` is local only
- Test with `VITE_USE_MOCKS=true`; real 1C later via env var

### 5. **Status Logic is Critical** (ТЗ conflicts)

See conflicts documented in project memory:

- Statuses (`ok` / `warn` / `replace` / `no_warranty`) calculated from **installed date** + **service life**, not ship date
- Warranty date is separate; no_warranty is explicit status
- `daysLeft()` in utils handles this

---

## Workflow

### Adding a Feature

1. **Query graph** for related modules (e.g., "what calls useProducts?")
2. **Add type** to `entities/types.ts`
3. **Add query hook** to `shared/api/queries.ts`
4. **Add mock handler** to `shared/mocks/handlers.ts` + data generator
5. **Build UI** in `features/*/`
6. **Test locally**: `npm run dev` with mocks
7. **CI verifies**: lint, typecheck, test, build (no secrets escape)

### Integrating 1C OData

1. **Get customer's `$metadata`** (EDMX from 1C)
2. **Create adapter** in `shared/api/adapters/oneC.ts` that maps OData → `entities/types.ts`
3. **Update client.ts** to fetch from 1C endpoint
4. **Swap environment variable**: `VITE_USE_MOCKS=false` → production
5. **Zero UI changes** (that's the point)

---

## Scripts

```bash
npm run dev           # local + mocks on 5173
npm run build         # typecheck + vite build → dist/
npm run lint          # oxlint
npm run typecheck     # tsc -b --noEmit
npm run format        # prettier
npm test              # vitest run
npm run msw:init      # regenerate public/mockServiceWorker.js (one-time)
```

---

## CI/CD

**GitHub Actions** (`.github/workflows/ci.yml`):

- Triggers: push to `main`, PRs
- Checks: lint → format → typecheck → test → build
- Artifacts: `dist/` uploaded (7 days)
- **CD:** placeholder; deploy step TBD when server ready

**Commit style:**

```
<subject in imperative>

<optional body, explain why not what>

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## Debugging

**If typecheck fails:**

- Check `tsconfig.app.json` path resolution (`@/*` → `src/*`)
- TanStack Table v8 (not v7); check import paths

**If mock data looks wrong:**

- Edit `src/shared/mocks/data.ts` (deterministic seed is hardcoded for stability)
- MSW handler in `handlers.ts` returns from `data.ts`

**If 1C integration fails later:**

- First: validate `$metadata` (EDMX structure)
- Second: test adapter alone with sample payload
- Third: swap `client.ts` fetch URL
- UI should work unchanged

---

## References

- **Customer ТЗ:** `docs/customer/TZ_client_RVD.docx` (conflicts doc in project memory)
- **Reference case:** `docs/customer/Kiberex_reference_case.pdf` (UI inspiration, not copy)
- **Codebase index:** `.codebase-memory/graph.db.zst` (425 nodes, 700 edges)
- **Memory:** Session-local notes in `/Users/User/.claude/projects/-Users-User-Desktop-dashboard/memory/`

---

## Known Constraints

1. **Mock data is deterministic** (same seed every reload) — useful for testing, but don't rely on randomness
2. **Status bar** on equipment shows stacked counts — depends on mock breakdown; real data may look different
3. **1C fields we don't know yet** — operating hours, installation location, repair history are placeholders
4. **Two-phase architecture** — requests flow through 1C, but 1C handles its own business logic (we send payload only)

---

**Last updated:** Sep 16, 2026
