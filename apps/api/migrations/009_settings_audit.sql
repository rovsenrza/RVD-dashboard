-- Д22: what the company's administrator changed in its settings, over the shared defaults
-- (DEFAULT_SETTINGS in @rvd/contracts); the «Внимание» rule here drives every status it reads.
alter table companies add column settings jsonb not null default '{}';

-- Д23: who did what in the company's cabinet, worded as the customer reads it at the time, so a
-- line stays readable after the user or the object it names has changed.
create table audit_log (
  id bigint generated always as identity primary key,
  company_id text not null references companies (id),
  at timestamptz not null default now(),
  actor_id text not null,
  actor_name text not null,
  action text not null,
  target_kind text not null,
  target_id text,
  target_label text not null,
  changes jsonb not null
);

create index audit_log_company_idx on audit_log (company_id, at desc, id desc);
