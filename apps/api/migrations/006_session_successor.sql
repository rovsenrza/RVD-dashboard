-- A refresh token spent by rotation names the one that replaced it. A request that raced the
-- rotation (two tabs restoring at once, a reload during a renewal) is still answered for a few
-- seconds while that successor is alive, instead of signing the user out.
alter table sessions add column replaced_by text;
