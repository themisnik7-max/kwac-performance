-- 019: multi-property newsletter campaigns, SMS campaigns, and per-recipient
-- click tracking (see skills/listing-marketing-kit/SKILL.md). Two consent
-- columns because email and SMS marketing consent are legally distinct — a
-- contact having one does not imply the other.

alter table contacts add column if not exists email_consent boolean not null default false;
alter table contacts add column if not exists sms_consent   boolean not null default false;

create table if not exists marketing_campaigns (
  id               uuid default gen_random_uuid() primary key,
  agency_id        uuid references agencies(id),
  agent_id         uuid references agents(id),
  channel          text not null check (channel in ('email', 'sms')),
  property_ids     uuid[] not null default '{}',
  subject          text,
  content          text,          -- html for email, plain text for sms
  status           text not null default 'draft' check (status in ('draft', 'sent')),
  brevo_campaign_id bigint,        -- email only
  created_at       timestamptz default now(),
  sent_at          timestamptz
);

create table if not exists marketing_campaign_recipients (
  id               uuid default gen_random_uuid() primary key,
  campaign_id      uuid not null references marketing_campaigns(id) on delete cascade,
  contact_id       uuid references contacts(id),
  destination_url  text not null,  -- where the tracked link redirects to
  brevo_message_id text,           -- sms only; email tracking comes from Brevo's own campaign stats
  sent_at          timestamptz,
  delivered_at     timestamptz,
  clicked_at       timestamptz,
  click_count      integer not null default 0
);

create index if not exists marketing_campaigns_agency_idx on marketing_campaigns (agency_id, created_at desc);
create index if not exists marketing_campaign_recipients_campaign_idx on marketing_campaign_recipients (campaign_id);

alter table marketing_campaigns enable row level security;
drop policy if exists "marketing_campaigns_agency_isolation" on marketing_campaigns;
create policy "marketing_campaigns_agency_isolation" on marketing_campaigns
  for all using (agency_id = current_agency_id());

-- Recipients has no agency_id of its own — scope through its parent campaign.
alter table marketing_campaign_recipients enable row level security;
drop policy if exists "marketing_campaign_recipients_agency_isolation" on marketing_campaign_recipients;
create policy "marketing_campaign_recipients_agency_isolation" on marketing_campaign_recipients
  for all using (
    exists (
      select 1 from marketing_campaigns c
      where c.id = marketing_campaign_recipients.campaign_id
      and c.agency_id = current_agency_id()
    )
  );
