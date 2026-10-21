-- The last good copy of each set 1С gave whole. When one set fails — on 2026-10-21 the
-- cabinet lost its right to read «Модели» and the whole exchange stopped — the sync takes
-- that copy and goes on with the rest (1С developer, 2026-10-22).
create table onec_snapshots (
  entity text primary key,
  rows jsonb not null,
  saved_at timestamptz not null default now()
);

-- The sets the last run took from those copies, with 1С's answer: what the monitor reports.
alter table sync_health add column partial jsonb;
