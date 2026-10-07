-- The supplier's catalogue numbers (Catalog_КаталожныеНомера): the request form suggests them,
-- the registry filters by them. Rewritten whole by every sync — a few hundred rows.
create table catalog_numbers (
  id text primary key,
  name text not null,
  data jsonb not null
);
