-- Д26: the 1С version (DataVersion) of each hose the cache holds, so a check finds what changed
-- without reading every hose again.
alter table products add column onec_version text;

-- How the sync is doing, one row: the last success (the «данные на HH:MM» line), the last full
-- rebuild, since when 1С has not answered and why, and how far the statuses register was read.
create table sync_health (
  id boolean primary key default true check (id),
  synced_at timestamptz,
  full_at timestamptz,
  failed_since timestamptz,
  last_error text,
  register_mark text
);

insert into sync_health default values;
