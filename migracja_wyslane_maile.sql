-- ============================================================
-- MIGRACJA: log wysłanych maili (widoczny na stronie szczegółów)
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

create table if not exists public.wyslane_maile (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leady(id) on delete cascade,
    jezyk text not null check (jezyk in ('pl', 'en', 'de')),
    adres_docelowy text not null,
    autor text,
    wyslano_o timestamptz not null default now()
);

create index if not exists idx_wyslane_maile_lead_id on public.wyslane_maile(lead_id);

alter table public.wyslane_maile enable row level security;

create policy "Zalogowani moga czytac log wyslanych maili"
    on public.wyslane_maile for select
    to authenticated
    using (true);

create policy "Zalogowani moga dodawac wpisy do logu maili"
    on public.wyslane_maile for insert
    to authenticated
    with check (true);
