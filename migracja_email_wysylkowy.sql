-- ============================================================
-- MIGRACJA: indywidualny adres wysyłkowy (servfleet.com) per user
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

alter table public.profiles
    add column if not exists email_wysylkowy text;
