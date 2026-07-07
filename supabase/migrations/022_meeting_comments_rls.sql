-- 022: meeting_comments RLS wasn't captured in any prior migration (live-only,
-- same situation as meeting_valuations/contacts). Redefine explicitly:
-- SELECT is agency-scoped for everyone; writes go ONLY through
-- /api/meeting-comments now (service role, enforces top-producer-or-admin
-- eligibility) — no direct client insert/update/delete path remains, so RLS
-- denies those outright rather than trying to replicate the eligibility
-- check in SQL.

alter table meeting_comments enable row level security;

drop policy if exists "meeting_comments_agency_isolation" on meeting_comments;
drop policy if exists "meeting_comments_select" on meeting_comments;
drop policy if exists "meeting_comments_no_direct_write" on meeting_comments;

create policy "meeting_comments_select" on meeting_comments
  for select using (
    exists (
      select 1 from meeting_properties p
      where p.id = meeting_comments.property_id
      and p.agency_id = current_agency_id()
    )
  );

-- No insert/update/delete policy for the authenticated role — direct client
-- writes are denied by default once RLS is enabled with no matching policy.
-- The service-role client used by /api/meeting-comments bypasses RLS.

select 'meeting_comments RLS: agency-scoped reads, writes only via API' as status;
