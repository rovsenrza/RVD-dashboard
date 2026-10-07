-- What the customer alone knows (Д11, Д12): kept by the cabinet, never by 1С, so a sync never
-- loses it — the sync lays these fields over each hose it writes.
create table product_local (
  product_id text primary key,
  client_id text not null,
  install_place text,
  client_number text,
  updated_at timestamptz not null default now()
);

-- Notes on a hose by the company's people; the author's name and role as they were then.
create table product_comments (
  id text primary key,
  product_id text not null,
  client_id text not null,
  author_id text not null,
  author_name text not null,
  author_role text not null,
  text text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index product_comments_product_idx on product_comments (product_id, created_at desc);

-- «Связаться со специалистом»: kept here and passed on once there is a channel (question 15).
create table support_messages (
  id text primary key,
  client_id text,
  company_id text,
  author_id text not null,
  author_name text not null,
  author_email text not null,
  topic text not null,
  product_id text,
  installed_at date,
  text text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  delivery_error text
);

create index support_messages_undelivered_idx on support_messages (created_at)
  where delivered_at is null;
