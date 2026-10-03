-- Machines from 1С (Catalog_Техника): who owns them and their branch. What sits on a
-- machine (hose count, status mix, next replacement) is counted at read time from products,
-- so it follows today's date and the company's rules like the registry does.
create table equipment (
  id text primary key,
  client_id text not null,
  branch_id text not null,
  garage_number text not null,
  data jsonb not null
);

create index equipment_client_idx on equipment (client_id);
