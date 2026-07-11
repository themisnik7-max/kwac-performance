-- Drops the throwaway diagnostic from 20260712090000, same pattern as
-- 029/030, 037/038, 20260711160000/100 — never left installed longer than
-- the one investigation that needed it.
drop function if exists _diag_list_policies(text);
