-- Where the 1С publication lives, set by the supplier's staff (customer, 2026-10-24: the base
-- moves to another server, the same base with the same keys). One row; none — ODATA_URL.
create table onec_address (
  id boolean primary key default true check (id),
  url text not null,
  changed_by text not null,
  changed_at timestamptz not null default now()
);
