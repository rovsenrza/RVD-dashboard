-- Data 1С keeps twice and differently (question 24): the 1С developer wants a letter about each.
-- The nightly rebuild records what it finds and closes what is gone; a disagreement that comes
-- back after a fix is news again. The letter goes once, when there is an address to send it to.
create table data_issues (
  key text primary key,
  kind text not null,
  product_id text not null,
  text text not null,
  found_at timestamptz not null default now(),
  resolved_at timestamptz,
  notified_at timestamptz,
  notify_error text
);

create index data_issues_unsent_idx on data_issues (found_at)
  where resolved_at is null and notified_at is null;
