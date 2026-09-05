-- ============================================================
-- MIGRACJA: wlacz Supabase Realtime (natychmiastowe powiadomienia
-- o zmianach, bez odswiezania strony) dla calej appki.
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

alter publication supabase_realtime add table public.leady;
alter publication supabase_realtime add table public.zgloszenia;
alter publication supabase_realtime add table public.zgloszenia_komentarze;
alter publication supabase_realtime add table public.notatki_leada;
alter publication supabase_realtime add table public.notatki_klienta;
alter publication supabase_realtime add table public.dziennik_polaczen;
alter publication supabase_realtime add table public.wyslane_maile;
alter publication supabase_realtime add table public.czat_ogolny;
alter publication supabase_realtime add table public.profiles;
