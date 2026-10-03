-- Requests the cabinet took, and their way to 1С (Д17–Д18). Unlike the 1С cache these rows are the
-- cabinet's own: a sync never deletes them. Each is sent until 1С answers; the id is the
-- Idempotency-Key, so a resend never makes a second order.
create table requests (
  id text primary key,
  client_id text not null,
  branch_id text not null,
  kind text not null,
  positions jsonb not null,
  comment text,
  attachment_ids jsonb not null default '[]',
  author jsonb not null,
  created_at timestamptz not null default now(),
  delivery text not null default 'queued',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  onec_ref text,
  number text,
  status text not null default 'new',
  shipment_status text not null default 'not_shipped'
);

create index requests_client_idx on requests (client_id, created_at desc);
create index requests_due_idx on requests (next_attempt_at) where delivery = 'queued';
create index requests_open_idx on requests (onec_ref) where delivery = 'delivered';
