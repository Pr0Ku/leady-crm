// ============================================================
// Cloudflare Worker: zaplecze appki Leady CRM.
//
// Obsługuje jeden endpoint API (/api/send-email), który bezpiecznie
// wysyła maile przez Resend, korzystając z klucza zaszytego jako
// sekret Cloudflare (nigdy widoczny dla przeglądarki/użytkownika).
// Wszystkie inne żądania (cała reszta appki) trafiają normalnie do
// statycznych plików, tak jak dotychczas.
// ============================================================

// Tylko z tego adresu appka może wołać endpoint wysyłki (nie z
// dowolnej, obcej strony w internecie).
const DOZWOLONE_ORIGIN = "https://leady-crm.janasmaciej.workers.dev";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/send-email" && request.method === "POST") {
      return obslugaWyslijMail(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function obslugaWyslijMail(request, env) {
  const cors = {
    "Access-Control-Allow-Origin": DOZWOLONE_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // 1. Sprawdź, czy żądanie przychodzi od faktycznie zalogowanego
  //    użytkownika appki (weryfikacja tokenu Supabase) - bez tego
  //    ktokolwiek znający adres tego Workera mógłby wysyłać maile
  //    w Twoim imieniu.
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return jsonError("Brak autoryzacji.", 401, cors);
  }

  const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!userResp.ok) {
    return jsonError("Nieprawidłowa sesja - zaloguj się ponownie.", 401, cors);
  }

  const user = await userResp.json();

  // 2. Odczytaj dane maila z żądania appki.
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Nieprawidłowe dane żądania.", 400, cors);
  }

  const { to, subject, html, replyTo } = body;

  if (!to || !subject || !html) {
    return jsonError("Brakuje pola: to, subject lub html.", 400, cors);
  }

  // 3. Zabezpieczenie przed nadużyciem endpointu do wysyłki maili do
  //    DOWOLNEGO adresu (nie tylko leadów w bazie) - sprawdź, że
  //    podany adres faktycznie należy do jakiegoś rekordu w tabeli
  //    "leady", zanim cokolwiek wyślemy. Zapytanie idzie z tokenem
  //    tego samego użytkownika, więc respektuje te same reguły RLS
  //    co appka.
  const sprawdzResp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/leady?select=id&email=eq.${encodeURIComponent(to)}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    }
  );
  const sprawdzDane = await sprawdzResp.json();

  if (!sprawdzResp.ok || !Array.isArray(sprawdzDane) || sprawdzDane.length === 0) {
    return jsonError("Ten adres nie odpowiada żadnemu leadowi/klientowi w bazie.", 403, cors);
  }

  // 4. Wyślij przez Resend.
  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Maciej Janas <maciej@servfleet.com>",
      to: [to],
      subject,
      html,
      reply_to: replyTo || "maciej@servfleet.com",
    }),
  });

  const resendData = await resendResp.json();

  if (!resendResp.ok) {
    return jsonError(
      "Resend odrzucił wysyłkę: " + (resendData.message || JSON.stringify(resendData)),
      resendResp.status,
      cors
    );
  }

  return new Response(
    JSON.stringify({ success: true, id: resendData.id, wyslanePrzez: user.email }),
    { status: 200, headers: { "Content-Type": "application/json", ...cors } }
  );
}

function jsonError(message, status, cors) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
