const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const products = require("../../data/products.json");

const priceLookup = {};
products.forEach((p) => {
  priceLookup[p.id] = { title: p.title, amount: Math.round(p.price_gbp * 100) };
});

function ukPostagePence(totalQty) {
  return totalQty >= 4 ? 0 : 150;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  try {
    const { items } = JSON.parse(event.body);

    const line_items = items.map(({ id, quantity }) => {
      const product = priceLookup[id];
      if (!product) throw new Error(`Unknown item: ${id}`);
      return {
        price_data: {
          currency: "gbp",
          product_data: { name: product.title },
          unit_amount: product.amount,
        },
        quantity: Math.max(1, parseInt(quantity, 10)),
      };
    });

    const totalQty = items.reduce(
      (n, i) => n + Math.max(1, parseInt(i.quantity, 10)),
      0
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
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
                : "UK Standard (2-3 days)",
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
            display_name: "International (7-10 days)",
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
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
