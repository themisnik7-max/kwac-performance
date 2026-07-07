-- 025: real transaction data from the Greek Ministry of Finance's public
-- "Μητρώο Αξιών Μεταβιβάσεων Ακινήτων" (property transfer values registry,
-- gsis.gr) — anonymized, official, actual sale prices, unlike the agency's
-- own `properties` comps which are currently almost all still-active
-- listings (asking price, not proven market value).
--
-- Deliberately has NO agency_id — this is national public reference data,
-- not tenant data. Every other table in this project carries agency_id per
-- CLAUDE.md's multi-tenancy rule; this is the one legitimate exception,
-- since a second agency would want the exact same registry rows, not its
-- own copy. Read access is agency-agnostic (any authenticated agent);
-- writes only via the service-role import route.

create table if not exists market_transactions (
  id                uuid default gen_random_uuid() primary key,
  prefecture        text not null,
  municipality      text not null,       -- Δήμος, as published (e.g. ΓΛΥΦΑΔΑΣ)
  district_raw      text,                -- Δημοτικό/Κοινοτικό Διαμέρισμα, as published
  area              text,                -- normalized to match properties.area naming (e.g. Γλυφάδα) — null if unmapped
  category          text not null,       -- Κατηγορία Ακινήτου
  sqm_main          numeric,
  sqm_aux           numeric,
  year_built        integer,
  floor             text,
  contract_date     date not null,
  price             numeric not null,
  source            text not null default 'mama_registry',
  source_year       integer not null,    -- which yearly export file this row came from
  imported_at       timestamptz default now()
);

create index if not exists market_transactions_area_idx on market_transactions (area, contract_date desc);
create index if not exists market_transactions_municipality_idx on market_transactions (municipality, contract_date desc);
-- One row per (municipality, district_raw, contract_date, price, sqm_main) as a practical
-- dedupe key for re-imports — the source data has no natural transaction id.
create unique index if not exists market_transactions_dedupe_idx
  on market_transactions (municipality, district_raw, contract_date, price, coalesce(sqm_main, -1));

alter table market_transactions enable row level security;
drop policy if exists "market_transactions_read_any_authenticated" on market_transactions;
create policy "market_transactions_read_any_authenticated" on market_transactions
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policy — writes only via the service-role import route.

select 'market_transactions created' as status;
