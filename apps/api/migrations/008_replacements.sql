-- Д16: a swap in 1С is a new hose naming the one it replaces (Изделия.ЗаменяемоеИзделие_Key).
-- The journal is read from this link; only a few hoses carry it, so the index is partial.
alter table products add column replaced_product_id text;

create index products_replaced_idx on products (replaced_product_id)
  where replaced_product_id is not null;
