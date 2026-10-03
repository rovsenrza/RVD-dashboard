-- Who may enter the cabinet (Д6–Д7). A company is one of the supplier's clients, tied to its 1С
-- client: that client's data is all its users ever see.
create table companies (
  id text primary key,
  name text not null,
  onec_client_key text not null unique
);

create table users (
  id text primary key,
  company_id text not null references companies (id),
  name text not null,
  email text not null,
  password_hash text not null,
  role text not null,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index users_email_idx on users (lower(email));

-- Long-lived sign-ins: one row per refresh token, kept only as a hash; a token is replaced each
-- time it is used and revoked on sign-out.
create table sessions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
