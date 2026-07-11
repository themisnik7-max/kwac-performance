-- marketing_campaigns.status only ever had 'draft'/'sent'. Both send routes
-- (newsletter, sms) wrote status:'sent' at the START of the per-recipient
-- send loop, before a single Brevo call had actually run. A timeout mid-loop
-- (large recipient list, Brevo degradation, Hobby's 60s ceiling) killed the
-- function with the campaign permanently mis-recorded as fully sent even
-- though only some (or zero) recipients actually got it — and no way to
-- detect the gap short of manually diffing marketing_campaign_recipients.
--
-- Widening the lifecycle so app/api/marketing/newsletter and
-- app/api/marketing/sms can set status only after the loop actually
-- completes, honestly reflecting "still sending" (stuck there on a crash)
-- or "some recipients failed" instead of lying. Matches CLAUDE.md's
-- write-ordering rule: a mid-execution failure should leave the safer/more
-- honest partial state, not a corrupted-looking one.
--
-- Constraint name isn't assumed — this project's own drift log
-- (ARCHITECTURE.md) is full of cases where a live object didn't match what
-- the original migration file implied, so the actual check constraint on
-- this column is looked up and dropped by content, not by a guessed name.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'marketing_campaigns'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table marketing_campaigns drop constraint %I', con.conname);
  end loop;
end $$;

alter table marketing_campaigns add constraint marketing_campaigns_status_check
  check (status in ('draft', 'sending', 'sent', 'partial', 'failed'));

select 'marketing_campaigns status lifecycle widened' as status;
