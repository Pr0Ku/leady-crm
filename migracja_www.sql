-- ============================================================
-- MIGRACJA: dodanie osobnej kolumny "www" (strona internetowa firmy)
-- Uruchom w Supabase: Dashboard -> SQL Editor -> New query
-- Bezpieczne do uruchomienia nawet z istniejacymi danymi.
-- ============================================================

alter table public.leady
    add column if not exists www text;

-- Weryfikacja: powinna pojawic sie kolumna "www" na liscie
-- select column_name from information_schema.columns where table_name = 'leady';
