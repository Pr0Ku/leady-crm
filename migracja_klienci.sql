-- ============================================================
-- MIGRACJA: obsluga zakladki "Klienci"
-- Uruchom w Supabase: Dashboard -> SQL Editor -> New query -> wklej calosc -> Run
-- Najpierw na leady-crm-test, potem (po potwierdzeniu) na produkcyjnej leady-crm.
-- ============================================================

-- 1. Nowe kolumny w tabeli leady
alter table public.leady
    add column if not exists numer_klienta text unique,
    add column if not exists klientem_od timestamptz,
    add column if not exists data_konca_kontraktu date;

-- 2. Sekwencja do numeracji klientow (format C0001, C0002, ...)
create sequence if not exists public.klient_numer_seq start 1;

-- 3. Funkcja bezpiecznie nadajaca kolejny numer klienta i znacznik czasu.
--    SECURITY DEFINER + nextval() w jednym kroku eliminuje ryzyko wyscigu
--    (dwoch userow klikajacych "Oznacz jako klienta" w tym samym momencie).
create or replace function public.oznacz_jako_klienta(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nowy_numer text;
begin
  select 'C' || lpad(nextval('klient_numer_seq')::text, 4, '0') into nowy_numer;

  update public.leady
  set numer_klienta = nowy_numer,
      klientem_od = now()
  where id = p_id
    and numer_klienta is null;

  return nowy_numer;
end;
$$;

grant execute on function public.oznacz_jako_klienta(uuid) to authenticated;

-- 4. Tabela notatek klienta - watek wpisow z autorem (kazdy wpis to osobny
--    rekord, wpisy sie nie nadpisuja).
create table if not exists public.notatki_klienta (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leady(id) on delete cascade,
    autor text,
    tresc text not null,
    utworzono_o timestamptz not null default now()
);

create index if not exists idx_notatki_klienta_lead_id on public.notatki_klienta(lead_id);

alter table public.notatki_klienta enable row level security;

create policy "Zalogowani moga czytac notatki klienta"
    on public.notatki_klienta for select
    to authenticated
    using (true);

create policy "Zalogowani moga dodawac notatki klienta"
    on public.notatki_klienta for insert
    to authenticated
    with check (true);

-- Usuwanie/edycja notatek celowo zablokowane z poziomu appki - wpis raz
-- dodany zostaje, tak samo jak w prawdziwym watku/logu.

-- ============================================================
-- Weryfikacja po uruchomieniu:
-- select numer_klienta, klientem_od, data_konca_kontraktu from public.leady limit 5;
-- select * from public.notatki_klienta limit 5;
-- ============================================================
