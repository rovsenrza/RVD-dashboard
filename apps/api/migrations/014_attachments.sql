-- Д25: files people attach — to a hose at once, to a request as drafts its form claims on
-- creation. The bytes live in the file store (FILES_DIR); this is what they are and whose.
create table attachments (
  id text primary key,
  client_id text,
  owner_kind text,
  owner_id text,
  file_name text not null,
  mime_type text not null,
  size integer not null,
  kind text not null,
  has_preview boolean not null default false,
  uploaded_at timestamptz not null default now(),
  uploaded_by text not null,
  uploaded_by_id text not null
);

create index attachments_owner_idx on attachments (owner_kind, owner_id);
-- Drafts nobody claimed are purged after a day.
create index attachments_drafts_idx on attachments (uploaded_at) where owner_kind is null;
