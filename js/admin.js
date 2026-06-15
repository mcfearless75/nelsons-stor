// Admin dashboard controller — Phase 2: login + read-only card list.
// Editing, media, add/delete and inventory land in later phases.
// Depends on js/admin-auth.js (loaded first): SB_REST, getValidSession,
// signIn, signOut, authHeaders.

const CATEGORY_LABELS = {
  all: "All categories",
  christmas: "Christmas",
  birthday: "Birthday",
  valentine: "Valentine's",
  "fathers-day": "Father's Day",
  "mothers-day": "Mother's Day",
  baby: "New Baby",
  sympathy: "Sympathy & Pet Loss",
  "get-well": "Get Well Soon",
  "thinking-of-you": "Thinking of You",
  "st-patricks": "St Patrick's",
  general: "General",
};

let SESSION = null;
let CARDS = [];

function esc(s) {
  return String(s == null ? "" : s).replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
}

// Lowest-sort_order image is the primary/grid thumbnail (matches store.js).
function primaryImage(rows) {
  const images = (Array.isArray(rows) ? rows : [])
    .filter((m) => m.type === "image")
    .sort((a, b) => a.sort_order - b.sort_order);
  return images.length ? images[0].url : "";
}

// Authenticated read of the WHOLE catalogue, including inactive cards.
async function fetchAllCards(session) {
  const url =
    `${SB_REST}/products?order=sort_order` +
    `&select=id,title,price_gbp,size,category,is_bundle,active,stock_qty,sort_order,product_media(type,url,sort_order)`;
  const resp = await fetch(url, { headers: authHeaders(session) });
  if (resp.status === 401) {
    throw new Error("UNAUTHORISED");
  }
  if (!resp.ok) {
    throw new Error(`Card list fetch failed: ${resp.status}`);
  }
  const rows = await resp.json();
  return rows.map((p) => ({ ...p, image: primaryImage(p.product_media) }));
}

function stockBadge(card) {
  if (card.stock_qty == null) return '<span class="abadge abadge--ok">Unlimited</span>';
  if (card.stock_qty === 0) return '<span class="abadge abadge--out">Sold out</span>';
  return `<span class="abadge abadge--low">${card.stock_qty} in stock</span>`;
}

function cardRow(card) {
  const thumb = card.image
    ? `<img src="${esc(card.image)}" alt="" loading="lazy" />`
    : '<span class="card-thumb__ph">🐾</span>';
  return `
    <div class="card-row${card.active ? "" : " card-row--inactive"}">
      <div class="card-thumb">${thumb}</div>
      <div class="card-row__main">
        <div class="card-row__title">${esc(card.title)}</div>
        <div class="card-row__id">${esc(card.id)}</div>
      </div>
      <div class="card-row__cat">${esc(CATEGORY_LABELS[card.category] || card.category)}</div>
      <div class="card-row__price">£${Number(card.price_gbp).toFixed(2)}</div>
      <div class="card-row__size">${esc(card.size)}</div>
      <div class="card-row__flags">
        ${card.active ? '<span class="abadge abadge--ok">Live</span>' : '<span class="abadge abadge--muted">Hidden</span>'}
        ${card.is_bundle ? '<span class="abadge abadge--info">Bundle</span>' : ""}
        ${stockBadge(card)}
      </div>
      <button class="card-row__edit btn-ghost" type="button" data-edit="${esc(card.id)}">Edit</button>
    </div>`;
}

function applyFilters() {
  const q = (document.getElementById("admin-search").value || "")
    .trim()
    .toLowerCase();
  const cat = document.getElementById("admin-cat").value;
  return CARDS.filter((c) => {
    const matchesCat = cat === "all" || c.category === cat;
    const matchesQ =
      !q ||
      c.title.toLowerCase().includes(q) ||
      String(c.id).toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });
}

function renderList() {
  const list = document.getElementById("card-list");
  const count = document.getElementById("card-count");
  const filtered = applyFilters();
  count.textContent = `${filtered.length} of ${CARDS.length} card${CARDS.length === 1 ? "" : "s"}`;
  list.innerHTML = filtered.length
    ? filtered.map(cardRow).join("")
    : '<p class="admin-empty">No cards match that search.</p>';
}

// Merge a saved product row back into local state, preserving media (which the
// PATCH response doesn't include), then re-render.
function applySavedCard(row) {
  const idx = CARDS.findIndex((c) => c.id === row.id);
  if (idx === -1) return;
  const existing = CARDS[idx];
  CARDS[idx] = {
    ...existing,
    ...row,
    product_media: existing.product_media,
    image: existing.image,
  };
  renderList();
}

function handleListClick(event) {
  const btn = event.target.closest("[data-edit]");
  if (!btn) return;
  const card = CARDS.find((c) => c.id === btn.getAttribute("data-edit"));
  if (card) openCardEditor(SESSION, card, applySavedCard);
}

function buildCategoryOptions() {
  const sel = document.getElementById("admin-cat");
  sel.innerHTML = Object.entries(CATEGORY_LABELS)
    .map(([slug, label]) => `<option value="${slug}">${esc(label)}</option>`)
    .join("");
}

function showView(view) {
  document.getElementById("login-view").hidden = view !== "login";
  document.getElementById("dashboard-view").hidden = view !== "dashboard";
  document.getElementById("logout-btn").hidden = view !== "dashboard";
}

function setLoginError(message) {
  const el = document.getElementById("login-error");
  el.textContent = message || "";
  el.hidden = !message;
}

async function loadDashboard() {
  const status = document.getElementById("list-status");
  status.textContent = "Loading cards…";
  status.hidden = false;
  try {
    CARDS = await fetchAllCards(SESSION);
    status.hidden = true;
    renderList();
  } catch (e) {
    if (e.message === "UNAUTHORISED") {
      await handleSignOut();
      return;
    }
    status.textContent = "Couldn't load the cards. Please refresh in a moment.";
    status.hidden = false;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setLoginError("");
  const btn = document.getElementById("login-submit");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) {
    setLoginError("Enter your email and password.");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    SESSION = await signIn(email, password);
    document.getElementById("login-password").value = "";
    showView("dashboard");
    await loadDashboard();
  } catch (e) {
    setLoginError(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
}

async function handleSignOut() {
  await signOut();
  SESSION = null;
  CARDS = [];
  setLoginError("");
  showView("login");
}

async function initAdmin() {
  buildCategoryOptions();
  initEditors();
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("logout-btn").addEventListener("click", handleSignOut);
  document.getElementById("admin-search").addEventListener("input", renderList);
  document.getElementById("admin-cat").addEventListener("change", renderList);
  document.getElementById("card-list").addEventListener("click", handleListClick);
  document
    .getElementById("postage-btn")
    .addEventListener("click", () => openPostageEditor(SESSION));

  SESSION = await getValidSession();
  if (SESSION) {
    showView("dashboard");
    await loadDashboard();
  } else {
    showView("login");
  }
}

document.addEventListener("DOMContentLoaded", initAdmin);
