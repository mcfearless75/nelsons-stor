const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Service-role key (server-only) bypasses RLS to write orders + decrement stock.
const SUPABASE_URL = "https://hysikygygqzbmgkajpwo.supabase.co";
const SB_REST = `${SUPABASE_URL}/rest/v1`;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function svcHeaders(extra) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// Insert the order keyed by stripe_event_id (unique). Returns the new row, or
// null if this event was already processed (idempotent on redelivery).
async function recordOrder(order) {
  const resp = await fetch(`${SB_REST}/orders`, {
    method: "POST",
    headers: svcHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(order),
  });
  if (resp.status === 409) return null; // duplicate event_id — already handled
  if (!resp.ok) throw new Error(`orders insert failed: ${resp.status} ${await resp.text()}`);
  const rows = await resp.json();
  return rows[0];
}

async function insertOrderItems(items) {
  if (!items.length) return;
  const resp = await fetch(`${SB_REST}/order_items`, {
    method: "POST",
    headers: svcHeaders(),
    body: JSON.stringify(items),
  });
  if (!resp.ok) console.error("order_items insert failed:", resp.status, await resp.text());
}

async function decrementStock(productId, qty) {
  const resp = await fetch(`${SB_REST}/rpc/decrement_stock`, {
    method: "POST",
    headers: svcHeaders(),
    body: JSON.stringify({ p_id: productId, p_qty: qty }),
  });
  if (!resp.ok) console.error(`decrement_stock failed for ${productId}:`, resp.status, await resp.text());
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const sig = event.headers["stripe-signature"];
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "ignored" };
  }

  const session = stripeEvent.data.object;

  try {
    // Idempotency gate: only the first delivery of this event proceeds.
    const order = await recordOrder({
      stripe_event_id: stripeEvent.id,
      stripe_session_id: session.id,
      customer_email: session.customer_details?.email || null,
      shipping_address: session.shipping_details || session.customer_details?.address || null,
      total_pence: session.amount_total,
      currency: session.currency || "gbp",
      status: "paid",
    });
    if (!order) return { statusCode: 200, body: "duplicate" };

    // Pull the purchased lines, with the product (so we can read product_id).
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
      limit: 100,
    });

    const orderItems = [];
    for (const li of lineItems.data) {
      const product = li.price && li.price.product;
      const productId = product && product.metadata ? product.metadata.product_id : null;
      const qty = li.quantity || 1;
      if (productId) {
        await decrementStock(productId, qty);
        orderItems.push({
          order_id: order.id,
          product_id: productId,
          title: li.description || (product && product.name) || productId,
          qty,
          unit_pence: li.price ? li.price.unit_amount : null,
        });
      }
    }
    await insertOrderItems(orderItems);

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    // 500 makes Stripe retry; the event_id gate keeps retries idempotent.
    console.error("Webhook processing error:", err.message);
    return { statusCode: 500, body: "processing error" };
  }
};
