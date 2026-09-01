-- ============================================================
-- MIGRACJA: termin kolejnego kontaktu (przypomnienia) przy leadzie
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

alter table public.leady
    add column if not exists termin_kontaktu date;
