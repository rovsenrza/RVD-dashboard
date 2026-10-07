-- What the customer records about a machine that 1С does not keep (Д12): its department, which
-- the «по подразделениям» tree groups by, and its factory number. Laid over every sync.
create table equipment_local (
  equipment_id text primary key,
  client_id text not null,
  department text,
  factory_number text,
  updated_at timestamptz not null default now()
);
