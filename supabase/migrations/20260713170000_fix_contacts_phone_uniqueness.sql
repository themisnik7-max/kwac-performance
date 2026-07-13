-- Same untracked-drift bug as unique_email_contact (migration
-- 20260713100002), same fix: found live-testing the Gmail-lead pipeline —
-- a lead contact has no phone yet by design (only the property code and
-- message are known until the agent reveals + fills it in), and the second
-- one ever created hit "duplicate key value violates unique constraint
-- unique_phone — Key (phone)=(null) already exists." unique_phone doesn't
-- appear in any tracked migration either; same untracked-constraint class
-- as the email one, just missed in that pass because only email was
-- actually blocking anything yet at the time.
alter table contacts drop constraint if exists unique_phone;

create unique index if not exists contacts_agent_phone_uniq
  on contacts(agent_id, phone)
  where phone is not null;

select 'unique_phone (global, NULLS NOT DISTINCT) replaced with a per-agent partial unique index' as status;
