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
    status text not null default 'nowy'
        check (status in ('nowy', 'mail_wyslany', 'zainteresowany', 'niezainteresowany', 'do_zadzwonienia', 'zamkniete')),
    przypisane_do text,          -- email osoby odpowiedzialnej za dalszy kontakt
    notatki text,
    utworzono_przez uuid references auth.users(id),
    utworzono_o timestamptz not null default now(),
    zaktualizowano_o timestamptz not null default now()
);

-- Indeksy pod filtrowanie/wyszukiwanie
create index if not exists idx_leady_status on public.leady(status);
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
-- Weryfikacja: sprawdź czy RLS jest włączone (powinno zwrócić "t")
-- ============================================================
-- select relrowsecurity from pg_class where relname = 'leady';
