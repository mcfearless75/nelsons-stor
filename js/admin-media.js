// Media manager modal (Phase 4): upload / remove / reorder / set-primary for a
// card's images and video. Operations apply immediately to Supabase Storage and
// the product_media table. Depends on admin-auth.js, admin-data.js,
// admin-storage.js, and admin.js (esc), all loaded before this file.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

let mediaCtx = { session: null, card: null, onChanged: null, media: [], busy: false };

function mmStatus(message) {
  const el = document.getElementById("mm-status");
  el.textContent = message || "";
  el.hidden = !message;
}
function mmError(message) {
  const el = document.getElementById("mm-error");
  el.textContent = message || "";
  el.hidden = !message;
}

function fileExt(file) {
  const fromName = (file.name.split(".").pop() || "").toLowerCase();
  if (fromName && fromName !== file.name.toLowerCase() && fromName.length <= 5) {
    return fromName;
  }
  const mimeExt = (file.type || "").split("/")[1];
  return (mimeExt || "bin").toLowerCase();
}

function mediaTypeOf(file) {
  if ((file.type || "").startsWith("video/")) return "video";
  if ((file.type || "").startsWith("image/")) return "image";
  return null;
}

// Index of the primary image = first image in sort order (matches the shop).
function primaryIndex(media) {
  return media.findIndex((m) => m.type === "image");
}

function renderStrip() {
  const strip = document.getElementById("mm-strip");
  const media = mediaCtx.media;
  if (!media.length) {
    strip.innerHTML = '<p class="mm-empty">No media yet. Add images or a video below.</p>';
    return;
  }
  const primary = primaryIndex(media);
  const last = media.length - 1;
  strip.innerHTML = media
    .map((m, i) => {
      const isImage = m.type === "image";
      const thumb = isImage
        ? `<img src="${esc(m.url)}" alt="" loading="lazy" />`
        : `<video src="${esc(m.url)}" muted preload="metadata"></video>`;
      const flags =
        (i === primary ? '<span class="mm-flag mm-flag--primary">Primary</span>' : "") +
        (!isImage ? '<span class="mm-flag mm-flag--video">Video</span>' : "");
      return `
      <div class="mm-tile" data-i="${i}">
        <div class="mm-tile__media">${thumb}${flags}</div>
        <div class="mm-tile__btns">
          <button type="button" data-act="primary" title="Set as primary image" ${isImage && i !== primary ? "" : "disabled"}>★</button>
          <button type="button" data-act="left" title="Move earlier" ${i === 0 ? "disabled" : ""}>◀</button>
          <button type="button" data-act="right" title="Move later" ${i === last ? "disabled" : ""}>▶</button>
          <button type="button" data-act="del" class="mm-del" title="Remove">✕</button>
        </div>
      </div>`;
    })
    .join("");
}

function setBusy(busy, message) {
  mediaCtx.busy = busy;
  document.getElementById("mm-file").disabled = busy;
  document.getElementById("mm-dropzone").classList.toggle("is-busy", busy);
  mmStatus(busy ? message || "Working…" : "");
}

function notifyChanged() {
  if (mediaCtx.onChanged) mediaCtx.onChanged(mediaCtx.card.id, mediaCtx.media);
}

async function loadMedia() {
  mmError("");
  setBusy(true, "Loading media…");
  try {
    mediaCtx.media = await fetchProductMedia(mediaCtx.session, mediaCtx.card.id);
    renderStrip();
  } catch (e) {
    mmError(e.message === "UNAUTHORISED" ? "Your session expired. Sign in again." : e.message);
  } finally {
    setBusy(false);
  }
}

// Renumber sort_order to match the current array order; persist only changes.
async function normaliseOrder() {
  for (let i = 0; i < mediaCtx.media.length; i++) {
    const m = mediaCtx.media[i];
    if (m.sort_order !== i) {
      await updateMediaOrder(mediaCtx.session, m.id, i);
      m.sort_order = i;
    }
  }
}

function moveItem(from, to) {
  const arr = mediaCtx.media;
  if (to < 0 || to >= arr.length) return;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
}

async function reorder(from, to) {
  if (mediaCtx.busy) return;
  setBusy(true, "Saving order…");
  mmError("");
  try {
    moveItem(from, to);
    await normaliseOrder();
    renderStrip();
    notifyChanged();
  } catch (e) {
    mmError(e.message === "UNAUTHORISED" ? "Your session expired. Sign in again." : e.message);
    await loadMedia();
  } finally {
    setBusy(false);
  }
}

async function removeMedia(index) {
  if (mediaCtx.busy) return;
  const m = mediaCtx.media[index];
  if (!m) return;
  if (!window.confirm("Remove this media item? This can't be undone.")) return;
  setBusy(true, "Removing…");
  mmError("");
  try {
    await deleteMedia(mediaCtx.session, m.id);
    await deleteObject(mediaCtx.session, storagePathFromUrl(m.url));
    mediaCtx.media.splice(index, 1);
    await normaliseOrder();
    renderStrip();
    notifyChanged();
  } catch (e) {
    mmError(e.message === "UNAUTHORISED" ? "Your session expired. Sign in again." : e.message);
    await loadMedia();
  } finally {
    setBusy(false);
  }
}

function validateFile(file) {
  const type = mediaTypeOf(file);
  if (!type) return `“${file.name}” isn't an image or video — skipped.`;
  const cap = type === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    return `“${file.name}” is too large (max ${type === "video" ? "50" : "10"}MB) — skipped.`;
  }
  return null;
}

async function handleFiles(fileList) {
  if (mediaCtx.busy) return;
  const files = Array.from(fileList || []);
  if (!files.length) return;
  mmError("");
  const skipped = [];
  const valid = [];
  files.forEach((f) => {
    const problem = validateFile(f);
    if (problem) skipped.push(problem);
    else valid.push(f);
  });

  setBusy(true, `Uploading 0/${valid.length}…`);
  try {
    for (let n = 0; n < valid.length; n++) {
      const file = valid[n];
      mmStatus(`Uploading ${n + 1}/${valid.length}…`);
      const type = mediaTypeOf(file);
      const path = `${mediaCtx.card.id}/${crypto.randomUUID()}.${fileExt(file)}`;
      const url = await uploadObject(mediaCtx.session, path, file);
      const row = await insertMedia(mediaCtx.session, {
        product_id: mediaCtx.card.id,
        type,
        url,
        sort_order: mediaCtx.media.length,
      });
      mediaCtx.media.push(row);
    }
    renderStrip();
    notifyChanged();
  } catch (e) {
    mmError(e.message === "UNAUTHORISED" ? "Your session expired. Sign in again." : e.message);
    await loadMedia();
  } finally {
    setBusy(false);
    if (skipped.length) mmError(skipped.join(" "));
  }
}

function handleStripClick(event) {
  const btn = event.target.closest("button[data-act]");
  if (!btn || btn.disabled) return;
  const tile = btn.closest(".mm-tile");
  const i = parseInt(tile.getAttribute("data-i"), 10);
  const act = btn.getAttribute("data-act");
  if (act === "primary") reorder(i, 0);
  else if (act === "left") reorder(i, i - 1);
  else if (act === "right") reorder(i, i + 1);
  else if (act === "del") removeMedia(i);
}

function openMediaManager(session, card, onChanged) {
  if (typeof closeModal === "function") {
    closeModal("card-editor");
    closeModal("postage-editor");
  }
  mediaCtx = { session, card, onChanged, media: [], busy: false };
  document.getElementById("mm-title").textContent = card.title || card.id;
  document.getElementById("mm-file").value = "";
  mmError("");
  document.getElementById("mm-strip").innerHTML = "";
  document.getElementById("media-manager").hidden = false;
  document.body.classList.add("modal-open");
  loadMedia();
}

function initMediaManager() {
  document.getElementById("mm-strip").addEventListener("click", handleStripClick);
  document.getElementById("mm-file").addEventListener("change", (e) => handleFiles(e.target.files));

  const dz = document.getElementById("mm-dropzone");
  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("is-over");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("is-over");
    })
  );
  dz.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });

  document.querySelectorAll('[data-close-modal="media-manager"]').forEach((el) =>
    el.addEventListener("click", () => {
      document.getElementById("media-manager").hidden = true;
      document.body.classList.remove("modal-open");
    })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("media-manager").hidden) {
      document.getElementById("media-manager").hidden = true;
      document.body.classList.remove("modal-open");
    }
  });
}
