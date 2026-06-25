-- KWAC OS — Migration 007: Passive tracking + PostgreSQL-native intelligence
-- Eliminates the Python ML backend entirely. Idempotent.

create table if not exists call_events (
  id          uuid        default gen_random_uuid() primary key,
  agent_id    uuid        references agents(id) on delete cascade,
  agency_id   uuid        references agencies(id) on delete cascade,
  contact_id  uuid        references contacts(id) on delete set null,
  phone       text        not null,
  called_at   timestamptz default now(),
  duration_s  integer
);

alter table call_events enable row level security;
drop policy if exists "call_events_owner" on call_events;
create policy "call_events_owner" on call_events for all using (agency_id = current_agency_id());
create index if not exists idx_call_events_agent_week on call_events (agent_id, called_at desc);

create table if not exists weekly_call_counts (
  agent_id    uuid   references agents(id) on delete cascade,
  agency_id   uuid   references agencies(id) on delete cascade,
  week_start  date   not null,
  call_count  integer default 0,
  primary key (agent_id, week_start)
);

alter table weekly_call_counts enable row level security;
drop policy if exists "weekly_call_counts_owner" on weekly_call_counts;
create policy "weekly_call_counts_owner" on weekly_call_counts
  for all using (agency_id = current_agency_id() and (agent_id = current_agent_id() or is_ceo_or_admin()));

create or replace function increment_weekly_call_count(p_agent_id uuid, p_agency_id uuid, p_week_start date)
returns void language sql as $$
  insert into weekly_call_counts (agent_id, agency_id, week_start, call_count)
  values (p_agent_id, p_agency_id, p_week_start, 1)
  on conflict (agent_id, week_start) do update set call_count = weekly_call_counts.call_count + 1;
$$;

create or replace function haversine_km(lat1 float8, lon1 float8, lat2 float8, lon2 float8)
returns float8 language sql immutable parallel safe as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ))
$$;

create table if not exists spatial_landmarks (
  id    text primary key, label text not null, lat float8 not null, lon float8 not null
);

insert into spatial_landmarks (id, label, lat, lon) values
  ('metro_syntagma','Μετρό Συντάγματος',37.9755,23.7348),
  ('metro_monastiraki','Μετρό Μοναστηράκι',37.9761,23.7257),
  ('metro_kifissia','Μετρό Κηφισιά',38.0740,23.8120),
  ('acropolis','Ακρόπολη',37.9715,23.7257),
  ('ellinikon','Ελληνικό Experience',37.8939,23.7315),
  ('coastline_faliro','Παραλία Φαλήρου',37.9270,23.7000),
  ('coastline_glyfada','Παραλία Γλυφάδας',37.8679,23.7512),
  ('coastline_voula','Παραλία Βούλας',37.8424,23.7741)
on conflict (id) do nothing;

create or replace function property_proximity_scores(p_lat float8, p_lon float8)
returns jsonb language sql stable as $$
  select jsonb_object_agg(id, round(haversine_km(p_lat, p_lon, lat, lon)::numeric, 2))
  from spatial_landmarks
$$;

create or replace function proximity_multiplier(p_lat float8, p_lon float8)
returns float8 language sql stable as $$
  with dists as (
    select
      min(haversine_km(p_lat, p_lon, lat, lon)) filter (where id like 'metro%') as metro_km,
      min(haversine_km(p_lat, p_lon, lat, lon)) filter (where id like 'coastline%') as coast_km,
      haversine_km(p_lat, p_lon, 37.9715, 23.7257) as acropolis_km,
      haversine_km(p_lat, p_lon, 37.8939, 23.7315) as ellinikon_km
    from spatial_landmarks
  )
  select greatest(0.90, least(1.15,
    1.0
    + case when metro_km < 0.5 then 0.05 when metro_km < 1.0 then 0.03 when metro_km < 2.0 then 0.01 else 0.0 end
    + case when coast_km < 2.0 then 0.04 when coast_km < 5.0 then 0.02 else 0.0 end
    + case when ellinikon_km < 3.0 then 0.03 else 0.0 end
  )) from dists
$$;

alter table meeting_comments add column if not exists comment_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(comment, ''))) stored;
create index if not exists idx_meeting_comments_tsv on meeting_comments using gin(comment_tsv);

create or replace function comment_sentiment_multiplier(p_comment text)
returns float8 language sql immutable as $$
  select greatest(0.85, least(1.15,
    1.0
    + (case when to_tsvector('simple', p_comment) @@ to_tsquery('simple', 'αριστη | εξαιρετικη | ανακαινισμενο | θεα | μοναδικο | premium') then 0.05 else 0.0 end)
    + (case when to_tsvector('simple', p_comment) @@ to_tsquery('simple', 'ζητηση | αναπτυξη | επενδυση') then 0.03 else 0.0 end)
    - (case when to_tsvector('simple', p_comment) @@ to_tsquery('simple', 'προβλημα | υγρασια | παλαιο | κατεστραμμενο | υποτιμηση') then 0.05 else 0.0 end)
    - (case when to_tsvector('simple', p_comment) @@ to_tsquery('simple', 'πτωτικη | αδυναμια | αργα') then 0.03 else 0.0 end)
  ))
$$;

select '007_spatial_and_search applied' as status;