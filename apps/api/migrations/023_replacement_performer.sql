-- Who physically swapped a hose on the machine: 1С does not keep it, and does not want to
-- (customer, 2026-10-22), so the client picks one of its own staff in the cabinet. Keyed by
-- the new hose — the swap's id.
create table replacement_local (
  product_id text primary key,
  performer_id text references users (id) on delete set null,
  updated_at timestamptz not null default now()
);
