-- Each hose's lines in 1С's statuses register, oldest first: the card's «История ЖЦ».
-- Rebuilt with the products by the sync; the register in 1С is the source of truth.
create table product_history (
  product_id text primary key,
  records jsonb not null
);
