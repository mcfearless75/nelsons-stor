// Supabase Storage layer for the media manager (Phase 4).
// Depends on js/admin-auth.js: SUPABASE_URL, SUPABASE_ANON_KEY.
// Bucket is public-read; writes require the authenticated JWT.
const STORAGE_BUCKET = "card-media";
const SB_STORAGE = `${SUPABASE_URL}/storage/v1`;

// Public URL for an object path within the bucket (e.g. "my-card/uuid.jpg").
function publicUrl(path) {
  return `${SB_STORAGE}/object/public/${STORAGE_BUCKET}/${path}`;
}

// Recover the in-bucket object path from a stored public URL, or null if the
// URL doesn't belong to this bucket (e.g. an external/placeholder URL).
function storagePathFromUrl(url) {
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const i = String(url || "").indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

// Upload a File/Blob to the bucket; returns its public URL on success.
async function uploadObject(session, path, file) {
  const resp = await fetch(`${SB_STORAGE}/object/${STORAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (resp.status === 401) throw new Error("UNAUTHORISED");
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Upload failed (${resp.status}). ${detail.slice(0, 140)}`);
  }
  return publicUrl(path);
}

// Best-effort delete of an object. Missing objects (404) are treated as success
// so a half-orphaned record can still be cleaned up.
async function deleteObject(session, path) {
  if (!path) return;
  try {
    await fetch(`${SB_STORAGE}/object/${STORAGE_BUCKET}/${path}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch (e) {
    // Orphaned file is acceptable; the DB row (what the shop reads) is gone.
  }
}
