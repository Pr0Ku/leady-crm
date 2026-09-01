-- ============================================================
-- SCHEMAT BAZY: Leady CRM
-- Uruchom to w Supabase: Dashboard -> SQL Editor -> New query
-- -> wklej całość -> Run
-- ============================================================

-- Tabela leadów (firm)
create table if not exists public.leady (
    id uuid primary key default gen_random_uuid(),
    nazwa_firmy text not null,
    nip text,
    lokalizacja text,          -- miasto / województwo
    adres text,
    telefon text,
    email text,
    osoba_kontaktowa text,      -- imię i nazwisko
    zrodlo text,                 -- np. 'Google Places', 'CEIDG', 'ręcznie'
    www text,                    -- strona internetowa firmy
    google_place_id text,        -- unikalny ID z Google Places, do wykrywania duplikatow przy imporcie
    status text not null default 'nowy'
        check (status in ('nowy', 'mail_wyslany', 'zainteresowany', 'niezainteresowany', 'do_zadzwonienia', 'zamkniete')),
    przypisane_do text,          -- email osoby odpowiedzialnej za dalszy kontakt
    wielkosc_floty integer,      -- liczba pojazdow klienta (do priorytetyzacji leadow)
    termin_kontaktu date,        -- kiedy trzeba nastepnym razem sie odezwac
    notatki text,
    numer_klienta text unique,   -- np. 'C0001', nadawany automatycznie przy konwersji na klienta
    klientem_od timestamptz,     -- kiedy lead zostal oznaczony jako klient
    data_konca_kontraktu date,   -- opcjonalna data konca umowy/abonamentu
    utworzono_przez uuid references auth.users(id),
    utworzono_o timestamptz not null default now(),
    zaktualizowano_o timestamptz not null default now()
);

-- Indeksy pod filtrowanie/wyszukiwanie
create index if not exists idx_leady_status on public.leady(status);

-- Unikalne ograniczenie (constraint, nie partial index!) na google_place_id.
-- Postgres pozwala na wiele wartosci NULL nawet przy zwyklym UNIQUE, wiec
-- rekordy bez google_place_id (dodane recznie / z CEIDG) nie sa tym objete.
-- WAZNE: zwykly UNIQUE constraint (a nie partial unique index) jest wymagany,
-- zeby mechanizm upsert (ON CONFLICT) w Supabase poprawnie go rozpoznawal.
alter table public.leady
    add constraint leady_google_place_id_key unique (google_place_id);
create index if not exists idx_leady_nip on public.leady(nip);
create index if not exists idx_leady_nazwa on public.leady using gin (to_tsvector('simple', nazwa_firmy));

-- Automatyczna aktualizacja znacznika czasu przy edycji rekordu
create or replace function public.set_zaktualizowano_o()
returns trigger as $$
begin
    new.zaktualizowano_o = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leady_zaktualizowano on public.leady;
create trigger trg_leady_zaktualizowano
    before update on public.leady
    for each row
    execute function public.set_zaktualizowano_o();

-- ============================================================
-- ROW LEVEL SECURITY - serce zabezpieczeń
-- ============================================================

alter table public.leady enable row level security;

-- Każdy ZALOGOWANY użytkownik (i tylko zalogowany) może CZYTAĆ wszystkie leady.
-- Nie ma żadnego dostępu anonimowego - to jest kluczowe.
create policy "Zalogowani moga czytac leady"
    on public.leady for select
    to authenticated
    using (true);

-- Każdy zalogowany może DODAWAĆ nowe leady.
create policy "Zalogowani moga dodawac leady"
    on public.leady for insert
    to authenticated
    with check (true);

-- Każdy zalogowany może EDYTOWAĆ leady (np. zmieniać status, notatki).
create policy "Zalogowani moga edytowac leady"
    on public.leady for update
    to authenticated
    using (true)
    with check (true);

-- Usuwanie leadów - celowo ZABRONIONE dla wszystkich przez appkę.
-- Jeśli będziesz chciał kiedyś to zmienić, dodaj analogiczną politykę "for delete".
-- Na razie: usuwanie tylko ręcznie przez Ciebie w panelu Supabase (Table Editor),
-- żeby nikt przez pomyłkę nie skasował całej bazy z poziomu appki.

-- ============================================================
-- ZAKŁADKA "KLIENCI" - numeracja, konwersja leada w klienta, notatki
-- ============================================================

create sequence if not exists public.klient_numer_seq start 1;

-- Bezpiecznie (bez wyścigu przy równoczesnych kliknięciach) nadaje kolejny
-- numer klienta w formacie C0001, C0002... i ustawia datę konwersji.
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

-- Wątek notatek klienta - każdy wpis to osobny rekord z autorem, wpisy się
-- nie nadpisują (inaczej niż pole "notatki" dla leadów).
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

-- ============================================================
-- Weryfikacja: sprawdź czy RLS jest włączone (powinno zwrócić "t")
-- ============================================================
-- select relrowsecurity from pg_class where relname = 'leady';
