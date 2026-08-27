-- ============================================================
-- MIGRACJA: dodanie kolumny google_place_id + ochrona przed duplikatami
-- Uruchom w Supabase: Dashboard -> SQL Editor -> New query
-- Bezpieczne do uruchomienia nawet z istniejacymi danymi.
-- ============================================================

alter table public.leady
    add column if not exists google_place_id text;

-- Unikalny indeks: ta sama firma z Google (to samo google_place_id) nie
-- zostanie wstawiona drugi raz. Rekordy bez google_place_id (NULL) - np.
-- dodane recznie albo z CEIDG - nie sa tym objete, moze ich byc dowolnie wiele.
create unique index if not exists idx_leady_google_place_id_unique
    on public.leady(google_place_id)
    where google_place_id is not null;

-- Weryfikacja: powinna pojawic sie kolumna "google_place_id" na liscie
-- select column_name from information_schema.columns where table_name = 'leady';
