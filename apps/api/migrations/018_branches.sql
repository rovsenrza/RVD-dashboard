-- A client company can be several clients in 1С, one per site (customer, 2026-10-08): each is a
-- branch of the company, and its data is the company's. companies.onec_client_key stays the
-- company's first client; every company starts with that one branch.
create table company_branches (
  client_key text primary key,
  company_id text not null references companies (id) on delete cascade,
  name text not null
);

create index company_branches_company_idx on company_branches (company_id);

insert into company_branches (client_key, company_id, name)
  select onec_client_key, id, name from companies;

-- The branches a person works in; none — the whole company. A mechanic has exactly one.
create table user_branches (
  user_id text not null references users (id) on delete cascade,
  client_key text not null references company_branches (client_key) on delete cascade,
  primary key (user_id, client_key)
);
