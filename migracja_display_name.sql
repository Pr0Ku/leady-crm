-- ============================================================
-- MIGRACJA: nazwy wyświetlane (display_name) dla użytkowników
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

alter table public.profiles
    add column if not exists display_name text;

-- Zastępujemy poprzednią politykę "update" tak, żeby oprócz właściciela
-- profilu mógł go też edytować admin (potrzebne do ustawiania nazw
-- wyświetlanych innym userom).
drop policy if exists "Kazdy aktualizuje tylko wlasny profil - update" on public.profiles;

create policy "Wlasny profil lub admin - update"
    on public.profiles for update
    to authenticated
    using (
        email = auth.jwt() ->> 'email'
        or auth.jwt() ->> 'email' = 'janasmaciej@wp.pl'
    )
    with check (
        email = auth.jwt() ->> 'email'
        or auth.jwt() ->> 'email' = 'janasmaciej@wp.pl'
    );
