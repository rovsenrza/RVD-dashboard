-- Д19: the daily e-mail digest went to this person for this day — sent once, whatever restarts.
create table notification_mail (
  user_id text not null references users (id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  notices integer not null,
  primary key (user_id, day)
);
