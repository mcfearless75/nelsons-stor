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
