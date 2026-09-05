// ============================================================
// LEADY CRM - logika aplikacji
// ============================================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUS_LABELS = {
  nowy: "Nowy",
  mail_wyslany: "Mail wysłany",
  zainteresowany: "Zainteresowany",
  niezainteresowany: "Niezainteresowany",
  do_zadzwonienia: "Do zadzwonienia",
  zamkniete: "Zamknięte",
};

let currentLeady = [];
let currentTab = "leady";
let notatkiCache = {};
let currentUserEmail = null;
let profilesByEmail = {};
const ADMIN_EMAIL = "janasmaciej@wp.pl";

function nazwaDla(email) {
  return (profilesByEmail[email] && profilesByEmail[email].trim()) || email;
}

function otworzWOknie(url) {
  otworzOknoWMniejszymRozmiarze(url, 1000, 850);
}

function otworzOknoWMniejszymRozmiarze(url, szerokosc, wysokosc) {
  const lewo = window.screenX + (window.outerWidth - szerokosc) / 2;
  const gora = window.screenY + (window.outerHeight - wysokosc) / 2;
  window.open(
    url,
    "_blank",
    `width=${szerokosc},height=${wysokosc},left=${lewo},top=${gora},resizable=yes,scrollbars=yes`
  );
}

// -------------------- ELEMENTY DOM --------------------
const loginScreen = document.getElementById("login-screen");
const setPasswordScreen = document.getElementById("set-password-screen");
const appScreen = document.getElementById("app-screen");
const detailScreen = document.getElementById("detail-screen");
const sendMailScreen = document.getElementById("send-mail-screen");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const loginBtn = document.getElementById("login-btn");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const fieldFilters = document.getElementById("field-filters");
const filterToggleBtn = document.getElementById("filter-toggle-btn");
const filterPanel = document.getElementById("filter-panel");
const filterCountBadge = document.getElementById("filter-count-badge");
const filterMaEmail = document.getElementById("filter-ma-email");
const filterMaTelefon = document.getElementById("filter-ma-telefon");
const filterMaWww = document.getElementById("filter-ma-www");
const resultsCount = document.getElementById("results-count");
const tbody = document.getElementById("leady-tbody");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const statsRow = document.getElementById("stats-row");

const addLeadBtn = document.getElementById("add-lead-btn");
const importCsvBtn = document.getElementById("import-csv-btn");
const csvInput = document.getElementById("csv-input");

const viewLeady = document.getElementById("view-leady");
const viewKlienci = document.getElementById("view-klienci");
const viewZgloszenia = document.getElementById("view-zgloszenia");
const klienciTbody = document.getElementById("klienci-tbody");
const emptyStateKlienci = document.getElementById("empty-state-klienci");

const modal = document.getElementById("lead-modal");
const modalTitle = document.getElementById("modal-title");
const leadForm = document.getElementById("lead-form");
const modalCancel = document.getElementById("modal-cancel");

const toast = document.getElementById("toast");
const newVersionBanner = document.getElementById("new-version-banner");
const newVersionRefreshBtn = document.getElementById("new-version-refresh");

const zglTabBadge = document.getElementById("zgl-tab-badge");
const zglFilterStatus = document.getElementById("zgl-filter-status");
const zglFilterTyp = document.getElementById("zgl-filter-typ");
const zglFilterAutor = document.getElementById("zgl-filter-autor");
const zglNewBtn = document.getElementById("zgl-new-btn");
const zglNewFormWrap = document.getElementById("zgl-new-form-wrap");
const zglNewCancel = document.getElementById("zgl-new-cancel");
const zgloszeniaForm = document.getElementById("zgloszenia-form");
const zgloszeniaTbody = document.getElementById("zgloszenia-tbody");
const zgloszeniaEmpty = document.getElementById("zgloszenia-empty");

const czatToggle = document.getElementById("czat-toggle");
const czatBadge = document.getElementById("czat-badge");
const czatUnreadDot = document.getElementById("czat-unread-dot");
const czatWidget = document.getElementById("czat-widget");
const czatClose = document.getElementById("czat-close");
const czatForm = document.getElementById("czat-form");
const czatList = document.getElementById("czat-list");
const czatRoster = document.getElementById("czat-roster");

// -------------------- POMOCNICZE --------------------
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.toggle("toast-error", isError);
  setTimeout(() => { toast.hidden = true; }, 3500);
}

function escapeHtml(str) {  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function renderWwwCell(url) {
  if (!url) return "—";
  const safeUrl = url.trim();
  // Renderuj link tylko dla bezpiecznych protokołów (http/https) - zapobiega wstrzyknięciu np. javascript:
  if (!/^https?:\/\//i.test(safeUrl)) return escapeHtml(safeUrl);

  let domain = safeUrl;
  try {
    domain = new URL(safeUrl).hostname.replace(/^www\./, "");
  } catch (e) { /* zostaw pelny url jako tekst, jesli parsowanie sie nie uda */ }

  return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(safeUrl)}">${escapeHtml(domain)}</a>`;
}

// -------------------- AUTORYZACJA --------------------

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-input").value.trim();
  const password = document.getElementById("password-input").value;
  loginBtn.disabled = true;
  loginBtn.textContent = "Loguję…";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = "Zaloguj się";

  if (error) {
    loginMessage.hidden = false;
    loginMessage.textContent = "Nie udało się zalogować: " + error.message;
    loginMessage.classList.add("login-message-error");
  } else {
    loginMessage.hidden = true;
  }
});

document.getElementById("forgot-password-btn").addEventListener("click", async () => {
  const email = document.getElementById("email-input").value.trim();
  if (!email) {
    loginMessage.hidden = false;
    loginMessage.textContent = "Najpierw wpisz swój adres e-mail powyżej.";
    loginMessage.classList.add("login-message-error");
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href,
  });

  loginMessage.hidden = false;
  if (error) {
    loginMessage.textContent = "Nie udało się wysłać linku resetu: " + error.message;
    loginMessage.classList.add("login-message-error");
  } else {
    loginMessage.textContent = "Jeśli ten adres jest zarejestrowany, wysłaliśmy link do zresetowania hasła.";
    loginMessage.classList.remove("login-message-error");
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.reload();
});

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    const rekordId = getRekordIdFromUrl();
    const wyslijMailId = getWyslijMailIdFromUrl();
    if (wyslijMailId) {
      showSendMailScreen(session, wyslijMailId);
    } else if (rekordId) {
      showDetailScreen(session, rekordId);
    } else {
      showApp(session);
    }
  } else {
    showLogin();
  }
}

function getRekordIdFromUrl() {
  return new URLSearchParams(window.location.search).get("rekord");
}

function getWyslijMailIdFromUrl() {
  return new URLSearchParams(window.location.search).get("wyslij_mail");
}

function showLogin() {
  loginScreen.hidden = false;
  setPasswordScreen.hidden = true;
  appScreen.hidden = true;
  detailScreen.hidden = true;
  sendMailScreen.hidden = true;
  czatToggle.hidden = true;
  czatWidget.hidden = true;
  stopHeartbeat();
}

function showSetPasswordScreen() {
  loginScreen.hidden = true;
  setPasswordScreen.hidden = false;
  appScreen.hidden = true;
  detailScreen.hidden = true;
  sendMailScreen.hidden = true;
}

function showApp(session) {
  loginScreen.hidden = true;
  setPasswordScreen.hidden = true;
  appScreen.hidden = false;
  detailScreen.hidden = true;
  sendMailScreen.hidden = true;
  userEmailEl.textContent = session.user.email;
  currentUserEmail = session.user.email;
  czatToggle.hidden = false;
  loadLeady();
  loadZgloszenia();
  loadCzat();
  startHeartbeat();
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    showSetPasswordScreen();
  } else if (event === "SIGNED_IN" && session) {
    // Jesli uzytkownik jest w trakcie ustawiania nowego hasla (ekran
    // resetu widoczny), nie przeskakuj od razu do appki - poczekaj az
    // zapisze nowe haslo.
    if (setPasswordScreen.hidden) {
      const rekordId = getRekordIdFromUrl();
      const wyslijMailId = getWyslijMailIdFromUrl();
      if (wyslijMailId) {
        showSendMailScreen(session, wyslijMailId);
      } else if (rekordId) {
        showDetailScreen(session, rekordId);
      } else {
        showApp(session);
      }
    }
  } else if (event === "SIGNED_OUT") {
    showLogin();
  }
});

// -------------------- EKRAN SZCZEGÓŁÓW (nowa karta, 1 rekord) --------------------

async function showDetailScreen(session, rekordId) {
  loginScreen.hidden = true;
  setPasswordScreen.hidden = true;
  appScreen.hidden = true;
  detailScreen.hidden = false;
  sendMailScreen.hidden = true;
  currentUserEmail = session.user.email;

  const { data: rekord, error } = await supabaseClient
    .from("leady")
    .select("*")
    .eq("id", rekordId)
    .single();

  if (error || !rekord) {
    document.getElementById("detail-nazwa").textContent = "Nie znaleziono rekordu.";
    return;
  }

  const jestKlientem = !!rekord.numer_klienta;

  document.title = `${rekord.nazwa_firmy} — Leady`;
  document.getElementById("detail-nazwa").textContent = rekord.nazwa_firmy;
  document.getElementById("detail-lokalizacja").textContent = rekord.lokalizacja || "";

  const badge = document.getElementById("detail-badge");
  badge.textContent = jestKlientem ? `Klient ${rekord.numer_klienta}` : "Lead";
  badge.className = "detail-badge " + (jestKlientem ? "detail-badge-klient" : "detail-badge-lead");

  const pola = [
    ["NIP", rekord.nip],
    ["Telefon", rekord.telefon],
    ["E-mail", rekord.email],
    ["Strona www", rekord.www ? renderWwwCell(rekord.www) : null],
    ["Osoba kontaktowa", rekord.osoba_kontaktowa],
    ["Wielkość floty", rekord.wielkosc_floty != null ? rekord.wielkosc_floty : null],
  ];

  if (jestKlientem) {
    pola.push(
      ["Klientem od", rekord.klientem_od ? new Date(rekord.klientem_od).toLocaleDateString("pl-PL") : null],
      ["Data końca kontraktu", rekord.data_konca_kontraktu ? new Date(rekord.data_konca_kontraktu).toLocaleDateString("pl-PL") : null]
    );
  } else {
    pola.push(
      ["Status", STATUS_LABELS[rekord.status] || rekord.status],
      ["Przypisane do", rekord.przypisane_do ? nazwaDla(rekord.przypisane_do) : null],
      ["Termin kolejnego kontaktu", rekord.termin_kontaktu ? new Date(rekord.termin_kontaktu).toLocaleDateString("pl-PL") : null]
    );
  }

  document.getElementById("detail-fields").innerHTML = pola.map(([etykieta, wartosc]) => `
    <div><span class="details-label">${etykieta}</span><div>${wartosc != null && wartosc !== "" ? wartosc : "—"}</div></div>
  `).join("");

  const tabelaNotatek = jestKlientem ? "notatki_klienta" : "notatki_leada";
  await loadDetailNotatki(rekordId, tabelaNotatek);

  document.getElementById("detail-notatka-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const textarea = e.target.querySelector("textarea");
    const tresc = textarea.value.trim();
    if (!tresc) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error: insertError } = await supabaseClient
      .from(tabelaNotatek)
      .insert({ lead_id: rekordId, autor: user.email, tresc });

    if (insertError) {
      showToast("Nie udało się dodać notatki: " + insertError.message, true);
    } else {
      textarea.value = "";
      await loadDetailNotatki(rekordId, tabelaNotatek);
    }
  });

  await loadDetailPolaczenia(rekordId);

  document.getElementById("detail-polaczenie-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const wynik = document.getElementById("detail-polaczenie-wynik").value;
    const komentarzInput = document.getElementById("detail-polaczenie-komentarz");
    const komentarz = komentarzInput.value.trim();

    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error: insertError } = await supabaseClient
      .from("dziennik_polaczen")
      .insert({ lead_id: rekordId, autor: user.email, wynik, komentarz: komentarz || null });

    if (insertError) {
      showToast("Nie udało się zapisać połączenia: " + insertError.message, true);
    } else {
      komentarzInput.value = "";
      showToast("Połączenie zapisane.");
      await loadDetailPolaczenia(rekordId);
    }
  });

  await loadDetailWyslaneMaile(rekordId);
}

const JEZYK_LABELS = { pl: "Polski", en: "English", de: "Deutsch" };

async function loadDetailWyslaneMaile(rekordId) {
  const container = document.getElementById("detail-maile-list");
  const { data, error } = await supabaseClient
    .from("wyslane_maile")
    .select("*")
    .eq("lead_id", rekordId)
    .order("wyslano_o", { ascending: false });

  if (error) {
    container.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania historii maili.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<p class="zgloszenia-loading">Nie wysłano jeszcze żadnego maila.</p>`;
    return;
  }

  container.innerHTML = data.map((m) => `
    <div class="notatka-item">
      <div class="notatka-meta">
        <span class="polaczenie-wynik-pill">${JEZYK_LABELS[m.jezyk] || m.jezyk}</span>
        · na adres ${escapeHtml(m.adres_docelowy)} · ${escapeHtml(nazwaDla(m.autor) || "—")} · ${new Date(m.wyslano_o).toLocaleString("pl-PL")}
      </div>
    </div>
  `).join("");
}

// -------------------- MAŁE OKNO: wybór języka i wysyłka maila --------------------

async function showSendMailScreen(session, leadId) {
  loginScreen.hidden = true;
  setPasswordScreen.hidden = true;
  appScreen.hidden = true;
  detailScreen.hidden = true;
  sendMailScreen.hidden = false;
  currentUserEmail = session.user.email;

  const statusEl = document.getElementById("send-mail-status");
  statusEl.hidden = true;

  const { data: lead, error } = await supabaseClient
    .from("leady")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error || !lead) {
    document.getElementById("send-mail-nazwa").textContent = "Nie znaleziono rekordu.";
    return;
  }

  document.title = `Wyślij mail — ${lead.nazwa_firmy}`;
  document.getElementById("send-mail-nazwa").textContent = lead.nazwa_firmy;

  if (!lead.email) {
    statusEl.hidden = false;
    statusEl.textContent = "Ten lead nie ma podanego adresu e-mail - uzupełnij go najpierw w edycji firmy.";
    statusEl.classList.add("send-mail-status-error");
    document.querySelectorAll(".btn-send-mail-lang").forEach((b) => { b.disabled = true; });
    return;
  }

  document.querySelectorAll(".btn-send-mail-lang").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".btn-send-mail-lang").forEach((b) => { b.disabled = true; });
      statusEl.hidden = false;
      statusEl.classList.remove("send-mail-status-error");
      statusEl.textContent = "Wysyłam…";

      const wynik = await wyslijMailCore(lead, btn.dataset.lang);

      if (wynik.success) {
        statusEl.textContent = `Wysłano do ${wynik.adres}. To okno zamknie się za chwilę…`;
        setTimeout(() => window.close(), 2500);
      } else {
        statusEl.classList.add("send-mail-status-error");
        statusEl.textContent = "Nie udało się wysłać: " + wynik.error;
        document.querySelectorAll(".btn-send-mail-lang").forEach((b) => { b.disabled = false; });
      }
    });
  });
}

const WYNIK_LABELS = {
  brak_odbioru: "Brak odbioru",
  zainteresowany: "Rozmowa — zainteresowany",
  niezainteresowany: "Rozmowa — niezainteresowany",
  oddzwonic: "Oddzwonić później",
  zly_numer: "Zły / nieaktualny numer",
  inne: "Inne",
};

async function loadDetailPolaczenia(rekordId) {
  const container = document.getElementById("detail-polaczenia-list");
  const { data, error } = await supabaseClient
    .from("dziennik_polaczen")
    .select("*")
    .eq("lead_id", rekordId)
    .order("utworzono_o", { ascending: false });

  if (error) {
    container.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania dziennika połączeń.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<p class="zgloszenia-loading">Brak zapisanych połączeń.</p>`;
    return;
  }

  container.innerHTML = data.map((p) => `
    <div class="notatka-item">
      <div class="notatka-meta">
        <span class="polaczenie-wynik-pill">${WYNIK_LABELS[p.wynik] || p.wynik}</span>
        · ${escapeHtml(nazwaDla(p.autor) || "—")} · ${new Date(p.utworzono_o).toLocaleString("pl-PL")}
      </div>
      ${p.komentarz ? `<div>${escapeHtml(p.komentarz)}</div>` : ""}
    </div>
  `).join("");
}

async function loadDetailNotatki(rekordId, tabelaNotatek) {
  const container = document.getElementById("detail-notatki-thread");
  const { data, error } = await supabaseClient
    .from(tabelaNotatek)
    .select("*")
    .eq("lead_id", rekordId)
    .order("utworzono_o", { ascending: true });

  if (error) {
    container.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania notatek.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<p class="zgloszenia-loading">Brak notatek.</p>`;
    return;
  }

  container.innerHTML = data.map((n) => `
    <div class="notatka-item">
      <div class="notatka-meta">${escapeHtml(nazwaDla(n.autor) || "—")} · ${new Date(n.utworzono_o).toLocaleString("pl-PL")}</div>
      <div>${escapeHtml(n.tresc)}</div>
    </div>
  `).join("");
}

document.getElementById("set-password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const setPasswordMessage = document.getElementById("set-password-message");
  const nowe = document.getElementById("new-password-input").value;
  const powtorzone = document.getElementById("new-password-repeat-input").value;
  const btn = document.getElementById("set-password-btn");

  if (nowe !== powtorzone) {
    setPasswordMessage.hidden = false;
    setPasswordMessage.textContent = "Hasła nie są takie same.";
    setPasswordMessage.classList.add("login-message-error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Zapisuję…";

  const { data, error } = await supabaseClient.auth.updateUser({ password: nowe });

  btn.disabled = false;
  btn.textContent = "Zapisz hasło";

  if (error) {
    setPasswordMessage.hidden = false;
    setPasswordMessage.textContent = "Nie udało się zapisać hasła: " + error.message;
    setPasswordMessage.classList.add("login-message-error");
  } else {
    showApp(data.user ? { user: data.user } : (await supabaseClient.auth.getSession()).data.session);
  }
});

// -------------------- ZAKŁADKI LEADY / KLIENCI --------------------

document.querySelectorAll("#view-tabs .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentTab = btn.dataset.tab;
    document.querySelectorAll("#view-tabs .tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    viewLeady.hidden = currentTab !== "leady";
    viewKlienci.hidden = currentTab !== "klienci";
    viewZgloszenia.hidden = currentTab !== "zgloszenia";
    statusFilter.hidden = currentTab !== "leady";
    fieldFilters.hidden = currentTab !== "leady";
    addLeadBtn.hidden = currentTab !== "leady";
    importCsvBtn.hidden = currentTab !== "leady";
    resultsCount.hidden = currentTab === "zgloszenia";
    render();
  });
});

function render() {
  if (currentTab === "leady") {
    renderTable();
  } else if (currentTab === "klienci") {
    renderKlienciTable();
  } else {
    renderZgloszeniaTable();
  }
}

// -------------------- ROZWIJANY PANEL FILTRÓW (Leady) --------------------

filterToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  filterPanel.hidden = !filterPanel.hidden;
});

document.addEventListener("click", (e) => {
  if (!filterPanel.hidden && !fieldFilters.contains(e.target)) {
    filterPanel.hidden = true;
  }
});

function updateFilterBadge() {
  const aktywne = [filterMaEmail, filterMaTelefon, filterMaWww].filter((cb) => cb.checked).length;
  filterCountBadge.textContent = aktywne > 0 ? `(${aktywne})` : "";
}

// -------------------- POBIERANIE / RENDEROWANIE LEADÓW --------------------

async function loadLeady() {
  loadingState.hidden = false;
  emptyState.hidden = true;

  const { data, error } = await supabaseClient
    .from("leady")
    .select("*")
    .is("usunieto_o", null)
    .order("utworzono_o", { ascending: false });

  loadingState.hidden = true;

  if (error) {
    showToast("Błąd wczytywania: " + error.message, true);
    return;
  }

  currentLeady = data || [];
  renderStats();
  render();
}

let filterDoDzis = false;

function jestPilnyDzis(lead) {
  const dzisiaj = new Date().toISOString().slice(0, 10);
  if (lead.termin_kontaktu) return lead.termin_kontaktu <= dzisiaj;
  return lead.status === "do_zadzwonienia";
}

function renderStats() {
  const leadyOnly = currentLeady.filter((l) => !l.numer_klienta);
  const counts = {};
  leadyOnly.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

  const doDzisLiczba = leadyOnly.filter(jestPilnyDzis).length;

  statsRow.innerHTML = `
    <div class="stat-pill stat-pill-pilne ${filterDoDzis ? "stat-pill-active" : ""}" data-pilne="1">
      <span class="stat-count">${doDzisLiczba}</span>
      <span class="stat-label">Do dziś</span>
    </div>
  ` + Object.entries(STATUS_LABELS).map(([key, label]) => `
    <div class="stat-pill" data-status="${key}">
      <span class="stat-count">${counts[key] || 0}</span>
      <span class="stat-label">${label}</span>
    </div>
  `).join("");

  statsRow.querySelectorAll(".stat-pill[data-status]").forEach((pill) => {
    pill.addEventListener("click", () => {
      filterDoDzis = false;
      statusFilter.value = pill.dataset.status;
      render();
    });
  });

  const pilnaPill = statsRow.querySelector(".stat-pill-pilne");
  pilnaPill.addEventListener("click", () => {
    filterDoDzis = !filterDoDzis;
    statusFilter.value = "";
    render();
  });
}

function getFilteredLeady() {
  const q = searchInput.value.trim().toLowerCase();
  const statusVal = statusFilter.value;

  return currentLeady.filter((l) => {
    if (l.numer_klienta) return false;
    if (statusVal && l.status !== statusVal) return false;
    if (filterDoDzis && !jestPilnyDzis(l)) return false;
    if (filterMaEmail.checked && !l.email) return false;
    if (filterMaTelefon.checked && !l.telefon) return false;
    if (filterMaWww.checked && !l.www) return false;
    if (!q) return true;
    const haystack = [l.nazwa_firmy, l.nip, l.lokalizacja, l.telefon, l.email, l.osoba_kontaktowa]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

function getFilteredKlienci() {
  const q = searchInput.value.trim().toLowerCase();

  return currentLeady.filter((l) => {
    if (!l.numer_klienta) return false;
    if (!q) return true;
    const haystack = [l.nazwa_firmy, l.nip, l.lokalizacja, l.numer_klienta]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

function renderTable() {
  const filtered = getFilteredLeady();
  emptyState.hidden = filtered.length !== 0;
  resultsCount.textContent = `Znaleziono: ${filtered.length}`;
  tbody.innerHTML = "";

  filtered.forEach((lead) => {
    const tr = document.createElement("tr");
    tr.className = "row-main";
    tr.innerHTML = `
      <td class="cell-open"><a href="?rekord=${lead.id}" target="_blank" class="btn-open-link" title="Otwórz w nowym oknie">↗</a></td>
      <td class="cell-nazwa cell-clickable" data-toggle="${lead.id}" title="${escapeHtml(lead.nazwa_firmy)}">${escapeHtml(lead.nazwa_firmy)}</td>
      <td>${escapeHtml(lead.lokalizacja || "—")}</td>
      <td class="cell-mono">${lead.wielkosc_floty != null ? lead.wielkosc_floty : "—"}</td>
      <td>
        <select class="status-select status-${lead.status}" data-id="${lead.id}">
          ${Object.entries(STATUS_LABELS).map(([key, label]) =>
            `<option value="${key}" ${lead.status === key ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
      </td>
      <td>${lead.przypisane_do ? escapeHtml(nazwaDla(lead.przypisane_do)) : "—"}</td>
      <td class="cell-actions">
        <button class="btn-edit" data-id="${lead.id}">Edytuj</button>
        <button class="btn-oznacz" data-id="${lead.id}" data-nazwa="${escapeHtml(lead.nazwa_firmy)}" title="Oznacz jako klienta">Klient</button>
        <button class="btn-delete" data-id="${lead.id}" data-nazwa="${escapeHtml(lead.nazwa_firmy)}">Usuń</button>
      </td>
    `;
    tbody.appendChild(tr);

    const trDetails = document.createElement("tr");
    trDetails.className = "row-details";
    trDetails.hidden = true;
    trDetails.dataset.detailsFor = lead.id;
    trDetails.innerHTML = `
      <td colspan="7">
        <div class="details-grid">
          <div><span class="details-label">NIP</span><div>${escapeHtml(lead.nip || "—")}</div></div>
          <div><span class="details-label">Telefon</span><div>${escapeHtml(lead.telefon || "—")}</div></div>
          <div>
            <span class="details-label">E-mail</span>
            <div>${escapeHtml(lead.email || "—")}</div>
            <button type="button" class="btn-otworz-wysylke" data-id="${lead.id}" data-nazwa="${escapeHtml(lead.nazwa_firmy)}">Wyślij mail</button>
          </div>
          <div><span class="details-label">Strona www</span><div>${renderWwwCell(lead.www)}</div></div>
          <div>
            <span class="details-label">Termin kolejnego kontaktu</span>
            <input type="date" class="termin-kontaktu-input" data-id="${lead.id}" value="${lead.termin_kontaktu || ""}">
          </div>
          <div class="details-notatki">
            <span class="details-label">Notatki</span>
            ${lead.notatki ? `<div class="notatka-historyczna">${escapeHtml(lead.notatki)}<span class="notatka-tag">stara notatka</span></div>` : ""}
            <div class="notatki-thread" id="notatki-lead-thread-${lead.id}">
              <p class="zgloszenia-loading">Wczytuję notatki…</p>
            </div>
            <form class="notatka-lead-form" data-id="${lead.id}">
              <textarea rows="2" placeholder="Dodaj notatkę…" required></textarea>
              <button type="submit" class="btn-primary">Dodaj</button>
            </form>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(trDetails);
  });

  tbody.querySelectorAll(".cell-clickable").forEach((cell) => {
    cell.addEventListener("click", async () => {
      const details = tbody.querySelector(`.row-details[data-details-for="${cell.dataset.toggle}"]`);
      if (!details) return;
      details.hidden = !details.hidden;
      if (!details.hidden && details.dataset.notatkiLoaded !== "1") {
        details.dataset.notatkiLoaded = "1";
        await loadNotatkiLeada(cell.dataset.toggle);
      }
    });
  });

  tbody.querySelectorAll(".notatka-lead-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = form.querySelector("textarea");
      const tresc = textarea.value.trim();
      if (!tresc) return;
      await dodajNotatkeLeada(form.dataset.id, tresc);
      textarea.value = "";
    });
  });

  tbody.querySelectorAll(".btn-otworz-wysylke").forEach((btn) => {
    btn.addEventListener("click", () => {
      otworzOknoWMniejszymRozmiarze(`?wyslij_mail=${btn.dataset.id}`, 460, 420);
    });
  });

  tbody.querySelectorAll(".termin-kontaktu-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
      await updateTerminKontaktu(e.target.dataset.id, e.target.value || null);
    });
  });

  tbody.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      await updateLeadStatus(e.target.dataset.id, e.target.value);
    });
  });

  tbody.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.id));
  });

  tbody.querySelectorAll(".btn-open-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      otworzWOknie(a.href);
    });
  });

  tbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => softDeleteLead(btn.dataset.id, btn.dataset.nazwa));
  });

  tbody.querySelectorAll(".btn-oznacz").forEach((btn) => {
    btn.addEventListener("click", () => oznaczJakoKlienta(btn.dataset.id, btn.dataset.nazwa));
  });
}

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
[filterMaEmail, filterMaTelefon, filterMaWww].forEach((cb) => {
  cb.addEventListener("change", () => {
    updateFilterBadge();
    render();
  });
});

async function oznaczJakoKlienta(id, nazwa) {
  const potwierdzenie = confirm(
    `Czy na pewno chcesz oznaczyć "${nazwa}" jako klienta?\n\n` +
    `Zostanie mu nadany numer klienta, a firma przeniesie się do zakładki "Klienci".`
  );
  if (!potwierdzenie) return;

  const { data: nowyNumer, error } = await supabaseClient.rpc("oznacz_jako_klienta", { p_id: id });

  if (error) {
    showToast("Nie udało się oznaczyć jako klienta: " + error.message, true);
    return;
  }

  const lead = currentLeady.find((l) => l.id === id);
  if (lead) {
    lead.numer_klienta = nowyNumer;
    lead.klientem_od = new Date().toISOString();
  }
  renderStats();
  render();
  showToast(`Oznaczono jako klienta (nr ${nowyNumer}).`);
}

// -------------------- ZAKŁADKA KLIENCI --------------------

function renderKlienciTable() {
  const filtered = getFilteredKlienci();
  emptyStateKlienci.hidden = filtered.length !== 0;
  resultsCount.textContent = `Znaleziono: ${filtered.length}`;
  klienciTbody.innerHTML = "";

  filtered.forEach((lead) => {
    const tr = document.createElement("tr");
    tr.className = "row-main";
    tr.innerHTML = `
      <td class="cell-mono cell-clickable" data-toggle="${lead.id}">${escapeHtml(lead.numer_klienta || "—")}</td>
      <td class="cell-open"><a href="?rekord=${lead.id}" target="_blank" class="btn-open-link" title="Otwórz w nowym oknie">↗</a></td>
      <td class="cell-nazwa" title="${escapeHtml(lead.nazwa_firmy)}">${escapeHtml(lead.nazwa_firmy)}</td>
      <td>${escapeHtml(lead.lokalizacja || "—")}</td>
      <td>${lead.klientem_od ? new Date(lead.klientem_od).toLocaleDateString("pl-PL") : "—"}</td>
      <td>${lead.data_konca_kontraktu ? new Date(lead.data_konca_kontraktu).toLocaleDateString("pl-PL") : "—"}</td>
      <td class="cell-actions">
        <button class="btn-edit" data-id="${lead.id}">Edytuj</button>
        <button class="btn-delete" data-id="${lead.id}" data-nazwa="${escapeHtml(lead.nazwa_firmy)}">Archiwizuj</button>
      </td>
    `;
    klienciTbody.appendChild(tr);

    const trDetails = document.createElement("tr");
    trDetails.className = "row-details";
    trDetails.hidden = true;
    trDetails.dataset.detailsFor = lead.id;
    trDetails.innerHTML = `
      <td colspan="7">
        <div class="details-grid">
          <div><span class="details-label">NIP</span><div>${escapeHtml(lead.nip || "—")}</div></div>
          <div><span class="details-label">Telefon</span><div>${escapeHtml(lead.telefon || "—")}</div></div>
          <div><span class="details-label">E-mail</span><div>${escapeHtml(lead.email || "—")}</div></div>
          <div><span class="details-label">Strona www</span><div>${renderWwwCell(lead.www)}</div></div>
          <div>
            <span class="details-label">Data końca kontraktu</span>
            <input type="date" class="kontrakt-input" data-id="${lead.id}" value="${lead.data_konca_kontraktu || ""}">
          </div>
        </div>
        <div class="notatki-section">
          <span class="details-label">Notatki</span>
          <div class="notatki-thread" id="notatki-thread-${lead.id}">
            <p class="notatki-loading">Wczytuję notatki…</p>
          </div>
          <form class="notatka-form" data-id="${lead.id}">
            <textarea rows="2" placeholder="Dodaj notatkę…" required></textarea>
            <button type="submit" class="btn-primary">Dodaj</button>
          </form>
        </div>
      </td>
    `;
    klienciTbody.appendChild(trDetails);
  });

  klienciTbody.querySelectorAll(".cell-clickable").forEach((cell) => {
    cell.addEventListener("click", async () => {
      const details = klienciTbody.querySelector(`.row-details[data-details-for="${cell.dataset.toggle}"]`);
      if (!details) return;
      details.hidden = !details.hidden;
      if (!details.hidden && details.dataset.notatkiLoaded !== "1") {
        details.dataset.notatkiLoaded = "1";
        await loadAndRenderNotatki(cell.dataset.toggle);
      }
    });
  });

  klienciTbody.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.id));
  });

  klienciTbody.querySelectorAll(".btn-open-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      otworzWOknie(a.href);
    });
  });

  klienciTbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => archiveClient(btn.dataset.id, btn.dataset.nazwa));
  });

  klienciTbody.querySelectorAll(".kontrakt-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
      await updateKoniecKontraktu(e.target.dataset.id, e.target.value || null);
    });
  });

  klienciTbody.querySelectorAll(".notatka-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = form.querySelector("textarea");
      const tresc = textarea.value.trim();
      if (!tresc) return;
      await dodajNotatke(form.dataset.id, tresc);
      textarea.value = "";
    });
  });
}

async function loadAndRenderNotatki(leadId) {
  const { data, error } = await supabaseClient
    .from("notatki_klienta")
    .select("*")
    .eq("lead_id", leadId)
    .order("utworzono_o", { ascending: true });

  if (error) {
    const container = document.getElementById(`notatki-thread-${leadId}`);
    if (container) container.innerHTML = `<p class="notatki-loading">Błąd wczytywania notatek.</p>`;
    return;
  }

  notatkiCache[leadId] = data || [];
  renderNotatkiThread(leadId);
}

function renderNotatkiThread(leadId) {
  const container = document.getElementById(`notatki-thread-${leadId}`);
  if (!container) return;
  const notatki = notatkiCache[leadId] || [];

  if (notatki.length === 0) {
    container.innerHTML = `<p class="notatki-loading">Brak notatek.</p>`;
    return;
  }

  container.innerHTML = notatki.map((n) => `
    <div class="notatka-item">
      <div class="notatka-meta">${escapeHtml(nazwaDla(n.autor) || "—")} · ${new Date(n.utworzono_o).toLocaleString("pl-PL")}</div>
      <div>${escapeHtml(n.tresc)}</div>
    </div>
  `).join("");
}

async function dodajNotatke(leadId, tresc) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient
    .from("notatki_klienta")
    .insert({ lead_id: leadId, autor: user.email, tresc });

  if (error) {
    showToast("Nie udało się dodać notatki: " + error.message, true);
  } else {
    await loadAndRenderNotatki(leadId);
    showToast("Notatka dodana.");
  }
}

// -------------------- WĄTEK NOTATEK LEADA --------------------

let notatkiLeadaCache = {};

async function loadNotatkiLeada(leadId) {
  const { data, error } = await supabaseClient
    .from("notatki_leada")
    .select("*")
    .eq("lead_id", leadId)
    .order("utworzono_o", { ascending: true });

  const container = document.getElementById(`notatki-lead-thread-${leadId}`);

  if (error) {
    if (container) container.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania notatek.</p>`;
    return;
  }

  notatkiLeadaCache[leadId] = data || [];
  renderNotatkiLeadaThread(leadId);
}

function renderNotatkiLeadaThread(leadId) {
  const container = document.getElementById(`notatki-lead-thread-${leadId}`);
  if (!container) return;
  const notatki = notatkiLeadaCache[leadId] || [];

  if (notatki.length === 0) {
    container.innerHTML = `<p class="zgloszenia-loading">Brak notatek.</p>`;
    return;
  }

  container.innerHTML = notatki.map((n) => `
    <div class="notatka-item">
      <div class="notatka-meta">${escapeHtml(nazwaDla(n.autor) || "—")} · ${new Date(n.utworzono_o).toLocaleString("pl-PL")}</div>
      <div>${escapeHtml(n.tresc)}</div>
    </div>
  `).join("");
}

async function dodajNotatkeLeada(leadId, tresc) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient
    .from("notatki_leada")
    .insert({ lead_id: leadId, autor: user.email, tresc });

  if (error) {
    showToast("Nie udało się dodać notatki: " + error.message, true);
  } else {
    await loadNotatkiLeada(leadId);
    showToast("Notatka dodana.");
  }
}

async function updateKoniecKontraktu(id, dataKonca) {
  const { error } = await supabaseClient.from("leady").update({ data_konca_kontraktu: dataKonca }).eq("id", id);
  if (error) {
    showToast("Nie udało się zapisać daty: " + error.message, true);
  } else {
    const lead = currentLeady.find((l) => l.id === id);
    if (lead) lead.data_konca_kontraktu = dataKonca;
    showToast("Data zapisana.");
  }
}

async function updateTerminKontaktu(id, termin) {
  const { error } = await supabaseClient.from("leady").update({ termin_kontaktu: termin }).eq("id", id);
  if (error) {
    showToast("Nie udało się zapisać terminu: " + error.message, true);
  } else {
    const lead = currentLeady.find((l) => l.id === id);
    if (lead) lead.termin_kontaktu = termin;
    renderStats();
    showToast("Termin zapisany.");
  }
}

// -------------------- WYSYŁKA MAILI (Resend przez zaplecze) --------------------
//
// UWAGA: to placeholdery ("[TU WSTAW TREŚĆ]") - Maciej podmieni je na
// docelową treść od kolegów, gdy będzie gotowa. Zmienne {{nazwa_firmy}}
// i {{osoba_kontaktowa}} są automatycznie podstawiane przy wysyłce.

const EMAIL_TEMPLATES = {
  pl: {
    subject: "Propozycja współpracy — ServFleet GPS",
    html: `
      <p>Dzień dobry {{osoba_kontaktowa}},</p>
      <p>Piszę w imieniu ServFleet do firmy {{nazwa_firmy}} z propozycją współpracy w zakresie monitoringu GPS floty pojazdów.</p>
      <p>[TU WSTAW WŁAŚCIWĄ TREŚĆ]</p>
      <p>Pozdrawiam,<br>Maciej Janas<br>ServFleet</p>
    `,
  },
  en: {
    subject: "Partnership proposal — ServFleet GPS",
    html: `
      <p>Hello {{osoba_kontaktowa}},</p>
      <p>I'm reaching out on behalf of ServFleet to {{nazwa_firmy}} with a proposal regarding GPS fleet monitoring.</p>
      <p>[INSERT ACTUAL CONTENT HERE]</p>
      <p>Best regards,<br>Maciej Janas<br>ServFleet</p>
    `,
  },
  de: {
    subject: "Kooperationsvorschlag — ServFleet GPS",
    html: `
      <p>Guten Tag {{osoba_kontaktowa}},</p>
      <p>ich schreibe im Namen von ServFleet an {{nazwa_firmy}} mit einem Vorschlag zur GPS-Flottenüberwachung.</p>
      <p>[HIER DEN EIGENTLICHEN TEXT EINFÜGEN]</p>
      <p>Mit freundlichen Grüßen,<br>Maciej Janas<br>ServFleet</p>
    `,
  },
};

function wypelnijSzablon(tekst, lead) {
  return tekst
    .replaceAll("{{nazwa_firmy}}", escapeHtml(lead.nazwa_firmy || ""))
    .replaceAll("{{osoba_kontaktowa}}", escapeHtml(lead.osoba_kontaktowa || (lead.nazwa_firmy || "")));
}

async function wyslijMailCore(lead, jezyk) {
  if (!lead.email) {
    return { success: false, error: "Ten lead nie ma podanego adresu e-mail." };
  }

  const szablon = EMAIL_TEMPLATES[jezyk];
  if (!szablon) return { success: false, error: "Nieznany język." };

  const { data: { session } } = await supabaseClient.auth.getSession();

  try {
    const resp = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        to: lead.email,
        subject: wypelnijSzablon(szablon.subject, lead),
        html: wypelnijSzablon(szablon.html, lead),
      }),
    });

    const dane = await resp.json();

    if (!resp.ok) {
      return { success: false, error: dane.error || "nieznany błąd" };
    }

    const { data: { user } } = await supabaseClient.auth.getUser();

    await supabaseClient.from("wyslane_maile").insert({
      lead_id: lead.id,
      jezyk,
      adres_docelowy: lead.email,
      autor: user.email,
    });

    await supabaseClient.from("leady").update({ status: "mail_wyslany" }).eq("id", lead.id);

    return { success: true, adres: lead.email };
  } catch (err) {
    return { success: false, error: "Błąd połączenia z zapleczem wysyłki: " + err.message };
  }
}

async function updateLeadStatus(id, status) {
  const { error } = await supabaseClient.from("leady").update({ status }).eq("id", id);
  if (error) {
    showToast("Nie udało się zapisać statusu: " + error.message, true);
  } else {
    const lead = currentLeady.find((l) => l.id === id);
    if (lead) lead.status = status;
    renderStats();
    showToast("Status zapisany.");
  }
}

async function softDeleteLead(id, nazwa) {
  const potwierdzenie = confirm(
    `Usunąć firmę "${nazwa}" z listy?\n\n` +
    `Rekord nie zniknie bezpowrotnie z bazy - zostanie oznaczony jako usunięty ` +
    `wraz z Twoim adresem e-mail i datą, więc będzie można go odzyskać przez panel Supabase.`
  );
  if (!potwierdzenie) return;

  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient
    .from("leady")
    .update({ usunieto_przez: user.email, usunieto_o: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    showToast("Nie udało się usunąć: " + error.message, true);
  } else {
    currentLeady = currentLeady.filter((l) => l.id !== id);
    renderStats();
    render();
    showToast("Firma usunięta z listy.");
  }
}

async function archiveClient(id, nazwa) {
  const potwierdzenie = confirm(
    `Czy na pewno chcesz zarchiwizować klienta "${nazwa}"?\n\n` +
    `Rekord nie zniknie bezpowrotnie z bazy - zostanie oznaczony jako usunięty ` +
    `wraz z Twoim adresem e-mail i datą, więc będzie można go odzyskać przez panel Supabase.`
  );
  if (!potwierdzenie) return;

  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient
    .from("leady")
    .update({ usunieto_przez: user.email, usunieto_o: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    showToast("Nie udało się zarchiwizować: " + error.message, true);
  } else {
    currentLeady = currentLeady.filter((l) => l.id !== id);
    render();
    showToast("Klient zarchiwizowany.");
  }
}

// -------------------- MODAL: DODAWANIE / EDYCJA --------------------

function populatePrzypisaneSelect(currentValue) {
  const select = document.getElementById("f-przypisane");
  select.innerHTML = `<option value="">— brak —</option>`;

  const emaile = Object.keys(profilesByEmail).sort((a, b) =>
    nazwaDla(a).localeCompare(nazwaDla(b), "pl")
  );

  emaile.forEach((email) => {
    const opt = document.createElement("option");
    opt.value = email;
    opt.textContent = nazwaDla(email);
    select.appendChild(opt);
  });

  // Jeśli aktualna wartość (np. stary, ręcznie wpisany e-mail) nie jest
  // znanym userem appki, dorzuć ją jako opcję, żeby nie zniknęła po zapisie.
  if (currentValue && !profilesByEmail.hasOwnProperty(currentValue)) {
    const opt = document.createElement("option");
    opt.value = currentValue;
    opt.textContent = `${currentValue} (nieznany użytkownik)`;
    select.appendChild(opt);
  }

  select.value = currentValue || "";
}

function openModal(id = null) {
  leadForm.reset();
  document.getElementById("lead-id").value = "";

  if (id) {
    const lead = currentLeady.find((l) => l.id === id);
    if (!lead) return;
    modalTitle.textContent = "Edytuj firmę";
    document.getElementById("lead-id").value = lead.id;
    document.getElementById("f-nazwa").value = lead.nazwa_firmy || "";
    document.getElementById("f-nip").value = lead.nip || "";
    document.getElementById("f-lokalizacja").value = lead.lokalizacja || "";
    document.getElementById("f-adres").value = lead.adres || "";
    document.getElementById("f-telefon").value = lead.telefon || "";
    document.getElementById("f-email").value = lead.email || "";
    document.getElementById("f-www").value = lead.www || "";
    document.getElementById("f-osoba").value = lead.osoba_kontaktowa || "";
    document.getElementById("f-flota").value = lead.wielkosc_floty != null ? lead.wielkosc_floty : "";
    document.getElementById("f-status").value = lead.status || "nowy";
    populatePrzypisaneSelect(lead.przypisane_do || "");
    document.getElementById("f-status-label").hidden = !!lead.numer_klienta;
  } else {
    modalTitle.textContent = "Dodaj firmę";
    populatePrzypisaneSelect("");
    document.getElementById("f-status-label").hidden = false;
  }

  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
}

addLeadBtn.addEventListener("click", () => openModal());
modalCancel.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

leadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("lead-id").value;
  const payload = {
    nazwa_firmy: document.getElementById("f-nazwa").value.trim(),
    nip: document.getElementById("f-nip").value.trim() || null,
    lokalizacja: document.getElementById("f-lokalizacja").value.trim() || null,
    adres: document.getElementById("f-adres").value.trim() || null,
    telefon: document.getElementById("f-telefon").value.trim() || null,
    email: document.getElementById("f-email").value.trim() || null,
    www: document.getElementById("f-www").value.trim() || null,
    osoba_kontaktowa: document.getElementById("f-osoba").value.trim() || null,
    wielkosc_floty: document.getElementById("f-flota").value.trim() !== ""
      ? parseInt(document.getElementById("f-flota").value, 10)
      : null,
    przypisane_do: document.getElementById("f-przypisane").value.trim() || null,
  };

  // Status ma sens tylko dla leadow - jesli pole jest ukryte (edycja klienta),
  // nie dolaczaj go do zapisu, zeby nie nadpisac wartosci "po cichu".
  if (!document.getElementById("f-status-label").hidden) {
    payload.status = document.getElementById("f-status").value;
  }

  let error;
  if (id) {
    ({ error } = await supabaseClient.from("leady").update(payload).eq("id", id));
  } else {
    const { data: { user } } = await supabaseClient.auth.getUser();
    payload.utworzono_przez = user.id;
    payload.zrodlo = "ręcznie";
    ({ error } = await supabaseClient.from("leady").insert(payload));
  }

  if (error) {
    showToast("Błąd zapisu: " + error.message, true);
  } else {
    showToast("Zapisano.");
    closeModal();
    loadLeady();
  }
});

// -------------------- IMPORT CSV --------------------
// Obsługuje pliki CSV wygenerowane przez ceidg_leady.py oraz google_places_leady.py
// (separator ";", nagłówek w pierwszym wierszu).

importCsvBtn.addEventListener("click", () => csvInput.click());

csvInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    showToast("Plik CSV jest pusty albo nieczytelny.", true);
    return;
  }

  const mapped = rows.map(mapCsvRowToLead).filter((r) => r.nazwa_firmy);

  if (mapped.length === 0) {
    showToast("Nie rozpoznano żadnych rekordów w pliku (sprawdź nagłówki kolumn).", true);
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  mapped.forEach((r) => { r.utworzono_przez = user.id; });

  // upsert z ignoreDuplicates: firmy o juz istniejacym google_place_id
  // zostana pominiete zamiast wstawiane ponownie (ochrona przed duplikatami
  // przy powtornym imporcie tego samego miasta/frazy).
  const { error, count } = await supabaseClient
    .from("leady")
    .upsert(mapped, { onConflict: "google_place_id", ignoreDuplicates: true, count: "exact" });

  csvInput.value = "";

  if (error) {
    showToast("Błąd importu: " + error.message, true);
  } else {
    showToast(`Przetworzono ${mapped.length} rekordów z CSV (duplikaty po Google ID pominięte automatycznie).`);
    loadLeady();
  }
});

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || "").trim(); });
    return row;
  });
}

function mapCsvRowToLead(row) {
  // Obsługa nazw kolumn z obu skryptów (CEIDG PL i Google Places PL)
  const nazwa = row["nazwa_firmy"] || row["nazwa"] || "";
  const lokalizacja = row["miasto"] || row["lokalizacja"] || row["wojewodztwo"] || "";
  const adresCzesci = [row["ulica"], row["budynek"], row["lokal"]].filter(Boolean).join(" ");
  const adres = row["adres"] || adresCzesci || "";

  return {
    nazwa_firmy: nazwa,
    nip: row["nip"] || null,
    lokalizacja: lokalizacja || null,
    adres: adres || null,
    telefon: row["telefon"] || null,
    email: row["email"] || null,
    www: row["www"] || null,
    google_place_id: row["google_place_id"] || null,
    osoba_kontaktowa: [row["imie"], row["nazwisko"]].filter(Boolean).join(" ") || null,
    status: "nowy",
    zrodlo: row["google_place_id"] ? "Google Places" : (row["nip"] ? "CEIDG" : "import CSV"),
    notatki: null,
  };
}

// -------------------- CZAT (lewy dolny róg) --------------------

czatToggle.addEventListener("click", () => {
  czatWidget.hidden = !czatWidget.hidden;
  if (!czatWidget.hidden) {
    loadOnlineUsers();
    loadCzat();
    oznaczCzatJakoPrzeczytany();
  }
});
czatClose.addEventListener("click", () => { czatWidget.hidden = true; });

// Przeciąganie okna czatu za pasek nagłówka (zmiana rozmiaru obsługiwana
// natywnie przez CSS "resize: both" na samym oknie - bez dodatkowego JS).
(function initCzatDrag() {
  const header = czatWidget.querySelector(".czat-widget-header");
  let dragging = false;
  let startX, startY, startLeft, startTop;

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return;
    dragging = true;
    const rect = czatWidget.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    czatWidget.style.bottom = "auto";
    czatWidget.style.left = startLeft + "px";
    czatWidget.style.top = startTop + "px";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    newLeft = Math.max(0, Math.min(window.innerWidth - 60, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - 40, newTop));
    czatWidget.style.left = newLeft + "px";
    czatWidget.style.top = newTop + "px";
  });

  document.addEventListener("mouseup", () => { dragging = false; });
})();

// -------------------- ZAKŁADKA ZGŁOSZENIA --------------------

let currentZgloszenia = [];
let zglKomentarzeStats = {};
let zglLastViewedMap = {};

zglNewBtn.addEventListener("click", () => {
  zglNewFormWrap.hidden = !zglNewFormWrap.hidden;
});
zglNewCancel.addEventListener("click", () => {
  zglNewFormWrap.hidden = true;
  zgloszeniaForm.reset();
});

zglFilterStatus.addEventListener("change", renderZgloszeniaTable);
zglFilterTyp.addEventListener("change", renderZgloszeniaTable);
zglFilterAutor.addEventListener("change", renderZgloszeniaTable);

zgloszeniaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const typ = document.getElementById("zgloszenie-typ").value;
  const trescInput = document.getElementById("zgloszenie-tresc");
  const tresc = trescInput.value.trim();
  if (!tresc) return;

  const { error } = await supabaseClient
    .from("zgloszenia")
    .insert({ typ, tresc, autor: currentUserEmail });

  if (error) {
    showToast("Nie udało się wysłać zgłoszenia: " + error.message, true);
  } else {
    trescInput.value = "";
    zglNewFormWrap.hidden = true;
    showToast("Zgłoszenie wysłane, dzięki!");
    await loadZgloszenia();
  }
});

async function loadZgloszenia() {
  const { data, error } = await supabaseClient
    .from("zgloszenia")
    .select("*")
    .order("utworzono_o", { ascending: false });

  if (error) {
    zgloszeniaTbody.innerHTML = "";
    zgloszeniaEmpty.hidden = false;
    zgloszeniaEmpty.querySelector("p").textContent = "Błąd wczytywania zgłoszeń.";
    return;
  }

  currentZgloszenia = data || [];

  const otwarte = currentZgloszenia.filter((z) => z.status === "otwarte").length;
  zglTabBadge.hidden = otwarte === 0;
  zglTabBadge.textContent = otwarte;

  await Promise.all([wczytajStatystykiKomentarzy(), wczytajOstatnioWidziane()]);

  // Filtr autora widoczny tylko dla admina (zwykly user i tak widzi
  // wylacznie wlasne zgloszenia dzieki RLS, wiec filtr byłby bez sensu).
  if (currentUserEmail === ADMIN_EMAIL) {
    const obecnaWartosc = zglFilterAutor.value;
    const autorzy = [...new Set(currentZgloszenia.map((z) => z.autor))]
      .sort((a, b) => nazwaDla(a).localeCompare(nazwaDla(b), "pl"));
    zglFilterAutor.innerHTML = `<option value="">Wszyscy autorzy</option>` +
      autorzy.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(nazwaDla(a))}</option>`).join("");
    zglFilterAutor.value = obecnaWartosc;
    zglFilterAutor.hidden = false;
  } else {
    zglFilterAutor.hidden = true;
  }

  renderZgloszeniaTable();
}

async function wczytajStatystykiKomentarzy() {
  zglKomentarzeStats = {};
  if (currentZgloszenia.length === 0) return;

  const { data, error } = await supabaseClient
    .from("zgloszenia_komentarze")
    .select("zgloszenie_id, utworzono_o")
    .in("zgloszenie_id", currentZgloszenia.map((z) => z.id));

  if (error || !data) return;

  data.forEach((k) => {
    const s = zglKomentarzeStats[k.zgloszenie_id] || { liczba: 0, ostatnia: null };
    s.liczba += 1;
    if (!s.ostatnia || k.utworzono_o > s.ostatnia) s.ostatnia = k.utworzono_o;
    zglKomentarzeStats[k.zgloszenie_id] = s;
  });
}

async function wczytajOstatnioWidziane() {
  zglLastViewedMap = {};
  const { data, error } = await supabaseClient
    .from("zgloszenia_przeczytane")
    .select("zgloszenie_id, ostatnio_widziane_o")
    .eq("user_email", currentUserEmail);

  if (error || !data) return;
  data.forEach((w) => { zglLastViewedMap[w.zgloszenie_id] = w.ostatnio_widziane_o; });
}

async function oznaczOdpowiedziPrzeczytane(zgloszenieId) {
  const teraz = new Date().toISOString();
  zglLastViewedMap[zgloszenieId] = teraz;

  await supabaseClient
    .from("zgloszenia_przeczytane")
    .upsert({ zgloszenie_id: zgloszenieId, user_email: currentUserEmail, ostatnio_widziane_o: teraz },
      { onConflict: "zgloszenie_id,user_email" });

  // Zdejmij podswietlenie z calego wiersza, zeby nie zwijac innych
  // rozwinietych wierszy pelnym przerenderowaniem tabeli.
  const wiersz = zgloszeniaTbody.querySelector(`tr.row-main[data-row-id="${zgloszenieId}"]`);
  if (wiersz) wiersz.classList.remove("zgl-row-nowa");
}

const TYP_LABELS = { blad: "Błąd", pomysl: "Pomysł", inne: "Inne" };
let komentarzeCache = {};

function getFilteredZgloszenia() {
  return currentZgloszenia.filter((z) => {
    if (zglFilterStatus.value && z.status !== zglFilterStatus.value) return false;
    if (zglFilterTyp.value && z.typ !== zglFilterTyp.value) return false;
    if (!zglFilterAutor.hidden && zglFilterAutor.value && z.autor !== zglFilterAutor.value) return false;
    return true;
  });
}

function renderZgloszeniaTable() {
  const filtered = getFilteredZgloszenia();
  zgloszeniaEmpty.hidden = filtered.length !== 0;
  zgloszeniaEmpty.querySelector("p").textContent = "Brak zgłoszeń spełniających kryteria.";
  zgloszeniaTbody.innerHTML = "";

  const isAdmin = currentUserEmail === ADMIN_EMAIL;

  filtered.forEach((z) => {
    const mozeOznaczyc = isAdmin || z.autor === currentUserEmail;
    const dataStr = new Date(z.utworzono_o).toLocaleDateString("pl-PL");
    const trescSkrocona = z.tresc.length > 70 ? z.tresc.slice(0, 70) + "…" : z.tresc;

    const stats = zglKomentarzeStats[z.id] || { liczba: 0, ostatnia: null };
    const ostatnioWidziane = zglLastViewedMap[z.id];
    const maNowe = stats.ostatnia && (!ostatnioWidziane || stats.ostatnia > ostatnioWidziane);

    const tr = document.createElement("tr");
    tr.className = "row-main" + (maNowe ? " zgl-row-nowa" : "");
    tr.dataset.rowId = z.id;
    tr.innerHTML = `
      <td class="cell-mono">${TYP_LABELS[z.typ] || z.typ}</td>
      <td class="cell-nazwa cell-clickable" data-toggle="${z.id}" title="${escapeHtml(z.tresc)}">${escapeHtml(trescSkrocona)}</td>
      <td>${escapeHtml(nazwaDla(z.autor))}</td>
      <td>${dataStr}</td>
      <td><span class="zgl-status-pill zgl-status-${z.status}">${z.status === "zrobione" ? "✓ Zrobione" : "Otwarte"}</span></td>
      <td class="cell-actions">
        ${mozeOznaczyc && z.status === "otwarte"
          ? `<button type="button" class="btn-edit zgloszenie-done-btn" data-id="${z.id}">Oznacz zrobione</button>`
          : ""}
      </td>
    `;
    zgloszeniaTbody.appendChild(tr);

    const trDetails = document.createElement("tr");
    trDetails.className = "row-details";
    trDetails.hidden = true;
    trDetails.dataset.detailsFor = z.id;
    trDetails.innerHTML = `
      <td colspan="6">
        <div class="zgl-details-tresc">${escapeHtml(z.tresc)}</div>
        <div class="notatki-section">
          <span class="details-label">Odpowiedzi</span>
          <div class="zgloszenie-komentarze" id="zgloszenie-komentarze-${z.id}">
            <p class="zgloszenia-loading">Wczytuję…</p>
          </div>
          <form class="zgloszenie-komentarz-form" data-id="${z.id}">
            <textarea rows="2" placeholder="Napisz odpowiedź…" required></textarea>
            <button type="submit" class="btn-primary">Wyślij</button>
          </form>
        </div>
      </td>
    `;
    zgloszeniaTbody.appendChild(trDetails);
  });

  zgloszeniaTbody.querySelectorAll(".cell-clickable").forEach((cell) => {
    cell.addEventListener("click", async () => {
      const details = zgloszeniaTbody.querySelector(`.row-details[data-details-for="${cell.dataset.toggle}"]`);
      if (!details) return;
      details.hidden = !details.hidden;
      if (!details.hidden) {
        if (!komentarzeCache[cell.dataset.toggle]) {
          await loadKomentarze(cell.dataset.toggle);
        }
        await oznaczOdpowiedziPrzeczytane(cell.dataset.toggle);
      }
    });
  });

  zgloszeniaTbody.querySelectorAll(".zgloszenie-done-btn").forEach((btn) => {
    btn.addEventListener("click", () => oznaczZgloszenieZrobione(btn.dataset.id));
  });

  zgloszeniaTbody.querySelectorAll(".zgloszenie-komentarz-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = form.querySelector("textarea");
      const tresc = textarea.value.trim();
      if (!tresc) return;
      await dodajKomentarz(form.dataset.id, tresc);
      textarea.value = "";
    });
  });
}

async function loadKomentarze(zgloszenieId) {
  const { data, error } = await supabaseClient
    .from("zgloszenia_komentarze")
    .select("*")
    .eq("zgloszenie_id", zgloszenieId)
    .order("utworzono_o", { ascending: true });

  const container = document.getElementById(`zgloszenie-komentarze-${zgloszenieId}`);

  if (error) {
    if (container) container.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania.</p>`;
    return;
  }

  komentarzeCache[zgloszenieId] = data || [];
  renderKomentarze(zgloszenieId);
}

function renderKomentarze(zgloszenieId) {
  const container = document.getElementById(`zgloszenie-komentarze-${zgloszenieId}`);
  if (!container) return;
  const komentarze = komentarzeCache[zgloszenieId] || [];

  if (komentarze.length === 0) {
    container.innerHTML = `<p class="zgloszenia-loading">Brak odpowiedzi.</p>`;
    return;
  }

  container.innerHTML = komentarze.map((k) => `
    <div class="zgloszenie-komentarz ${k.autor === currentUserEmail ? "zgloszenie-komentarz-wlasny" : "zgloszenie-komentarz-cudzy"}">
      <div class="zgloszenie-komentarz-meta">${escapeHtml(nazwaDla(k.autor))} · ${new Date(k.utworzono_o).toLocaleString("pl-PL")}</div>
      <div>${escapeHtml(k.tresc)}</div>
    </div>
  `).join("");
}

async function dodajKomentarz(zgloszenieId, tresc) {
  const { error } = await supabaseClient
    .from("zgloszenia_komentarze")
    .insert({ zgloszenie_id: zgloszenieId, autor: currentUserEmail, tresc });

  if (error) {
    showToast("Nie udało się wysłać odpowiedzi: " + error.message, true);
  } else {
    await loadKomentarze(zgloszenieId);

    const teraz = new Date().toISOString();
    const s = zglKomentarzeStats[zgloszenieId] || { liczba: 0, ostatnia: null };
    s.liczba += 1;
    s.ostatnia = teraz;
    zglKomentarzeStats[zgloszenieId] = s;

    // Sam napisałeś odpowiedź, wiec od razu liczy się jako przeczytana
    // (nie ma sensu podswietlac ci wlasnego komentarza jako "nowy").
    await oznaczOdpowiedziPrzeczytane(zgloszenieId);
  }
}

async function oznaczZgloszenieZrobione(id) {
  const { error } = await supabaseClient
    .from("zgloszenia")
    .update({ status: "zrobione" })
    .eq("id", id);

  if (error) {
    showToast("Nie udało się zaktualizować zgłoszenia: " + error.message, true);
  } else {
    await loadZgloszenia();
  }
}

// -------------------- CZAT OGÓLNY --------------------

document.getElementById("czat-tresc").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    czatForm.requestSubmit();
  }
});

czatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const trescInput = document.getElementById("czat-tresc");
  const tresc = trescInput.value.trim();
  if (!tresc) return;

  const { error } = await supabaseClient
    .from("czat_ogolny")
    .insert({ autor: currentUserEmail, tresc });

  if (error) {
    showToast("Nie udało się wysłać wiadomości: " + error.message, true);
  } else {
    trescInput.value = "";
    lastCzatMessageSeenAt = new Date().toISOString();
    await loadCzat();
  }
});

async function loadCzat() {
  const { data, error } = await supabaseClient
    .from("czat_ogolny")
    .select("*")
    .order("utworzono_o", { ascending: true })
    .limit(200);

  if (error) {
    czatList.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania czatu.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    czatList.innerHTML = `<p class="zgloszenia-loading">Brak wiadomości. Napisz pierwszą!</p>`;
    return;
  }

  czatList.innerHTML = data.map((m) => `
    <div class="czat-wiadomosc ${m.autor === currentUserEmail ? "czat-wlasna" : ""}">
      <div class="zgloszenie-komentarz-meta">${escapeHtml(nazwaDla(m.autor))} · ${new Date(m.utworzono_o).toLocaleString("pl-PL")}</div>
      <div>${escapeHtml(m.tresc)}</div>
    </div>
  `).join("");

  czatList.scrollTop = czatList.scrollHeight;
}

// -------------------- HEARTBEAT (automatyczny status online) --------------------

let lastLocalActivityAt = Date.now();
let heartbeatInterval = null;

["mousemove", "keydown", "click", "scroll"].forEach((evt) => {
  document.addEventListener(evt, () => { lastLocalActivityAt = Date.now(); }, { passive: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    lastLocalActivityAt = Date.now();
    sendHeartbeat();
  }
});

async function sendHeartbeat() {
  if (!currentUserEmail) return;
  const bylAktywnyOstatnio10Min = (Date.now() - lastLocalActivityAt) <= 10 * 60 * 1000;
  const nowIso = new Date().toISOString();

  const payload = { email: currentUserEmail, last_seen: nowIso };
  if (bylAktywnyOstatnio10Min) payload.last_active = nowIso;

  await supabaseClient.from("profiles").upsert(payload, { onConflict: "email" });
  loadOnlineUsers();
}

function startHeartbeat() {
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 60 * 1000);
  lastCzatMessageSeenAt = new Date().toISOString();
  czatPollInterval = setInterval(sprawdzNoweWiadomosciCzatu, 20 * 1000);
}

function stopHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = null;
  if (czatPollInterval) clearInterval(czatPollInterval);
  czatPollInterval = null;
}

// -------------------- NIEPRZECZYTANE WIADOMOŚCI CZATU --------------------

let lastCzatMessageSeenAt = null;
let czatPollInterval = null;

async function sprawdzNoweWiadomosciCzatu() {
  const { data, error } = await supabaseClient
    .from("czat_ogolny")
    .select("autor, utworzono_o")
    .order("utworzono_o", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return;
  const najnowsza = data[0];

  if (!czatWidget.hidden) {
    // Okno otwarte - po prostu dociągnij ewentualną nową wiadomość.
    if (najnowsza.utworzono_o > lastCzatMessageSeenAt) {
      await loadCzat();
      lastCzatMessageSeenAt = najnowsza.utworzono_o;
    }
    return;
  }

  if (najnowsza.autor !== currentUserEmail && najnowsza.utworzono_o > lastCzatMessageSeenAt) {
    czatUnreadDot.hidden = false;
    czatToggle.classList.add("czat-toggle-mruga");
  }
}

function oznaczCzatJakoPrzeczytany() {
  czatUnreadDot.hidden = true;
  czatToggle.classList.remove("czat-toggle-mruga");
  lastCzatMessageSeenAt = new Date().toISOString();
}

// -------------------- LISTA "KTO ONLINE" --------------------

function formatRelativeTime(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minuty = Math.floor(diffMs / 60000);
  if (minuty < 1) return "przed chwilą";
  if (minuty < 60) return `${minuty} min temu`;
  const godziny = Math.floor(minuty / 60);
  if (godziny < 24) return `${godziny} godz. temu`;
  const dni = Math.floor(godziny / 24);
  return `${dni} dni temu`;
}

let profilesInitiallyLoaded = false;

async function loadOnlineUsers() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("last_active", { ascending: false });

  if (error) {
    czatRoster.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania listy.</p>`;
    return;
  }

  profilesByEmail = {};
  (data || []).forEach((p) => { profilesByEmail[p.email] = p.display_name; });
  if (currentUserEmail) userEmailEl.textContent = nazwaDla(currentUserEmail);

  renderOnlineList(data || []);

  // Pierwsze wczytanie nazw może nastąpić już PO wyrenderowaniu tabeli
  // leadów/klientów (bo to osobne zapytania) - odśwież ją wtedy raz,
  // żeby "Przypisane do" pokazało nazwę zamiast maila. Kolejne (cykliczne
  // co 60s) wczytania już NIE przerysowują tabeli - zwijałoby to rozwinięte
  // wiersze i przeszkadzało w pracy.
  if (!profilesInitiallyLoaded) {
    profilesInitiallyLoaded = true;
    render();
    loadZgloszenia();
    loadCzat();
  }
}

function renderOnlineList(profiles) {
  if (profiles.length === 0) {
    czatRoster.innerHTML = `<p class="zgloszenia-loading">Brak danych.</p>`;
    czatBadge.hidden = true;
    return;
  }

  const teraz = Date.now();
  const isAdmin = currentUserEmail === ADMIN_EMAIL;
  let aktywnychLiczba = 0;

  const wpisy = profiles.map((p) => {
    const minutyOdAktywnosci = (teraz - new Date(p.last_active).getTime()) / 60000;
    const minutyOdSeen = (teraz - new Date(p.last_seen).getTime()) / 60000;

    let status, klasa;
    if (minutyOdSeen > 3) {
      status = "Nieaktywny";
      klasa = "status-offline";
    } else if (minutyOdAktywnosci <= 10) {
      status = "Aktywny";
      klasa = "status-active";
      aktywnychLiczba++;
    } else {
      status = "Zaraz wracam";
      klasa = "status-away";
    }

    const opis = klasa === "status-offline"
      ? `ostatnio: ${formatRelativeTime(p.last_seen)}`
      : status;

    return `
      <div class="online-item ${klasa}">
        <span class="online-dot"></span>
        <div class="online-info">
          <div class="online-email">${escapeHtml(nazwaDla(p.email))}</div>
          <div class="online-status">${opis}</div>
        </div>
        ${isAdmin ? `<button type="button" class="online-edit-name" data-email="${escapeHtml(p.email)}" title="Zmień wyświetlaną nazwę">✎</button>` : ""}
      </div>
    `;
  }).join("");

  czatRoster.innerHTML = wpisy;
  czatBadge.hidden = aktywnychLiczba === 0;
  czatBadge.textContent = aktywnychLiczba;

  czatRoster.querySelectorAll(".online-edit-name").forEach((btn) => {
    btn.addEventListener("click", () => edytujNazweUzytkownika(btn.dataset.email));
  });
}

async function edytujNazweUzytkownika(email) {
  const obecna = profilesByEmail[email] || "";
  const nowaNazwa = window.prompt(`Nazwa wyświetlana dla ${email}:`, obecna);
  if (nowaNazwa === null) return;

  const { error } = await supabaseClient
    .from("profiles")
    .update({ display_name: nowaNazwa.trim() || null })
    .eq("email", email);

  if (error) {
    showToast("Nie udało się zapisać nazwy: " + error.message, true);
  } else {
    showToast("Nazwa zapisana.");
    await loadOnlineUsers();
    await loadCzat();
    await loadZgloszenia();
    render();
  }
}

// -------------------- START --------------------
checkSession();
initVersionCheck();

// -------------------- WYKRYWANIE NOWEJ WERSJI APLIKACJI --------------------

let loadedVersion = null;

async function fetchVersion() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.version;
  } catch {
    return null;
  }
}

async function initVersionCheck() {
  loadedVersion = await fetchVersion();
  setInterval(async () => {
    const nowa = await fetchVersion();
    if (nowa && loadedVersion && nowa !== loadedVersion) {
      newVersionBanner.hidden = false;
    }
  }, 90 * 1000);
}

newVersionRefreshBtn.addEventListener("click", () => location.reload());
