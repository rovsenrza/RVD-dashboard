-- With mail (question 7): a new user or a reset gets a link to set their own password instead of a
-- one-time password the administrator passes on. Kept as a hash; one use; 48 hours.
create table password_invites (
  token_hash text primary key,
  user_id text not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index password_invites_user_idx on password_invites (user_id) where used_at is null;
