-- ============================================================
-- MIGRACJA: wielkość floty (liczba pojazdów) przy leadzie
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

alter table public.leady
    add column if not exists wielkosc_floty integer;
