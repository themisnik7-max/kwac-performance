-- 026: 025's dedupe unique index used coalesce(sqm_main, -1), an expression —
-- PostgREST's upsert(onConflict:'col,col,...') can only target a unique
-- index/constraint by plain column list, so every import upsert silently
-- matched nothing and inserted 0 rows. sqm_main is already required to be
-- non-null and positive by the import's own filtering (parseRegistryRows),
-- so a plain NOT NULL column works fine here — no need for the coalesce.

drop index if exists market_transactions_dedupe_idx;
alter table market_transactions alter column sqm_main set not null;
create unique index if not exists market_transactions_dedupe_idx
  on market_transactions (municipality, district_raw, contract_date, price, sqm_main);
