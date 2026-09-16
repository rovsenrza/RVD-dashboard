# CLAUDE.md — РВД Кабинет

React 19 + TS + Vite + Tailwind v4 client cabinet for hydraulic-hose lifecycle. 1С (OData) is the source of truth; UI on MSW mocks until the BFF lands. Russian-only UI. Layers `shared → entities → features → app`, enforced by `npm run lint:arch`.

## Session start (token budget: ≤ 3k before real work)

1. `manage_adr(project="Users-User-Desktop-dashboard", mode="get")` — architecture, stack, patterns, philosophy. **This replaces reading PLAN.md / DESIGN.md / PRODUCT.md.** If it returns `no_adr` (the DB was reset by a tool update), restore it: `codebase-memory-mcp cli manage_adr --args-file <json with project, mode:"update", content: docs/ADR.md>`. Keep `docs/ADR.md` and the DB copy identical.
2. Read `docs/PLAN-STATUS.md` (short) — current day, blockers, open questions.
3. Only then, if the task needs it: `grep -n "^\*\*Д<N>" docs/PLAN.md` and read just that day's block. Never read PLAN.md whole.

## Code discovery protocol (mandatory — the graph is indexed and auto-watched)

| Need                                  | Do                                                                                                     | Don't                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------- |
| Find a symbol / where something lives | `search_graph(query="natural words")` (BM25) or `semantic_query=["word","word"]` (index is `moderate`) | `grep -r`, `ls -R`, `cat` |
| Read one function/component           | `get_code_snippet(qualified_name)`                                                                     | `Read` the whole file     |
| Who calls / what it calls             | `trace_path(function_name, direction="both", depth≤3)`                                                 | grep for the name         |
| Text/string search                    | `search_code(pattern, mode="compact")`                                                                 | Grep                      |
| Structure overview                    | `get_architecture(aspects=["overview"])`                                                               | walking the tree          |
| Impact before commit                  | `detect_changes()`                                                                                     | re-reading changed files  |

Rules:

- `Read` a file only when you are about to `Edit` it (and read only the needed range). Batch several graph calls in one turn.
- Do **not** run `index_repository` for freshness — the watcher (`auto_watch=true`) re-indexes on save. Run it only after adding many new files, with `persistence=true`, then commit `.codebase-memory/`.
- Do not `cat` directories, do not paste long files into the transcript, do not screenshot repeatedly (one batched capture round, fix, one confirm — max two).
- Update the ADR when architecture, stack or conventions change: edit `docs/ADR.md`, then push the same text with `manage_adr(mode="update")`.
- Broad, multi-file discovery ("where is X used across the app?", "audit all pages for Y") may be delegated to the tool's own subagents `codebase-memory-scout` (fast, provisional) / `codebase-memory` (verified) / `codebase-memory-auditor` (exhaustive) so the main context receives only the conclusion. Prefer a direct graph call when one or two calls suffice.

## Working rules

- Feature = type in `entities/types.ts` → hook in `shared/api/queries.ts` → MSW handler + generator → page composed from `shared/ui` primitives. No raw `<button|input|table>` outside `shared/ui` (CI fails).
- UI/design work: load the `impeccable` skill, run `.claude/skills/impeccable/scripts/impeccable context`, follow `DESIGN.md` (it is loaded by that command — do not Read it separately). Sheets never outlined; one amber accent; status text uses `-ink` tier.
- Before commit: `npm run lint:arch && npm run typecheck && npm test`; Prettier is enforced in CI. Commit style: imperative subject, body explains why. Attribution line per the current system reminder.
- End of a working day: tick `docs/PLAN-STATUS.md`, commit, push.

## Secrets & customer material

`.env*` (except `.env.example`), keys, `docs/customer/`, `.impeccable/review/`, the impeccable binary are gitignored. Never commit customer documents or 1С credentials.

## References (read on demand, not at start)

- `docs/PLAN.md` — 40-day plan; `docs/PLAN-STATUS.md` — daily checklist
- `docs/competitor-esm-analysis.md` — reference system (two-level model Рукав в сборе → Изделие)
- `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` — product truth and design system (via impeccable)
- `docs/1c/` — OData metadata and mapping (from Д1)
