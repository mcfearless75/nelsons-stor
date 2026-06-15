// Supabase data layer for the public shop (read-only).
// Uses the publishable/anon key — safe in client code: PostgREST + Storage are
// RLS-bound, so anon can only read active products and their media, never write.
const SUPABASE_URL = "https://hysikygygqzbmgkajpwo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2U9Dned6-ccj3tzQ-5xnWA_d1EddkQi";
const SB_REST = `${SUPABASE_URL}/rest/v1`;

function sbHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

// Postage settings (single row) — same source the checkout function charges from,
// so the cart can show a total that matches the till. Falls back to defaults.
const DEFAULT_POSTAGE = { uk_standard_pence: 150, usa_pence: 500, intl_pence: 350 };
async function fetchSettings() {
  try {
    const resp = await fetch(
      `${SB_REST}/settings?select=uk_standard_pence,usa_pence,intl_pence&limit=1`,
      { headers: sbHeaders() }
    );
    if (!resp.ok) throw new Error(String(resp.status));
    const rows = await resp.json();
    return rows[0] || DEFAULT_POSTAGE;
  } catch {
    return DEFAULT_POSTAGE;
  }
}

// Normalise embedded product_media rows into the shape the pages expect.
function mapMedia(rows) {
  const media = Array.isArray(rows)
    ? [...rows].sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const images = media.filter((m) => m.type === "image").map((m) => m.url);
  const video = (media.find((m) => m.type === "video") || {}).url || null;
  return { images, video };
}

// Whole active catalogue, ordered, each product carrying its primary image + media.
async function fetchCatalogue() {
  const url = `${SB_REST}/products?active=eq.true&order=sort_order&select=*,product_media(type,url,sort_order)`;
  const resp = await fetch(url, { headers: sbHeaders() });
  if (!resp.ok) throw new Error(`Catalogue fetch failed: ${resp.status}`);
  const rows = await resp.json();
  return rows.map((p) => {
    const { images, video } = mapMedia(p.product_media);
    return { ...p, image: images[0] || "", _images: images, _video: video };
  });
}

// Single active product + its gallery media. Returns null if not found/inactive.
async function fetchProduct(id) {
  const url = `${SB_REST}/products?id=eq.${encodeURIComponent(id)}&active=eq.true&select=*,product_media(type,url,sort_order)`;
  const resp = await fetch(url, { headers: sbHeaders() });
  if (!resp.ok) throw new Error(`Product fetch failed: ${resp.status}`);
  const rows = await resp.json();
  if (!rows.length) return null;
  const p = rows[0];
  const { images, video } = mapMedia(p.product_media);
  return { product: { ...p, image: images[0] || "" }, mediaEntry: { images, video } };
}
