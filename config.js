// ============================================================
// KONFIGURACJA POŁĄCZENIA Z SUPABASE
// ============================================================
// TO JEST WERSJA DLA ŚRODOWISKA TESTOWEGO (branch staging).
// Wskazuje na osobny, testowy projekt Supabase (leady-crm-test),
// całkowicie odizolowany od prawdziwych danych produkcyjnych.
//
// UWAGA: "Publishable key" JEST BEZPIECZNY do umieszczenia tutaj
// i wrzucenia do publicznego repozytorium GitHub. Supabase projektuje
// ten klucz jako publiczny z założenia - realną ochronę danych
// zapewnia Row Level Security (RLS) ustawione w schema.sql, nie
// tajność tego klucza.
//
// NIGDY nie wklejaj tutaj "Secret key" - to byłby błąd
// bezpieczeństwa dający pełny dostęp do bazy z pominięciem RLS.
// ============================================================

const SUPABASE_URL = "https://wyyuhxrczflpkzybxdqk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cMN9TlutYCfXGWybP34-0g_gqp1_a3f";
