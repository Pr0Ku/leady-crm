-- ============================================================
-- MIGRACJA: numer leada (format L0001, L0002...) - automatycznie
-- nadawany KAŻDEMU nowemu leadowi (recznie dodanemu i z importu CSV),
-- niezaleznie od tego jak trafil do bazy.
-- Uruchom w Supabase SQL Editor -> leady-crm-test.
-- ============================================================

alter table public.leady
    add column if not exists numer_leada text unique;

create sequence if not exists public.lead_numer_seq start 1;

-- Trigger: przy KAZDYM nowym leadzie (jesli numer_leada jeszcze nie
-- ustawiony) automatycznie nadaj kolejny numer z sekwencji.
create or replace function public.przypisz_numer_leada()
returns trigger
language plpgsql
as $$
begin
  if new.numer_leada is null then
    new.numer_leada := 'L' || lpad(nextval('lead_numer_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_przypisz_numer_leada on public.leady;

create trigger trg_przypisz_numer_leada
    before insert on public.leady
    for each row
    execute function public.przypisz_numer_leada();

-- Nadaj numery istniejacym juz leadom (ktore powstaly zanim ten
-- mechanizm zaczal dzialac), w kolejnosci dodania do bazy.
with numerowane as (
    select id, 'L' || lpad(
        row_number() over (order by utworzono_o)::text, 4, '0'
    ) as nowy_numer
    from public.leady
    where numer_leada is null
)
update public.leady l
set numer_leada = n.nowy_numer
from numerowane n
where l.id = n.id;

-- Przesun sekwencje za ostatni juz uzyty numer, zeby kolejne nowe
-- leady nie dostaly zduplikowanego numeru.
select setval(
    'lead_numer_seq',
    coalesce((select count(*) from public.leady where numer_leada is not null), 0)
);
