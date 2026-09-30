-- The cabinet's cache of 1С data. Rebuilt by the sync; nothing here is the source of truth.
create extension if not exists pg_trgm with schema public;

create table sync_state (
  entity text primary key,
  synced_at timestamptz not null,
  rows integer not null,
  duration_ms integer not null
);

-- Facts only: the status is derived at read time from these dates and the current rules.
create table products (
  id text primary key,
  client_id text not null,
  branch_id text not null,
  equipment_id text,
  catalog_number_id text,
  serial_number text not null,
  type text not null,
  lifecycle text not null,
  shipped_at date,
  installed_at date,
  warranty_days integer not null,
  service_life_days integer not null,
  search text not null,
  data jsonb not null
);

create index products_client_idx on products (client_id);
create index products_equipment_idx on products (equipment_id);
create index products_lifecycle_idx on products (lifecycle);
create index products_search_idx on products using gin (search gin_trgm_ops);
