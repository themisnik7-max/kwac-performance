-- ================================================
-- KWAC OS — Full Schema Update
-- Run this in Supabase SQL Editor
-- ================================================

-- 1. Fix lib/supabase createClient (already done via GitHub)

-- 2. Room bookings
create table if not exists room_bookings (
  id uuid default gen_random_uuid() primary key,
  room text not null,
  date date not null,
  time_slot text not null,
  agent_id uuid references agents(id) on delete cascade,
  client_name text not null,
  client_phone text,
  notes text,
  created_at timestamptz default now(),
  unique(room, date, time_slot)
);

-- 3. Marketing actions log
create table if not exists marketing_actions (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references properties(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  action_type text,
  status text default 'sent',
  recipients_count int default 0,
  post_url text,
  sent_at timestamptz default now()
);

-- 4. Sprint sessions
create table if not exists sprint_sessions (
  id uuid default gen_random_uuid() primary key,
  label text not null,
  date date not null,
  created_by uuid references agents(id) on delete set null,
  created_at timestamptz default now()
);

-- 5. Sprint entries
create table if not exists sprint_entries (
  id uuid default gen_random_uuid() primary key,
  sprint_id uuid references sprint_sessions(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  calls int default 0,
  leads int default 0,
  appointments int default 0,
  updated_at timestamptz default now(),
  unique(sprint_id, agent_id)
);

-- 6. Open House volunteers (NEW — max 2 per open house)
create table if not exists open_house_volunteers (
  id uuid default gen_random_uuid() primary key,
  open_house_id uuid references open_houses(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  created_at timestamptz default now(),
  unique(open_house_id, agent_id)
);

-- 7. Add ilist_id and extra fields to properties if not exists
alter table properties add column if not exists ilist_id text;
alter table properties add column if not exists transaction_type text;
alter table properties add column if not exists sub_area text;
alter table properties add column if not exists postal_code text;
alter table properties add column if not exists owner_name text;
alter table properties add column if not exists owner_email text;
alter table properties add column if not exists price_per_sqm numeric;
alter table properties add column if not exists rooms numeric;
alter table properties add column if not exists listed_at date;
alter table properties add column if not exists agent_name text;
alter table properties add column if not exists agent_email text;

-- 8. RLS
alter table room_bookings enable row level security;
drop policy if exists "room_bookings_all" on room_bookings;
create policy "room_bookings_all" on room_bookings for all using (auth.role() = 'authenticated');

alter table sprint_sessions enable row level security;
drop policy if exists "sprint_sessions_all" on sprint_sessions;
create policy "sprint_sessions_all" on sprint_sessions for all using (auth.role() = 'authenticated');

alter table sprint_entries enable row level security;
drop policy if exists "sprint_entries_all" on sprint_entries;
create policy "sprint_entries_all" on sprint_entries for all using (auth.role() = 'authenticated');

alter table open_house_volunteers enable row level security;
drop policy if exists "volunteers_all" on open_house_volunteers;
create policy "volunteers_all" on open_house_volunteers for all using (auth.role() = 'authenticated');

alter table marketing_actions enable row level security;
drop policy if exists "marketing_all" on marketing_actions;
create policy "marketing_all" on marketing_actions for all using (auth.role() = 'authenticated');

-- 9. Function: top producers by area
create or replace function top_producers_by_area(p_area text)
returns table(agent_name text, deals_count bigint, avg_price_per_sqm numeric)
language sql as $$
  select 
    p.agent_name,
    count(p.id) as deals_count,
    round(avg(p.price_per_sqm)::numeric, 0) as avg_price_per_sqm
  from properties p
  where p.area = p_area and p.status = 'sold' and p.price > 0 and p.sqm > 0
  group by p.agent_name
  order by deals_count desc, avg_price_per_sqm desc
  limit 3;
$$;

select 'Schema updated successfully' as status;