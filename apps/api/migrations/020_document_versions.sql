-- The 1С version of each «Выпуск» document as last read. A document reposted with an
-- old date changes the register under an old Period that the check's «lines since»
-- never sees; its bumped version is what gives it away (customer test, 2026-10-12).
create table onec_documents (
  ref text primary key,
  version text not null
);
