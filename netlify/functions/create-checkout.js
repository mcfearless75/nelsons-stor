const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Supabase is the single source of truth for prices, stock and postage.
// These are the public, RLS-bound values (same as js/store.js) — safe server-side.
const SUPABASE_URL = "https://hysikygygqzbmgkajpwo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2U9Dned6-ccj3tzQ-5xnWA_d1EddkQi";
const SB_REST = `${SUPABASE_URL}/rest/v1`;

// Safe fallbacks only if the settings row is somehow missing.
const DEFAULT_POSTAGE = { uk_standard_pence: 150, uk_free_threshold: 4, intl_pence: 350 };

function sbHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}

function clampQty(q) {
  return Math.max(1, Math.min(99, parseInt(q, 10) || 1));
}

// Fetch the requested products live. Returns a map id -> {title, amount, stock_qty}.
async function fetchProducts(ids) {
  const list = ids.map((id) => encodeURIComponent(id)).join(",");
  const url =
    `${SB_REST}/products?id=in.(${list})&active=eq.true` +
    `&select=id,title,price_gbp,stock_qty`;
  const resp = await fetch(url, { headers: sbHeaders() });
  if (!resp.ok) throw new Error(`Catalogue lookup failed (${resp.status}).`);
  const rows = await resp.json();
  const map = {};
  rows.forEach((p) => {
    map[p.id] = {
      title: p.title,
      amount: Math.round(Number(p.price_gbp) * 100),
      stock_qty: p.stock_qty, // null = unlimited
    };
  });
  return map;
}

// Live postage settings (single row), with safe fallback.
async function fetchPostage() {
  try {
    const resp = await fetch(
      `${SB_REST}/settings?select=uk_standard_pence,uk_free_threshold,intl_pence&limit=1`,
      { headers: sbHeaders() }
    );
    if (!resp.ok) throw new Error(String(resp.status));
    const rows = await resp.json();
    return rows[0] || DEFAULT_POSTAGE;
  } catch {
    console.warn("Postage settings unavailable; using defaults.");
    return DEFAULT_POSTAGE;
  }
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid request body" });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return json(400, { error: "No items in basket" });
  }
  if (items.length > 20) return json(400, { error: "Too many items" });

  // Validate ids and de-duplicate for the lookup.
  const ids = [];
  for (const it of items) {
    if (typeof it.id !== "string" || !it.id || it.id.length > 64) {
      return json(400, { error: "Invalid item in basket" });
    }
    if (!ids.includes(it.id)) ids.push(it.id);
  }

  try {
    const [priceLookup, postage] = await Promise.all([fetchProducts(ids), fetchPostage()]);

    const line_items = [];
    let totalQty = 0;
    for (const { id, quantity } of items) {
      const product = priceLookup[id];
      if (!product) {
        return json(409, { error: "An item in your basket is no longer available. Please review your basket." });
      }
      const qty = clampQty(quantity);
      // Stock guard for tracked items (null = unlimited).
      if (product.stock_qty != null) {
        if (product.stock_qty <= 0) {
          return json(409, { error: `“${product.title}” has just sold out. Please remove it to continue.` });
        }
        if (qty > product.stock_qty) {
          return json(409, { error: `Only ${product.stock_qty} of “${product.title}” left. Please lower the quantity.` });
        }
      }
      totalQty += qty;
      line_items.push({
        price_data: {
          currency: "gbp",
          product_data: { name: product.title, metadata: { product_id: id } },
          unit_amount: product.amount,
        },
        quantity: qty,
      });
    }

    const ukPence =
      totalQty >= postage.uk_free_threshold ? 0 : postage.uk_standard_pence;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["GB", "IE", "US", "CA", "AU"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: ukPence, currency: "gbp" },
            display_name:
              totalQty >= postage.uk_free_threshold
                ? `UK Standard — FREE (${postage.uk_free_threshold}+ cards)`
                : "UK Standard (2–3 days)",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 3 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: postage.intl_pence, currency: "gbp" },
            display_name: "International (7–10 days)",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 7 },
              maximum: { unit: "business_day", value: 10 },
            },
          },
        },
      ],
      success_url: `${process.env.URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/cancel.html`,
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error("Checkout error:", err.message);
    return json(500, { error: "Unable to create checkout session. Please try again." });
  }
};
