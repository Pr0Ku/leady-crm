-- ============================================================
-- MIGRACJA: czat ogólny (widoczny dla wszystkich) + statusy online
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

-- Czat ogólny - jeden wspólny wątek, widoczny dla każdego zalogowanego.
create table if not exists public.czat_ogolny (
    id uuid primary key default gen_random_uuid(),
    autor text not null,
    tresc text not null,
    utworzono_o timestamptz not null default now()
);

alter table public.czat_ogolny enable row level security;

create policy "Kazdy zalogowany widzi czat ogolny"
    on public.czat_ogolny for select
    to authenticated
    using (true);

create policy "Kazdy zalogowany moze pisac na czacie ogolnym"
    on public.czat_ogolny for insert
    to authenticated
    with check (autor = auth.jwt() ->> 'email');

-- Profile / statusy online. Status ("Aktywny"/"Zaraz wracam"/"Nieaktywny")
-- jest WYLICZANY po stronie appki na podstawie tych dwoch znacznikow
-- czasu - nikt go nie ustawia recznie:
--   last_active = aktualizowany, gdy karta appki jest widoczna i byla
--                 jakas aktywnosc (ruch myszka/klik) w ostatnich 10 min
--   last_seen    = aktualizowany co ok. 60s, dopoki karta appki jest
--                 w ogole otwarta (nawet w tle) - po jej zamknieciu
--                 przestaje sie aktualizowac, wiec appka wie "ostatnio
--                 widziany: X temu"
create table if not exists public.profiles (
    email text primary key,
    last_active timestamptz not null default now(),
    last_seen timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Kazdy zalogowany widzi liste userow"
    on public.profiles for select
    to authenticated
    using (true);

create policy "Kazdy aktualizuje tylko wlasny profil - insert"
    on public.profiles for insert
    to authenticated
    with check (email = auth.jwt() ->> 'email');

create policy "Kazdy aktualizuje tylko wlasny profil - update"
    on public.profiles for update
    to authenticated
    using (email = auth.jwt() ->> 'email')
    with check (email = auth.jwt() ->> 'email');
