-- Schema drift: contacts has a live constraint "unique_email_contact"
-- (UNIQUE NULLS NOT DISTINCT (email)) that does not exist in any file under
-- supabase/migrations — created directly against the database outside the
-- tracked migration workflow at some point (see ARCHITECTURE.md's schema-
-- drift log; this is the same class of issue as the untracked schema chunk
-- documented there, just a constraint instead of a table this time).
--
-- Two separate problems with it:
--  1. NULLS NOT DISTINCT means every contact with no email address is
--     treated as a duplicate of every other one — so at most ONE contact in
--     the entire system could ever have a blank email. That directly broke
--     Personal Admin's new "a client card doesn't need full details yet"
--     feature the moment a second phone-only contact was created.
--  2. It has no agency_id (or agent_id) in it at all, so even with emails
--     present it was a global constraint across every tenant — two
--     different agencies could never each have a contact with the same
--     real email address. Exactly the single-tenant-shortcut bug class
--     CLAUDE.md flags, just expressed as a constraint instead of a query.
--
-- Replacement: unique per agent when an email is actually present. Contacts
-- are agent-owned (see 20260712110000) — two different agents, even in the
-- same agency, may legitimately each hold their own contact for the same
-- real person (a buyer who independently reaches out to more than one
-- agent), so this is scoped to agent_id, not agency_id.
alter table contacts drop constraint if exists unique_email_contact;

create unique index if not exists contacts_agent_email_uniq
  on contacts(agent_id, email)
  where email is not null;

select 'unique_email_contact (global, NULLS NOT DISTINCT) replaced with a per-agent partial unique index' as status;
