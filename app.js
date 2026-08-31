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
const tbody = document.getElementById("leady-tbody");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const statsRow = document.getElementById("stats-row");

const addLeadBtn = document.getElementById("add-lead-btn");
const importCsvBtn = document.getElementById("import-csv-btn");
const csvInput = document.getElementById("csv-input");

const modal = document.getElementById("lead-modal");
const modalTitle = document.getElementById("modal-title");
const leadForm = document.getElementById("lead-form");
const modalCancel = document.getElementById("modal-cancel");

const toast = document.getElementById("toast");

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
}

function showApp(session) {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  userEmailEl.textContent = session.user.email;
  loadLeady();
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session) {
    showApp(session);
  } else if (event === "SIGNED_OUT") {
    showLogin();
  }
});

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
  renderTable();
}

function renderStats() {
  const counts = {};
  currentLeady.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

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
    if (statusVal && l.status !== statusVal) return false;
    if (!q) return true;
    const haystack = [l.nazwa_firmy, l.nip, l.lokalizacja, l.telefon, l.email, l.osoba_kontaktowa]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

function renderTable() {
  const filtered = getFilteredLeady();
  emptyState.hidden = filtered.length !== 0;
  tbody.innerHTML = "";

  filtered.forEach((lead) => {
    const tr = document.createElement("tr");
    tr.className = "row-main";
    tr.innerHTML = `
      <td class="cell-nazwa cell-clickable" data-toggle="${lead.id}" title="${escapeHtml(lead.nazwa_firmy)}">${escapeHtml(lead.nazwa_firmy)}</td>
      <td>${escapeHtml(lead.lokalizacja || "—")}</td>
      <td>
        <select class="status-select status-${lead.status}" data-id="${lead.id}">
          ${Object.entries(STATUS_LABELS).map(([key, label]) =>
            `<option value="${key}" ${lead.status === key ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
      </td>
      <td>${escapeHtml(lead.przypisane_do || "—")}</td>
      <td class="cell-actions"><button class="btn-edit" data-id="${lead.id}">Edytuj</button> <button class="btn-delete" data-id="${lead.id}" data-nazwa="${escapeHtml(lead.nazwa_firmy)}">Usuń</button></td>
    `;
    tbody.appendChild(tr);

    const trDetails = document.createElement("tr");
    trDetails.className = "row-details";
    trDetails.hidden = true;
    trDetails.dataset.detailsFor = lead.id;
    trDetails.innerHTML = `
      <td colspan="5">
        <div class="details-grid">
          <div><span class="details-label">NIP</span><div>${escapeHtml(lead.nip || "—")}</div></div>
          <div><span class="details-label">Telefon</span><div>${escapeHtml(lead.telefon || "—")}</div></div>
          <div><span class="details-label">E-mail</span><div>${escapeHtml(lead.email || "—")}</div></div>
          <div><span class="details-label">Strona www</span><div>${renderWwwCell(lead.www)}</div></div>
          <div class="details-notatki"><span class="details-label">Notatki</span><div>${escapeHtml(lead.notatki || "—")}</div></div>
        </div>
      </td>
    `;
    tbody.appendChild(trDetails);
  });

  tbody.querySelectorAll(".cell-clickable").forEach((cell) => {
    cell.addEventListener("click", () => {
      const details = tbody.querySelector(`.row-details[data-details-for="${cell.dataset.toggle}"]`);
      if (details) details.hidden = !details.hidden;
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
}

searchInput.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);

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
    renderTable();
    showToast("Firma usunięta z listy.");
  }
}

// -------------------- MODAL: DODAWANIE / EDYCJA --------------------

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
    document.getElementById("f-status").value = lead.status || "nowy";
    document.getElementById("f-przypisane").value = lead.przypisane_do || "";
    document.getElementById("f-notatki").value = lead.notatki || "";
  } else {
    modalTitle.textContent = "Dodaj firmę";
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
    status: document.getElementById("f-status").value,
    przypisane_do: document.getElementById("f-przypisane").value.trim() || null,
    notatki: document.getElementById("f-notatki").value.trim() || null,
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

// -------------------- START --------------------
checkSession();
