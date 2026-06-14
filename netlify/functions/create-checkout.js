const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const products = require("../../data/products.json");

const priceLookup = {};
products.forEach((p) => {
  if (p.active) {
    priceLookup[p.id] = { title: p.title, amount: Math.round(p.price_gbp * 100) };
  }
});

function ukPostagePence(totalQty) {
  return totalQty >= 4 ? 0 : 150;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "No items in basket" }) };
  }

  if (items.length > 100) {
    return { statusCode: 400, body: JSON.stringify({ error: "Too many items" }) };
  }

  try {
    const line_items = items.map(({ id, quantity }) => {
      if (typeof id !== "string" || !id) throw new Error("Invalid item id");
      const product = priceLookup[id];
      if (!product) throw new Error(`Unknown item: ${id}`);
      const qty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));
      return {
        price_data: {
          currency: "gbp",
          product_data: { name: product.title },
          unit_amount: product.amount,
        },
        quantity: qty,
      };
    });

    const totalQty = items.reduce((n, i) => {
      return n + Math.max(1, Math.min(99, parseInt(i.quantity, 10) || 1));
    }, 0);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: {
        allowed_countries: ["GB", "IE", "US", "CA", "AU"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: ukPostagePence(totalQty),
              currency: "gbp",
            },
            display_name:
              totalQty >= 4
                ? "UK Standard — FREE (4+ cards)"
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
            fixed_amount: { amount: 350, currency: "gbp" },
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("Checkout error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to create checkout session. Please try again." }),
    };
  }
};
