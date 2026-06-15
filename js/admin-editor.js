// Card + postage editors (Phase 3). Modal forms that write to Supabase via
// js/admin-data.js. Depends on admin.js (esc, CATEGORY_LABELS) and admin-auth.js,
// all loaded before this file.

const SIZES = ["5x7", "A6"];
let cardEditCtx = { session: null, card: null, onSaved: null, mode: "edit" };
let postageCtx = { session: null, settings: null, onSaved: null };
// While true, the id field has been hand-edited so we stop auto-syncing it from
// the title (create mode only).
let slugTouched = false;

// Build a URL-safe slug id from free text (e.g. "Get Well Soon!" → "get-well-soon").
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function val(id) {
  return document.getElementById(id).value;
}
function checked(id) {
  return document.getElementById(id).checked;
}

function openModal(id) {
  document.getElementById(id).hidden = false;
  document.body.classList.add("modal-open");
}
function closeModal(id) {
  document.getElementById(id).hidden = true;
  document.body.classList.remove("modal-open");
}

function setEditorError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message || "";
  el.hidden = !message;
}

// === CARD EDITOR ===

function fillSelect(selectEl, entries, selected) {
  selectEl.innerHTML = entries
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
}

// Populate every editor field from a card-like object.
function fillCardFields(card) {
  document.getElementById("ce-title").value = card.title || "";
  document.getElementById("ce-description").value = card.description || "";
  document.getElementById("ce-price").value =
    card.price_gbp != null ? Number(card.price_gbp).toFixed(2) : "";
  fillSelect(
    document.getElementById("ce-size"),
    SIZES.map((s) => [s, s]),
    card.size || ""
  );
  document.getElementById("ce-gsm").value = card.gsm != null ? card.gsm : "";
  fillSelect(
    document.getElementById("ce-category"),
    Object.entries(CATEGORY_LABELS).filter(([slug]) => slug !== "all"),
    card.category || ""
  );
  document.getElementById("ce-stock").value =
    card.stock_qty != null ? card.stock_qty : "";
  document.getElementById("ce-sort").value =
    card.sort_order != null ? card.sort_order : "";
  document.getElementById("ce-bundle").checked = !!card.is_bundle;
  document.getElementById("ce-active").checked = !!card.active;
}

// Switch the modal's chrome between editing an existing card and creating one.
function setEditorMode(mode) {
  const isCreate = mode === "create";
  document.getElementById("ce-heading").textContent = isCreate
    ? "Add new card"
    : "Edit card";
  document.getElementById("ce-save").textContent = isCreate
    ? "Create card"
    : "Save changes";
  document.getElementById("ce-id-line").hidden = isCreate;
  document.getElementById("ce-id-field").hidden = !isCreate;
}

function openCardEditor(session, card, onSaved) {
  closeModal("postage-editor");
  cardEditCtx = { session, card, onSaved, mode: "edit" };
  document.getElementById("ce-id").textContent = card.id;
  fillCardFields(card);
  setEditorMode("edit");
  setEditorError("ce-error", "");
  openModal("card-editor");
  document.getElementById("ce-title").focus();
}

// Open the editor blank to create a new card. `defaults` may carry a suggested
// sort_order so new cards land at the end of the grid.
function openCardCreator(session, defaults, onCreated) {
  closeModal("postage-editor");
  cardEditCtx = { session, card: null, onSaved: onCreated, mode: "create" };
  slugTouched = false;
  fillCardFields({
    size: SIZES[0],
    gsm: 350,
    category: "",
    active: true,
    is_bundle: false,
    sort_order: defaults && defaults.sort_order != null ? defaults.sort_order : "",
  });
  document.getElementById("ce-id-input").value = "";
  setEditorMode("create");
  setEditorError("ce-error", "");
  openModal("card-editor");
  document.getElementById("ce-title").focus();
}

// In create mode, mirror the title into the id field until it's hand-edited.
function syncSlugFromTitle() {
  if (cardEditCtx.mode !== "create" || slugTouched) return;
  document.getElementById("ce-id-input").value = slugify(val("ce-title"));
}

// Validate + build the PATCH body. Throws Error with a friendly message.
function readCardPatch() {
  const title = val("ce-title").trim();
  const description = val("ce-description").trim();
  const priceRaw = val("ce-price").trim();
  const price = Number(priceRaw);
  const gsmRaw = val("ce-gsm").trim();
  const stockRaw = val("ce-stock").trim();
  const sortRaw = val("ce-sort").trim();

  if (!title) throw new Error("Title is required.");
  if (!description) throw new Error("Description is required.");
  if (!priceRaw || Number.isNaN(price) || price < 0)
    throw new Error("Enter a valid price (e.g. 3.50).");
  const sort_order = parseInt(sortRaw, 10);
  if (Number.isNaN(sort_order) || sort_order < 0)
    throw new Error("Sort order must be a whole number, 0 or more.");

  const gsm = gsmRaw === "" ? null : parseInt(gsmRaw, 10);
  if (gsm !== null && (Number.isNaN(gsm) || gsm < 0))
    throw new Error("GSM must be a whole number, or blank.");

  const stock_qty = stockRaw === "" ? null : parseInt(stockRaw, 10);
  if (stock_qty !== null && (Number.isNaN(stock_qty) || stock_qty < 0))
    throw new Error("Stock must be 0 or more, or blank for unlimited.");

  return {
    title,
    description,
    price_gbp: Number(price.toFixed(2)),
    size: val("ce-size") || null,
    gsm,
    category: val("ce-category") || null,
    stock_qty,
    sort_order,
    is_bundle: checked("ce-bundle"),
    active: checked("ce-active"),
  };
}

async function handleCardSave(event) {
  event.preventDefault();
  setEditorError("ce-error", "");
  const isCreate = cardEditCtx.mode === "create";
  const btn = document.getElementById("ce-save");
  let patch;
  try {
    patch = readCardPatch();
    if (isCreate) {
      const id = slugify(val("ce-id-input"));
      if (!id)
        throw new Error("Enter a card ID using letters, numbers and hyphens.");
      patch.id = id;
    }
  } catch (e) {
    setEditorError("ce-error", e.message);
    return;
  }
  btn.disabled = true;
  btn.textContent = isCreate ? "Creating…" : "Saving…";
  try {
    let row;
    if (isCreate) {
      if (await productIdExists(cardEditCtx.session, patch.id))
        throw new Error(`The ID “${patch.id}” is already taken — choose another.`);
      row = await insertProduct(cardEditCtx.session, patch);
    } else {
      row = await updateProduct(cardEditCtx.session, cardEditCtx.card.id, patch);
    }
    if (cardEditCtx.onSaved) cardEditCtx.onSaved(row);
    closeModal("card-editor");
  } catch (e) {
    if (e.message === "UNAUTHORISED") {
      setEditorError("ce-error", "Your session expired. Please sign in again.");
    } else {
      setEditorError("ce-error", e.message);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = isCreate ? "Create card" : "Save changes";
  }
}

// === POSTAGE EDITOR ===

function poundsPreview() {
  const std = parseInt(val("pe-uk"), 10);
  const free = parseInt(val("pe-free"), 10);
  const intl = parseInt(val("pe-intl"), 10);
  const fmt = (p) => (Number.isNaN(p) ? "—" : `£${(p / 100).toFixed(2)}`);
  document.getElementById("pe-preview").innerHTML =
    `UK standard: <strong>${fmt(std)}</strong> · ` +
    `free over <strong>${Number.isNaN(free) ? "—" : free}</strong> cards · ` +
    `International: <strong>${fmt(intl)}</strong>`;
}

async function openPostageEditor(session, onSaved) {
  closeModal("card-editor");
  setEditorError("pe-error", "");
  openModal("postage-editor");
  document.getElementById("pe-body").hidden = true;
  document.getElementById("pe-loading").hidden = false;
  try {
    const settings = await fetchSettings(session);
    if (!settings) throw new Error("No postage settings row found.");
    postageCtx = { session, settings, onSaved };
    document.getElementById("pe-uk").value = settings.uk_standard_pence;
    document.getElementById("pe-free").value = settings.uk_free_threshold;
    document.getElementById("pe-intl").value = settings.intl_pence;
    poundsPreview();
    document.getElementById("pe-loading").hidden = true;
    document.getElementById("pe-body").hidden = false;
  } catch (e) {
    document.getElementById("pe-loading").hidden = true;
    setEditorError("pe-error", e.message);
  }
}

function readPostagePatch() {
  const uk = parseInt(val("pe-uk"), 10);
  const free = parseInt(val("pe-free"), 10);
  const intl = parseInt(val("pe-intl"), 10);
  if ([uk, free, intl].some((n) => Number.isNaN(n) || n < 0))
    throw new Error("All postage values must be whole numbers, 0 or more.");
  return { uk_standard_pence: uk, uk_free_threshold: free, intl_pence: intl };
}

async function handlePostageSave(event) {
  event.preventDefault();
  setEditorError("pe-error", "");
  const btn = document.getElementById("pe-save");
  let patch;
  try {
    patch = readPostagePatch();
  } catch (e) {
    setEditorError("pe-error", e.message);
    return;
  }
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    await updateSettings(postageCtx.session, postageCtx.settings.id, patch);
    if (postageCtx.onSaved) postageCtx.onSaved(patch);
    closeModal("postage-editor");
  } catch (e) {
    setEditorError(
      "pe-error",
      e.message === "UNAUTHORISED"
        ? "Your session expired. Please sign in again."
        : e.message
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Save postage";
  }
}

function initEditors() {
  document.getElementById("card-editor-form").addEventListener("submit", handleCardSave);
  document.getElementById("ce-title").addEventListener("input", syncSlugFromTitle);
  document.getElementById("ce-id-input").addEventListener("input", () => {
    slugTouched = true;
  });
  document.getElementById("postage-editor-form").addEventListener("submit", handlePostageSave);
  document.getElementById("pe-uk").addEventListener("input", poundsPreview);
  document.getElementById("pe-free").addEventListener("input", poundsPreview);
  document.getElementById("pe-intl").addEventListener("input", poundsPreview);

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => closeModal(el.getAttribute("data-close-modal")));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeModal("card-editor");
    closeModal("postage-editor");
  });
}
