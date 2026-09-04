-- ============================================================
-- MIGRACJA: dziennik połączeń (strona szczegółów pojedynczego rekordu)
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

create table if not exists public.dziennik_polaczen (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leady(id) on delete cascade,
    autor text,
    wynik text not null check (wynik in (
        'brak_odbioru', 'zainteresowany', 'niezainteresowany',
        'oddzwonic', 'zly_numer', 'inne'
    )),
    komentarz text,
    utworzono_o timestamptz not null default now()
);

create index if not exists idx_dziennik_polaczen_lead_id on public.dziennik_polaczen(lead_id);

alter table public.dziennik_polaczen enable row level security;

-- Wspolna, zespolowa historia polaczen (jak notatki) - kazdy zalogowany
-- widzi i dodaje wpisy, bez rozroznienia lead/klient.
create policy "Zalogowani moga czytac dziennik polaczen"
    on public.dziennik_polaczen for select
    to authenticated
    using (true);

create policy "Zalogowani moga dodawac do dziennika polaczen"
    on public.dziennik_polaczen for insert
    to authenticated
    with check (true);
