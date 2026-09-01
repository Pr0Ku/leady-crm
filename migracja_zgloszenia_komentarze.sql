-- ============================================================
-- MIGRACJA: komentarze/odpowiedzi do zgłoszeń
-- Uruchom w Supabase SQL Editor -> leady-crm-test (po migracja_zgloszenia.sql).
-- ============================================================

create table if not exists public.zgloszenia_komentarze (
    id uuid primary key default gen_random_uuid(),
    zgloszenie_id uuid not null references public.zgloszenia(id) on delete cascade,
    autor text not null,
    tresc text not null,
    utworzono_o timestamptz not null default now()
);

create index if not exists idx_zgloszenia_komentarze_zgloszenie_id
    on public.zgloszenia_komentarze(zgloszenie_id);

alter table public.zgloszenia_komentarze enable row level security;

-- Widoczność komentarza = widoczność zgłoszenia, którego dotyczy
-- (czyli: jego autor, albo admin).
create policy "Komentarze widoczne jak zgloszenie nadrzedne"
    on public.zgloszenia_komentarze for select
    to authenticated
    using (
        exists (
            select 1 from public.zgloszenia z
            where z.id = zgloszenia_komentarze.zgloszenie_id
              and (z.autor = auth.jwt() ->> 'email'
                   or auth.jwt() ->> 'email' = 'janasmaciej@wp.pl')
        )
    );

-- Dodawanie komentarza: tylko jeśli widzisz zgłoszenie nadrzędne,
-- i tylko jako siebie.
create policy "Dodawanie komentarzy do widocznych zgloszen"
    on public.zgloszenia_komentarze for insert
    to authenticated
    with check (
        autor = auth.jwt() ->> 'email'
        and exists (
            select 1 from public.zgloszenia z
            where z.id = zgloszenia_komentarze.zgloszenie_id
              and (z.autor = auth.jwt() ->> 'email'
                   or auth.jwt() ->> 'email' = 'janasmaciej@wp.pl')
        )
    );
