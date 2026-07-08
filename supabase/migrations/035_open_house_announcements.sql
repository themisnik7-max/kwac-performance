-- 035: open_houses/announcements schema drift + linking column.
--
-- Found while wiring "brochure generation auto-posts an announcement with a
-- 2-slot volunteer signup": open_houses' real columns are property_address/
-- time_start/time_end, but every single call site in the app (lib/aiAdmin.ts
-- executeCreateOpenHouse, app/api/open-house-quick, app/board/page.tsx) has
-- always assumed address/start_time/end_time — meaning open-house creation
-- via AI Admin and the quick-create route have been silently failing (NOT
-- NULL violation on the real property_address column), and the board page
-- has been reading undefined for every open house's address/times.
-- Separately, announcements has no agency_id at all (a real multi-tenancy
-- gap — CLAUDE.md: no table should assume a single tenant) and its real
-- text column is `body`, not `content` — app/api/monitor-remind's weekly
-- reminder insert has been failing (content/agency_id aren't real columns)
-- and app/board/page.tsx's announcement cards have been rendering blank
-- bodies. Renaming to match what the code already assumes fixes all of the
-- above at once, in every file, without touching application code.

alter table open_houses rename column property_address to address;
alter table open_houses rename column time_start to start_time;
alter table open_houses rename column time_end to end_time;

alter table announcements add column if not exists agency_id uuid references agencies(id);
alter table announcements rename column body to content;
alter table announcements add column if not exists open_house_id uuid references open_houses(id);

create index if not exists announcements_open_house_idx on announcements (open_house_id) where open_house_id is not null;

-- Temporary — same pattern as migration 029, dropped again once the
-- resulting RLS check (queried right after this migration lands) is acted on.
create or replace function _diag_list_policies(p_table text)
returns table(policyname text, cmd text, qual text, with_check text)
language sql stable security definer as $$
  select polname::text, case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else '*' end,
    pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
  from pg_policy
  where polrelid = p_table::regclass;
$$;

select 'open_houses/announcements schema drift fixed' as status;
