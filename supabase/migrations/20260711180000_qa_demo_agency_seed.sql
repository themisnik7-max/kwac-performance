-- One-off QA smoke-test seed data, requested to exercise 6 product surfaces
-- (Personal Admin listing, newsletter send, Metrisimotita, Sprint Calls,
-- Zitiseis, Open House) end-to-end through 10 agents registered via the real
-- /api/register flow. Deliberately kept as a normal data-only migration
-- (same "insert, don't erase" pattern as demo=true seed data elsewhere) so
-- it stays visible in `supabase migration list` rather than being a
-- one-off SQL editor change nobody can trace later.
--
-- Fully isolated from the real KW Athens Center agency: new agency_id, a
-- distinct .test email domain (reserved by IANA for testing, never
-- resolves), and exactly ONE consented contact (the requester's own inbox)
-- so any newsletter/SMS send this batch triggers can only ever reach that
-- one address. IDs are fixed literals (not gen_random_uuid()) so the
-- driving script can reference them without a round trip.
--
-- Agency id:    aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000
-- Property ids: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001 .. 0010
-- Contact id:   aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0099

insert into agencies (id, name, allowed_email_domain, require_approval)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000',
  'KWAC QA Demo Agency (2026-07-11 test batch - safe to remove)',
  'qademo-20260711.test',
  false
)
on conflict (id) do nothing;

insert into properties (id, agency_id, address, area, city, deal_type, transaction_type, status, property_type, sqm, floor, rooms, condition, price_asking, ilist_id)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Πατησίων 10', 'Κολωνάκι',     'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 60,  1, 2, 'excellent',        150000, 'QADEMO-01'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Λ. Αλεξάνδρας 11', 'Παγκράτι',     'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 68,  2, 3, 'good',             162000, 'QADEMO-02'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Ερμού 12', 'Νέος Κόσμος',  'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 76,  3, 3, 'fair',             174000, 'QADEMO-03'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Τσιμισκή 13', 'Πετράλωνα',    'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 84,  4, 4, 'needs_renovation', 186000, 'QADEMO-04'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Λ. Κηφισίας 14', 'Κυψέλη',       'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 92,  5, 2, 'excellent',        198000, 'QADEMO-05'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Σόλωνος 15', 'Αμπελόκηποι',  'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 100, 1, 3, 'good',             210000, 'QADEMO-06'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Ιπποκράτους 16', 'Γκάζι',        'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 108, 2, 4, 'fair',             222000, 'QADEMO-07'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Λ. Συγγρού 17', 'Χαλάνδρι',     'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 116, 3, 2, 'needs_renovation', 234000, 'QADEMO-08'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Αγ. Παρασκευής 18', 'Νέα Σμύρνη',   'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 124, 4, 3, 'excellent',        246000, 'QADEMO-09'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0010', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000', 'Θησέως 19', 'Ίλιον',        'Αθήνα', 'sale', 'sale', 'active', 'Διαμέρισμα', 132, 5, 4, 'good',             258000, 'QADEMO-10')
on conflict (id) do nothing;

insert into contacts (id, agency_id, full_name, email, email_consent, sms_consent, type)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0099',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0000',
  'QA Newsletter Test Recipient',
  'n.themis2000@yahoo.gr',
  true,
  false,
  'contact'
)
on conflict (id) do nothing;

select 'QA demo agency + 10 properties + 1 consented contact seeded' as status;
