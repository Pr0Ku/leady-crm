-- ============================================================
-- MIGRACJA: zakładka "Zgłoszenia" (feedback od testerów)
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- UWAGA: ta funkcja jest celowo TYLKO na środowisku testowym - nie
-- uruchamiać tej migracji na bazie produkcyjnej (na razie).
-- ============================================================

create table if not exists public.zgloszenia (
    id uuid primary key default gen_random_uuid(),
    typ text not null check (typ in ('blad', 'pomysl', 'inne')),
    tresc text not null,
    autor text not null,
    status text not null default 'otwarte' check (status in ('otwarte', 'zrobione')),
    utworzono_o timestamptz not null default now()
);

create index if not exists idx_zgloszenia_autor on public.zgloszenia(autor);

alter table public.zgloszenia enable row level security;

-- Widoczność: zwykły user widzi TYLKO swoje zgłoszenia; admin
-- (janasmaciej@wp.pl) widzi wszystkie.
create policy "Wlasne zgloszenia lub admin - odczyt"
    on public.zgloszenia for select
    to authenticated
    using (
        autor = auth.jwt() ->> 'email'
        or auth.jwt() ->> 'email' = 'janasmaciej@wp.pl'
    );

-- Dodawanie: każdy zalogowany może dodać zgłoszenie, ale tylko jako
-- SIEBIE (nie może podszyć się pod innego autora).
create policy "Dodawanie wlasnych zgloszen"
    on public.zgloszenia for insert
    to authenticated
    with check (autor = auth.jwt() ->> 'email');

-- Zmiana statusu (np. oznaczenie "zrobione"): autor swojego zgłoszenia
-- albo admin, dla dowolnego.
create policy "Wlasne zgloszenia lub admin - aktualizacja"
    on public.zgloszenia for update
    to authenticated
    using (
        autor = auth.jwt() ->> 'email'
        or auth.jwt() ->> 'email' = 'janasmaciej@wp.pl'
    )
    with check (
        autor = auth.jwt() ->> 'email'
        or auth.jwt() ->> 'email' = 'janasmaciej@wp.pl'
    );
