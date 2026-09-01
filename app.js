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

// -------------------- ELEMENTY DOM --------------------
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
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
const klienciTbody = document.getElementById("klienci-tbody");
const emptyStateKlienci = document.getElementById("empty-state-klienci");

const modal = document.getElementById("lead-modal");
const modalTitle = document.getElementById("modal-title");
const leadForm = document.getElementById("lead-form");
const modalCancel = document.getElementById("modal-cancel");

const toast = document.getElementById("toast");
const newVersionBanner = document.getElementById("new-version-banner");
const newVersionRefreshBtn = document.getElementById("new-version-refresh");

const zgloszeniaToggle = document.getElementById("zgloszenia-toggle");
const zgloszeniaBadge = document.getElementById("zgloszenia-badge");
const zgloszeniaPanel = document.getElementById("zgloszenia-panel");
const zgloszeniaClose = document.getElementById("zgloszenia-close");
const zgloszeniaForm = document.getElementById("zgloszenia-form");
const zgloszeniaList = document.getElementById("zgloszenia-list");

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

function escapeHtml(str) {
  if (!str) return "";
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
  loginBtn.disabled = true;
  loginBtn.textContent = "Wysyłam…";

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });

  loginBtn.disabled = false;
  loginBtn.textContent = "Wyślij link logowania";

  loginMessage.hidden = false;
  if (error) {
    loginMessage.textContent = "Nie udało się wysłać linku: " + error.message;
    loginMessage.classList.add("login-message-error");
  } else {
    loginMessage.textContent = "Sprawdź skrzynkę " + email + " i kliknij link logowania.";
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
    showApp(session);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
  zgloszeniaToggle.hidden = true;
  zgloszeniaPanel.hidden = true;
  czatToggle.hidden = true;
  czatWidget.hidden = true;
  stopHeartbeat();
}

function showApp(session) {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  userEmailEl.textContent = session.user.email;
  currentUserEmail = session.user.email;
  zgloszeniaToggle.hidden = false;
  czatToggle.hidden = false;
  loadLeady();
  loadZgloszenia();
  loadCzat();
  startHeartbeat();
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session) {
    showApp(session);
  } else if (event === "SIGNED_OUT") {
    showLogin();
  }
});

// -------------------- ZAKŁADKI LEADY / KLIENCI --------------------

document.querySelectorAll("#view-tabs .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentTab = btn.dataset.tab;
    document.querySelectorAll("#view-tabs .tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    viewLeady.hidden = currentTab !== "leady";
    viewKlienci.hidden = currentTab !== "klienci";
    statusFilter.hidden = currentTab !== "leady";
    fieldFilters.hidden = currentTab !== "leady";
    addLeadBtn.hidden = currentTab !== "leady";
    importCsvBtn.hidden = currentTab !== "leady";
    render();
  });
});

function render() {
  if (currentTab === "leady") {
    renderTable();
  } else {
    renderKlienciTable();
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

function renderStats() {
  const leadyOnly = currentLeady.filter((l) => !l.numer_klienta);
  const counts = {};
  leadyOnly.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

  statsRow.innerHTML = Object.entries(STATUS_LABELS).map(([key, label]) => `
    <div class="stat-pill" data-status="${key}">
      <span class="stat-count">${counts[key] || 0}</span>
      <span class="stat-label">${label}</span>
    </div>
  `).join("");

  statsRow.querySelectorAll(".stat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      statusFilter.value = pill.dataset.status;
      renderTable();
    });
  });
}

function getFilteredLeady() {
  const q = searchInput.value.trim().toLowerCase();
  const statusVal = statusFilter.value;

  return currentLeady.filter((l) => {
    if (l.numer_klienta) return false;
    if (statusVal && l.status !== statusVal) return false;
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
      <td colspan="6">
        <div class="details-grid">
          <div><span class="details-label">NIP</span><div>${escapeHtml(lead.nip || "—")}</div></div>
          <div><span class="details-label">Telefon</span><div>${escapeHtml(lead.telefon || "—")}</div></div>
          <div><span class="details-label">E-mail</span><div>${escapeHtml(lead.email || "—")}</div></div>
          <div><span class="details-label">Strona www</span><div>${renderWwwCell(lead.www)}</div></div>
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

  tbody.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      await updateLeadStatus(e.target.dataset.id, e.target.value);
    });
  });

  tbody.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.id));
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
      <td colspan="6">
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
  } else {
    modalTitle.textContent = "Dodaj firmę";
    populatePrzypisaneSelect("");
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
    status: document.getElementById("f-status").value,
    przypisane_do: document.getElementById("f-przypisane").value.trim() || null,
  };

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

// -------------------- PANEL ZGŁOSZEŃ (prawa strona) --------------------

zgloszeniaToggle.addEventListener("click", () => {
  zgloszeniaPanel.hidden = !zgloszeniaPanel.hidden;
});
zgloszeniaClose.addEventListener("click", () => { zgloszeniaPanel.hidden = true; });

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
    zgloszeniaList.innerHTML = `<p class="zgloszenia-loading">Błąd wczytywania zgłoszeń.</p>`;
    return;
  }

  const otwarte = (data || []).filter((z) => z.status === "otwarte").length;
  zgloszeniaBadge.hidden = otwarte === 0;
  zgloszeniaBadge.textContent = otwarte;

  renderZgloszeniaList(data || []);
}

const TYP_LABELS = { blad: "Błąd", pomysl: "Pomysł", inne: "Inne" };
let komentarzeCache = {};

function renderZgloszeniaList(zgloszenia) {
  if (zgloszenia.length === 0) {
    zgloszeniaList.innerHTML = `<p class="zgloszenia-loading">Brak zgłoszeń.</p>`;
    return;
  }

  const isAdmin = currentUserEmail === ADMIN_EMAIL;

  zgloszeniaList.innerHTML = zgloszenia.map((z) => {
    const mozeOznaczyc = isAdmin || z.autor === currentUserEmail;
    const dataStr = new Date(z.utworzono_o).toLocaleString("pl-PL");
    return `
      <div class="zgloszenie-item zgloszenie-${z.status}">
        <div class="zgloszenie-meta">
          <span class="zgloszenie-typ">${TYP_LABELS[z.typ] || z.typ}</span>
          <span>${escapeHtml(nazwaDla(z.autor))} · ${dataStr}</span>
        </div>
        <div class="zgloszenie-tresc">${escapeHtml(z.tresc)}</div>
        <div class="zgloszenie-footer">
          <span class="zgloszenie-status-label">${z.status === "zrobione" ? "✓ Zrobione" : "Otwarte"}</span>
          <div class="zgloszenie-footer-actions">
            <button type="button" class="zgloszenie-reply-toggle" data-id="${z.id}">Odpowiedz</button>
            ${mozeOznaczyc && z.status === "otwarte"
              ? `<button type="button" class="btn-ghost zgloszenie-done-btn" data-id="${z.id}">Oznacz jako zrobione</button>`
              : ""}
          </div>
        </div>
        <div class="zgloszenie-thread" id="zgloszenie-thread-${z.id}" hidden>
          <div class="zgloszenie-komentarze" id="zgloszenie-komentarze-${z.id}">
            <p class="zgloszenia-loading">Wczytuję…</p>
          </div>
          <form class="zgloszenie-komentarz-form" data-id="${z.id}">
            <textarea rows="2" placeholder="Napisz odpowiedź…" required></textarea>
            <button type="submit" class="btn-primary">Wyślij</button>
          </form>
        </div>
      </div>
    `;
  }).join("");

  zgloszeniaList.querySelectorAll(".zgloszenie-done-btn").forEach((btn) => {
    btn.addEventListener("click", () => oznaczZgloszenieZrobione(btn.dataset.id));
  });

  zgloszeniaList.querySelectorAll(".zgloszenie-reply-toggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const thread = document.getElementById(`zgloszenie-thread-${id}`);
      thread.hidden = !thread.hidden;
      if (!thread.hidden && !komentarzeCache[id]) {
        await loadKomentarze(id);
      }
    });
  });

  zgloszeniaList.querySelectorAll(".zgloszenie-komentarz-form").forEach((form) => {
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
    <div class="zgloszenie-komentarz">
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
