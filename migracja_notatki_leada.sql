-- ============================================================
-- MIGRACJA: wątek notatek dla leadów (analogicznie do notatki_klienta)
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

create table if not exists public.notatki_leada (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leady(id) on delete cascade,
    autor text,
    tresc text not null,
    utworzono_o timestamptz not null default now()
);

create index if not exists idx_notatki_leada_lead_id on public.notatki_leada(lead_id);

alter table public.notatki_leada enable row level security;

create policy "Zalogowani moga czytac notatki leada"
    on public.notatki_leada for select
    to authenticated
    using (true);

create policy "Zalogowani moga dodawac notatki leada"
    on public.notatki_leada for insert
    to authenticated
    with check (true);
