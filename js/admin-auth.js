// Admin auth layer — GoTrue (Supabase Auth) over plain fetch, no SDK.
// Mirrors the no-build, raw-fetch approach used by js/store.js for the public shop.
// The publishable/anon key is safe in client code; all writes stay RLS-bound and
// the authenticated session's JWT is what unlocks reads of inactive products.
const SUPABASE_URL = "https://hysikygygqzbmgkajpwo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2U9Dned6-ccj3tzQ-5xnWA_d1EddkQi";
const SB_AUTH = `${SUPABASE_URL}/auth/v1`;
const SB_REST = `${SUPABASE_URL}/rest/v1`;
const SESSION_KEY = "nelson_admin_session";
const EXPIRY_SKEW_S = 60; // refresh a minute early to avoid edge-of-expiry failures

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Surface GoTrue's various error shapes as one readable message.
function authError(data, fallback) {
  return (
    (data && (data.error_description || data.msg || data.error)) || fallback
  );
}

async function signIn(email, password) {
  const resp = await fetch(`${SB_AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(authError(data, "Login failed. Check your details."));
  }
  saveSession(data);
  return data;
}

async function refreshSession(refreshToken) {
  const resp = await fetch(`${SB_AUTH}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(authError(data, "Session refresh failed."));
  saveSession(data);
  return data;
}

// Returns a non-expired session, refreshing if needed, or null if not signed in.
async function getValidSession() {
  const session = loadSession();
  if (!session || !session.access_token) return null;

  const nowS = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at - EXPIRY_SKEW_S > nowS) {
    return session;
  }

  if (session.refresh_token) {
    try {
      return await refreshSession(session.refresh_token);
    } catch (e) {
      clearSession();
      return null;
    }
  }

  clearSession();
  return null;
}

async function signOut() {
  const session = loadSession();
  if (session && session.access_token) {
    try {
      await fetch(`${SB_AUTH}/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch (e) {
      // Best-effort server-side revoke; local session is cleared regardless.
    }
  }
  clearSession();
}

// === PASSWORD RECOVERY ===

// Send a reset email. The link returns the user to admin.html with a recovery
// token in the URL fragment. GoTrue returns 200 even for unknown emails (no
// account enumeration), so success here just means "the email was accepted".
async function requestPasswordReset(email) {
  const redirectTo = `${window.location.origin}/admin.html`;
  const resp = await fetch(
    `${SB_AUTH}/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  );
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(authError(data, "Couldn't send the reset email."));
  }
}

// Pull a recovery access token out of the URL fragment, if the reset link
// brought one (…#access_token=…&type=recovery). Returns the token or null.
function readRecoveryToken() {
  const hash = window.location.hash || "";
  if (hash.indexOf("type=recovery") === -1) return null;
  return new URLSearchParams(hash.replace(/^#/, "")).get("access_token");
}

// Strip the auth fragment so the token isn't left sitting in the address bar.
function clearUrlHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

// Set a new password using a recovery access token.
async function updatePassword(accessToken, newPassword) {
  const resp = await fetch(`${SB_AUTH}/user`, {
    method: "PUT",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(authError(data, "Couldn't update the password."));
  return data;
}

// PostgREST headers carrying the user JWT — the authenticated role can read
// inactive products that the anon key (public shop) cannot.
function authHeaders(session) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
  };
}
