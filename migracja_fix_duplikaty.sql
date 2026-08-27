-- ============================================================
-- MIGRACJA (POPRAWKA): napraw ochrone przed duplikatami
-- ============================================================
-- Poprzednia migracja (migracja_google_place_id.sql) utworzyla "partial
-- unique index" (z warunkiem WHERE ... IS NOT NULL). Okazalo sie, ze
-- mechanizm upsert w Supabase nie rozpoznaje takiego indeksu jako
-- poprawnego celu dla ON CONFLICT, przez co duplikaty i tak przechodzily.
--
-- Ta migracja usuwa stary, wadliwy indeks i zastepuje go zwyklym
-- ograniczeniem UNIQUE, ktore dziala identycznie (Postgres i tak pozwala
-- na wiele wartosci NULL przy zwyklym UNIQUE), ale jest poprawnie
-- rozpoznawane przez upsert.
--
-- Uruchom w Supabase: Dashboard -> SQL Editor -> New query
-- ============================================================

drop index if exists public.idx_leady_google_place_id_unique;

alter table public.leady
    add constraint leady_google_place_id_key unique (google_place_id);

-- Weryfikacja: powinno pokazac nowe ograniczenie
-- select conname from pg_constraint where conname = 'leady_google_place_id_key';
