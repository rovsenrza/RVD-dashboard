-- A password the administrator gave (a new user, a reset) is for the first sign-in only: until the
-- person sets their own, the cabinet lets them do nothing else.
alter table users add column must_change_password boolean not null default false;
