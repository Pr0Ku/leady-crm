// ============================================================
// KONFIGURACJA POŁĄCZENIA Z SUPABASE
// ============================================================
// Wklej tu dane ze swojego projektu Supabase:
// Dashboard -> Project Settings -> API
//
// UWAGA: "anon public key" JEST BEZPIECZNY do umieszczenia tutaj
// i wrzucenia do publicznego repozytorium GitHub. Supabase projektuje
// ten klucz jako publiczny z założenia - realną ochronę danych
// zapewnia Row Level Security (RLS) ustawione w schema.sql, nie
// tajność tego klucza.
//
// NIGDY nie wklejaj tutaj "service_role key" - to byłby błąd
// bezpieczeństwa dający pełny dostęp do bazy z pominięciem RLS.
// ============================================================

const SUPABASE_URL = "https://oeijelhshkdpbsjldkcp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gMtnPqaVbUZ2YsBt4UA3qA_cfnc8nVK";
