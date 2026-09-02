-- ============================================================
-- MIGRACJA: sledzenie przeczytanych odpowiedzi pod zgloszeniami
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

create table if not exists public.zgloszenia_przeczytane (
    zgloszenie_id uuid not null references public.zgloszenia(id) on delete cascade,
    user_email text not null,
    ostatnio_widziane_o timestamptz not null default now(),
    primary key (zgloszenie_id, user_email)
);

alter table public.zgloszenia_przeczytane enable row level security;

-- Kazdy widzi/aktualizuje TYLKO wlasne znaczniki "przeczytane" (to jest
-- prywatna informacja per-user, nie ma potrzeby zeby ktos inny to widzial).
create policy "Wlasne oznaczenia przeczytania - odczyt"
    on public.zgloszenia_przeczytane for select
    to authenticated
    using (user_email = auth.jwt() ->> 'email');

create policy "Wlasne oznaczenia przeczytania - insert"
    on public.zgloszenia_przeczytane for insert
    to authenticated
    with check (user_email = auth.jwt() ->> 'email');

create policy "Wlasne oznaczenia przeczytania - update"
    on public.zgloszenia_przeczytane for update
    to authenticated
    using (user_email = auth.jwt() ->> 'email')
    with check (user_email = auth.jwt() ->> 'email');
