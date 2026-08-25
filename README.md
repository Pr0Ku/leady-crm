# Leady CRM — instrukcja wdrożenia

Prosty, darmowy panel do zarządzania leadami: firma, NIP, lokalizacja, telefon,
e-mail, osoba kontaktowa, status kontaktu. Logowanie linkiem mailowym (bez haseł),
dostęp tylko dla zaproszonych osób. Dane w Supabase (Postgres), strona hostowana
na GitHub Pages. Koszt: 0 zł.

---

## Krok 1: Załóż projekt w Supabase

1. Wejdź na https://supabase.com i załóż darmowe konto.
2. **New project** → wybierz nazwę (np. `leady-crm`), region **Frankfurt (eu-central-1)**
   (najbliżej Polski = najniższe opóźnienia), ustaw hasło do bazy (zapisz je w menedżerze haseł — nie będzie
   nigdzie indziej potrzebne, ale dobrze je mieć).
3. Poczekaj ok. 2 minuty aż projekt się utworzy.

## Krok 2: Wgraj schemat bazy danych

1. W panelu projektu wejdź w **SQL Editor** (ikona w lewym menu) → **New query**.
2. Otwórz plik `schema.sql` z tego folderu, skopiuj całą zawartość, wklej do edytora.
3. Kliknij **Run**. Powinieneś zobaczyć „Success. No rows returned”.
4. To utworzyło tabelę `leady` **z włączonym Row Level Security** — od tego momentu
   dane są dostępne wyłącznie dla zalogowanych, zweryfikowanych użytkowników.

## Krok 3: Skonfiguruj logowanie (magic link, bez haseł)

1. W panelu: **Authentication → Providers** → upewnij się, że **Email** jest włączony.
2. **Authentication → Providers → Email** → **WYŁĄCZ** opcję "Allow new users to sign up".
   To jest ważne: bez tego ktokolwiek mógłby sam się "zarejestrować" mailem.
   Wyłączenie tej opcji oznacza, że logowanie zadziała TYLKO dla kont, które
   Ty ręcznie dodasz (patrz Krok 4).
3. **Authentication → URL Configuration** → w polu **Site URL** wpisz docelowy
   adres Twojej strony GitHub Pages, np. `https://twoj-login.github.io/leady-crm/`
   (dokładny adres poznasz w Kroku 6 — możesz do tego wrócić i zaktualizować).
   Dodaj ten sam adres też w **Redirect URLs**.

## Krok 4: Dodaj konta dla siebie i kolegi

1. **Authentication → Users** → **Add user** → **Send invitation**.
2. Wpisz adres e-mail kolegi (i swój, jeśli chcesz też zaprosić się przez tę ścieżkę).
3. Osoba dostanie maila z linkiem — po kliknięciu jej konto jest aktywne.
4. To jedyny sposób na uzyskanie dostępu — nie ma nigdzie w appce formularza rejestracji.

## Krok 5: Pobierz dane połączenia

1. **Project Settings** (ikona koła zębatego) → **API**.
2. Skopiuj **Project URL** oraz klucz **anon public**.
3. Otwórz plik `config.js` w tym folderze i wklej te dwie wartości:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...";
   ```
4. **NIE kopiuj** klucza `service_role` (jest niżej na tej samej stronie) —
   ten nigdzie w tym projekcie nie jest używany i nie powinien nigdy trafić
   do publicznego repozytorium.

## Krok 6: Wystaw stronę na GitHub Pages

1. Załóż nowe **prywatne lub publiczne** repozytorium na GitHub (np. `leady-crm`).
   Uwaga: GitHub Pages za darmo działa też dla repo prywatnych na kontach z Pro,
   ale najprościej i bez ograniczeń — zrób repo **publiczne**. To bezpieczne:
   jedyny "sekret" w kodzie to `anon key`, który z założenia jest publiczny
   (patrz komentarz w `config.js`).
2. Wgraj do repo całą zawartość tego folderu (`index.html`, `style.css`, `app.js`,
   `config.js`, `schema.sql`, folder `.github`).
3. W repo: **Settings → Pages** → w sekcji **Source** wybierz branch `main`,
   folder `/ (root)` → **Save**.
4. Po chwili GitHub poda adres strony, np. `https://twoj-login.github.io/leady-crm/`.
5. **Wróć do Kroku 3** i upewnij się, że dokładnie ten adres jest wpisany
   w Supabase jako Site URL / Redirect URL (z końcowym `/`).

## Krok 7: Włącz budzik (żeby projekt Supabase nigdy nie zasnął)

1. W repo na GitHubie: **Settings → Secrets and variables → Actions → New repository secret**.
2. Dodaj dwa sekrety:
   - `SUPABASE_URL` — ten sam adres co w `config.js`
   - `SUPABASE_ANON_KEY` — ten sam klucz co w `config.js`
3. Workflow z pliku `.github/workflows/keepalive.yml` uruchomi się automatycznie
   co 3 dni. Możesz też odpalić go ręcznie: zakładka **Actions** → **Supabase keep-alive** → **Run workflow**.

## Krok 8: Gotowe — zaimportuj pierwsze leady

1. Wejdź na adres swojej strony, zaloguj się linkiem mailowym.
2. Uruchom `google_places_leady.py` (osobny skrypt) → dostaniesz plik CSV.
3. W appce kliknij **Importuj CSV** i wskaż ten plik — firmy automatycznie
   wpadną do wspólnej bazy ze statusem "Nowy".
4. Ty i kolega widzicie te same dane, każdy może zmieniać status (Nowy →
   Mail wysłany → Zainteresowany → Do zadzwonienia → Zamknięte) i dodawać notatki.

---

## Bezpieczeństwo — co dokładnie chroni dane

- **Brak rejestracji** — jedyna droga do konta to ręczne zaproszenie przez Ciebie w Supabase.
- **Row Level Security** — silnik bazy danych odrzuca każde zapytanie o dane,
  które nie pochodzi od zalogowanego użytkownika. Nie da się tego obejść
  z poziomu przeglądarki, niezależnie od tego co ktoś wpisze w konsoli.
- **Logowanie magic-link** — nie ma haseł do złamania/wycieku. Link jest
  jednorazowy i wygasa po 60 minutach.
- **Klucz `anon` w kodzie jest bezpieczny** — to zamierzone działanie Supabase,
  nie błąd konfiguracji. Prawdziwy sekret (`service_role`) nigdy nie występuje
  w tym projekcie.
- Warto dodatkowo włączyć w **Authentication → Policies**: rate limiting
  logowań (domyślnie już włączony) i ewentualnie 2FA dla swojego konta
  (Authentication → swój user → wymuszenie MFA), jeśli chcesz podnieść
  poprzeczkę jeszcze wyżej.

## Rozbudowa na przyszłość (gdybyście chcieli)

- Dodanie kolumny "data ostatniego kontaktu" + automatyczne przypomnienia.
- Eksport listy "do zadzwonienia dziś" do PDF/CSV dla kolegi.
- Integracja z automatyczną wysyłką maili (np. przez Zapier/Make łączące
  Supabase z Gmailem) — to już wymaga trochę więcej pracy i wykracza poza
  darmowy zakres, ale jest możliwe.
