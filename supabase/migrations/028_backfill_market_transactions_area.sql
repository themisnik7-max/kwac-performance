-- 028: one-off backfill for the area-mapping bug fixed in lib/mamaRegistry.ts
-- (district_raw already includes the municipality prefix, e.g.
-- "ΑΘΗΝΑΙΩΝ - ΝΕΟΥ ΚΟΣΜΟΥ" — the import was prepending it a second time,
-- so no Athens neighborhood-level row ever matched). Raw columns were always
-- correct; only the derived `area` field needs recomputing.

update market_transactions set area = case district_raw
  when 'ΑΘΗΝΑΙΩΝ - ΝΕΟΥ ΚΟΣΜΟΥ'      then 'Νέος Κόσμος'
  when 'ΑΘΗΝΑΙΩΝ - ΚΟΛΩΝΑΚΙΟΥ'       then 'Κολωνάκι'
  when 'ΑΘΗΝΑΙΩΝ - ΚΥΨΕΛΗΣ'          then 'Κυψέλη'
  when 'ΑΘΗΝΑΙΩΝ - ΕΞΑΡΧΕΙΩΝ'        then 'Εξάρχεια - Νεάπολη'
  when 'ΑΘΗΝΑΙΩΝ - ΝΕΑΠΟΛΗΣ'         then 'Εξάρχεια - Νεάπολη'
  when 'ΑΘΗΝΑΙΩΝ - ΠΑΓΚΡΑΤΙΟΥ'       then 'Παγκράτι'
  when 'ΑΘΗΝΑΙΩΝ - ΚΟΥΚΑΚΙΟΥ'        then 'Κουκάκι - Μακρυγιάννη'
  when 'ΑΘΗΝΑΙΩΝ - ΜΑΚΡΥΓΙΑΝΝΗ'      then 'Κουκάκι - Μακρυγιάννη'
  when 'ΑΘΗΝΑΙΩΝ - ΑΜΠΕΛΟΚΗΠΩΝ'      then 'Αμπελόκηποι - Πεντάγωνο'
  else area
end
where district_raw in (
  'ΑΘΗΝΑΙΩΝ - ΝΕΟΥ ΚΟΣΜΟΥ','ΑΘΗΝΑΙΩΝ - ΚΟΛΩΝΑΚΙΟΥ','ΑΘΗΝΑΙΩΝ - ΚΥΨΕΛΗΣ',
  'ΑΘΗΝΑΙΩΝ - ΕΞΑΡΧΕΙΩΝ','ΑΘΗΝΑΙΩΝ - ΝΕΑΠΟΛΗΣ','ΑΘΗΝΑΙΩΝ - ΠΑΓΚΡΑΤΙΟΥ',
  'ΑΘΗΝΑΙΩΝ - ΚΟΥΚΑΚΙΟΥ','ΑΘΗΝΑΙΩΝ - ΜΑΚΡΥΓΙΑΝΝΗ','ΑΘΗΝΑΙΩΝ - ΑΜΠΕΛΟΚΗΠΩΝ'
);

select 'market_transactions: backfilled area for Athens sub-districts' as status;
