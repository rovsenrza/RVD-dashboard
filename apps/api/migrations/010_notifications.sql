-- Д19: notices are worked out from the cache and the company's lead days at read time, so only
-- what people did with them is stored.

-- When 1С closed a request (done or refused): the moment of the «заявка выполнена» notice.
alter table requests add column closed_at timestamptz;

-- Which notices each person has read; a notice's id names its kind, object, date and lead.
create table notification_reads (
  user_id text not null references users (id) on delete cascade,
  notification_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

-- What each person wants to hear about; no row — everything (DEFAULT_NOTIFICATION_PREFS).
create table notification_prefs (
  user_id text primary key references users (id) on delete cascade,
  kinds jsonb not null default '{}',
  email boolean not null default true
);
