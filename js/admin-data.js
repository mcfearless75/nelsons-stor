// Admin write layer — authenticated PostgREST mutations (Phase 3).
// Depends on js/admin-auth.js: SB_REST, authHeaders. All writes require the
// authenticated JWT; RLS rejects the anon key, so these only work when signed in.

function writeHeaders(session) {
  return {
    ...authHeaders(session),
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function postgrestError(resp) {
  const data = await resp.json().catch(() => ({}));
  return data.message || data.hint || `Request failed: ${resp.status}`;
}

// True if a product with this id (slug) already exists. Used to keep new-card
// ids unique before inserting.
async function productIdExists(session, id) {
  const resp = await fetch(
    `${SB_REST}/products?id=eq.${encodeURIComponent(id)}&select=id`,
    { headers: authHeaders(session) }
  );
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
  const rows = await resp.json();
  return rows.length > 0;
}

// Insert a brand-new product. Returns the created row.
async function insertProduct(session, row) {
  const resp = await fetch(`${SB_REST}/products`, {
    method: "POST",
    headers: writeHeaders(session),
    body: JSON.stringify(row),
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (resp.status === 409)
    throw new Error("That ID is already taken — choose another.");
  if (!resp.ok) throw new Error(await postgrestError(resp));
  const rows = await resp.json();
  return rows[0];
}

// Hard-delete a product row. Media rows + Storage objects are cleared by the
// caller first (see deleteCardCompletely in admin.js).
async function deleteProduct(session, id) {
  const resp = await fetch(`${SB_REST}/products?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(session),
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
}

// Delete every media row for a product in one call (Storage objects removed
// separately). Done before deleting the product so it works with or without an
// ON DELETE CASCADE on the FK.
async function deleteProductMedia(session, productId) {
  const resp = await fetch(
    `${SB_REST}/product_media?product_id=eq.${encodeURIComponent(productId)}`,
    { method: "DELETE", headers: authHeaders(session) }
  );
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
}

// Patch a product's editable fields. Returns the updated row (product columns only).
async function updateProduct(session, id, patch) {
  const resp = await fetch(
    `${SB_REST}/products?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", headers: writeHeaders(session), body: JSON.stringify(patch) }
  );
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
  const rows = await resp.json();
  return rows[0];
}

// The postage settings live in a single row.
async function fetchSettings(session) {
  const resp = await fetch(`${SB_REST}/settings?limit=1`, {
    headers: authHeaders(session),
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
  const rows = await resp.json();
  return rows[0] || null;
}

async function updateSettings(session, id, patch) {
  const resp = await fetch(`${SB_REST}/settings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: writeHeaders(session),
    body: JSON.stringify(patch),
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
  const rows = await resp.json();
  return rows[0];
}

// === MEDIA (Phase 4) ===

// All media rows for a product, ordered. Includes id (needed for edit/delete).
async function fetchProductMedia(session, productId) {
  const url =
    `${SB_REST}/product_media?product_id=eq.${encodeURIComponent(productId)}` +
    `&order=sort_order&select=id,product_id,type,url,sort_order`;
  const resp = await fetch(url, { headers: authHeaders(session) });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
  return resp.json();
}

async function insertMedia(session, row) {
  const resp = await fetch(`${SB_REST}/product_media`, {
    method: "POST",
    headers: writeHeaders(session),
    body: JSON.stringify(row),
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
  const rows = await resp.json();
  return rows[0];
}

async function updateMediaOrder(session, id, sortOrder) {
  const resp = await fetch(`${SB_REST}/product_media?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: writeHeaders(session),
    body: JSON.stringify({ sort_order: sortOrder }),
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
}

async function deleteMedia(session, id) {
  const resp = await fetch(`${SB_REST}/product_media?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(session),
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) throw new Error(await postgrestError(resp));
}
