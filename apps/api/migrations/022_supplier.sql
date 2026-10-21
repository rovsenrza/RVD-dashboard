-- The supplier's own section (customer, 2026-10-22): its staff register client companies,
-- switch their access off, look at the cabinet as any company or any of its people, and say
-- where each branch's requests and messages go.

-- A company the supplier switched off: none of its people get in.
alter table companies add column active boolean not null default true;
-- `supplier` — the supplier's own staff, never a client; `client` — everyone else.
alter table companies add column kind text not null default 'client';

-- A staff sign-in looking at a client company: as one of its people, or as a hidden
-- administrator of its own (acting_user null). It outlives renewals, not the session.
alter table sessions add column acting_company text references companies (id) on delete cascade;
alter table sessions add column acting_user text references users (id) on delete cascade;

-- Where letters go, per supplier branch (1С `Catalog_Филиалы`, the client's `Филиал_Key`);
-- the row with an empty key is the general mailbox for clients of no branch with its own.
create table supplier_mailboxes (
  filial_key text primary key,
  requests_email text,
  support_email text
);
