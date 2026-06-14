# NELSONS_STOR_MASTER_BUILD.md

**Complete build spec for Nelson's Stor — golden retriever greetings cards, Belfast.**
Self-owned store. Static site + Stripe Checkout. Zero platform commission (Stripe only, ~1.5% + 20p UK).
Runs alongside the existing Etsy shop, not instead of it.

> Paste this whole file into Claude Code. Execute Section 16 top to bottom. The full 39-product catalogue is in Section 6 — drop it straight into `data/products.json`.

---

## 0. Context — what this is and isn't

The Etsy shop (NelsonsStor) is a **proven brand**: 592 sales, 5.0★ from 134 reviews, 1.5 years trading, Belfast. This build is a **second channel**, not a replacement. It:

- Removes Etsy's per-sale fee (~12–15% all-in) on buyers who'd come direct anyway — repeat customers, social traffic, packaging-insert scans.
- **Keeps Etsy running** for discovery. Etsy brings strangers; this site keeps the margin on the regulars and gives her a customer list Etsy never will.

**The brand is the dog.** Nelson is the hook, not "greeting cards". Every design choice serves that.

---

## 1. Brand carry-over — the three 5★ drivers (must survive onto the site)

Pulled from the Etsy reviews. These are *why people give 5 stars*, so they're conversion levers, not decoration:

1. **Packaging is part of the product** — "beautifully packaged, golden retriever sticker sealing the envelope." → Photograph it. Feature it on `about.html` and `success.html`.
2. **Free bonus card** — "popped in a free card too", "extra surprise." → Make it an explicit promise: *"Every order ships with a surprise free card from Nelson."*
3. **Speed** — "arrived quickly" repeatedly. → State dispatch speed up front (2–3 working days). Don't overpromise next-day; she hand-prints.

**Voice:** warm, personal, a little playful — written as *Nelson's human*. Belfast/NI roots are an asset (there's already an Irish + St Patrick's range). Not corporate.

---

## 2. Decision record

| Choice | Decision | Why |
|---|---|---|
| Hosting | **Netlify** (free) | Free tier, custom domain, HTTPS, serverless function for the secure Stripe call |
| Catalogue | **Hardcoded `products.json`** | 39 designs. No CMS, no DB, no monthly cost. Edit file → redeploy. |
| Payments | **Stripe Checkout** (hosted) | Stripe hosts the card page → near-zero PCI scope |
| Cart | **Client-side, localStorage** | No backend state until checkout |
| Secret key | **Netlify env var, function-only** | Stripe secret key NEVER touches the browser |
| Shipping | **Tiered by basket size** | Single = large letter; 4+ = free (self-posted, see §3) |
| Multi-buy | **Quantity in cart, no SKU variants** | Etsy sells singly; packs happen via quantity |

**The one rule that matters:** the Stripe *secret* key lives only in a Netlify env var, used only inside the serverless function. The function rebuilds every price server-side from `products.json`. **Never trust a price sent by the browser** — without this, anyone buys a card for 1p via dev tools.

---

## 3. Pricing & postage model

Etsy shows card + £1.80 postage. On her own site she controls the split. **Build this model:**

| Cards in basket | Card price | UK postage |
|---|---|---|
| 1–3 | as listed (£2.50–£4.00) | **£1.50** (large letter) |
| 4+ | as listed | **FREE** |

International: flat **£3.50** (placeholder — she weighs a real pack and adjusts).

**Why free at 4+:** it's the direct-channel carrot — hands back the recovered Etsy fee as a reason to buy direct, and lifts basket size (she's posting anyway). **Action for client: weigh a 4-pack in its mailer before launch.** If 4 cards tip into small-parcel (£3.69+), move the free threshold or the margin bleeds.

---

## 4. ⚠️ Star Wars listing — IP risk (client has accepted, logged here)

The `starwars-xmas-bundle` listing uses Star Wars IP (Disney/Lucasfilm). Tolerated on Etsy; **higher exposure on a self-owned branded domain** because liability sits with the shop owner, her domain, and her Stripe account. Client has chosen to proceed. This note is the paper trail. If a takedown ever lands, set `"active": false` on that listing and redeploy — it vanishes instantly, no other changes needed.

---

## 5. Project structure

```
nelsons-stor/
├── index.html              # Nelson hero + trust strip + category grid
├── product.html            # single card (?id=xxx) + quantity selector
├── cart.html               # basket + dynamic postage preview + checkout
├── success.html            # thank-you (free bonus card + socials)
├── cancel.html
├── about.html              # Nelson's story + reviews + packaging photos
├── css/styles.css
├── js/
│   ├── products.js         # loads + renders catalogue
│   ├── cart.js             # localStorage basket
│   └── checkout.js         # calls the serverless function
├── data/products.json      # THE CATALOGUE (Section 6)
├── images/
│   ├── cards/              # 39 card photos (client supplies, named per §7)
│   ├── nelson/             # brand: Nelson, packaging, the sticker
│   └── og/                 # social share images
├── netlify/functions/create-checkout.js
├── netlify.toml
├── package.json
└── .gitignore
```

---

## 6. `data/products.json` — full catalogue (39 listings, validated)

Drop this in as-is. All titles/prices/sizes/categories are real from the live shop; descriptions are clean rewrites. IDs are unique; filenames match §7.

```json
[
  {"id":"nelson-rudolph-xmas","title":"Nelson the Golden Retriever with Rudolph Christmas Card","description":"Nelson meets Rudolph in this cheerful festive scene. Blank inside for your own message. Printed on premium 350gsm card and supplied with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/nelson-rudolph-xmas.jpg","active":true},
  {"id":"nelson-mr-snowman-xmas","title":"Nelson the Golden Retriever with Mr Snowman Christmas Card","description":"Nelson makes a new frosty friend in this charming Christmas design. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/nelson-mr-snowman-xmas.jpg","active":true},
  {"id":"santa-bus-puppies-xmas","title":"Golden Retriever Santa Bus with Puppies Christmas Card","description":"A bus full of golden retriever puppies spreading Christmas cheer. Blank inside, 350gsm card supplied with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/santa-bus-puppies-xmas.jpg","active":true},
  {"id":"nelson-beach-xmas","title":"Nelson the Golden Retriever Beach Christmas Card","description":"A sunny seaside twist on a festive favourite, starring Nelson. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/nelson-beach-xmas.jpg","active":true},
  {"id":"reindeer-sleigh-xmas","title":"Golden Retriever Reindeer Christmas Card — Festive Holiday Sleigh","description":"A golden retriever pulling a sleigh piled high with gifts — one of Nelson's most-loved festive designs. Blank inside, 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/reindeer-sleigh-xmas.jpg","active":true},
  {"id":"nelson-wellies-xmas","title":"Golden Retriever Christmas Card — Nelson in Wellies","description":"Nelson wrapped up for a wintry walk in his wellies. A warm, characterful holiday card. Blank inside, 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/nelson-wellies-xmas.jpg","active":true},
  {"id":"festive-dog-art-xmas","title":"Golden Retriever Christmas Card — Festive Dog Art","description":"A beautifully illustrated golden retriever in full festive spirit. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/festive-dog-art-xmas.jpg","active":true},
  {"id":"nelson-nutcracker-xmas","title":"Golden Retriever Christmas Card — Nelson and the Nutcracker","description":"Nelson brings holiday cheer alongside a classic nutcracker. Blank inside, 350gsm card supplied with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/nelson-nutcracker-xmas.jpg","active":true},
  {"id":"puppy-fireplace-xmas","title":"Golden Retriever Puppy Christmas Card — Festive Pup by the Fireplace","description":"A golden retriever puppy curled up by a cosy fireside. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/puppy-fireplace-xmas.jpg","active":true},
  {"id":"puppy-festive-holiday-xmas","title":"Golden Retriever Puppy Christmas Card — Festive Holiday Pup","description":"An adorable festive golden retriever puppy ready for the holidays. Blank inside, 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/puppy-festive-holiday-xmas.jpg","active":true},
  {"id":"mistletoe-kiss-xmas","title":"Golden Retriever Pup Christmas Card — Mistletoe Festive Kiss","description":"A sweet mistletoe moment with a golden retriever pup. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"christmas","image":"images/cards/mistletoe-kiss-xmas.jpg","active":true},
  {"id":"irish-guinness-dublin-xmas","title":"Golden Retriever Irish Christmas at Guinness Dublin Card","description":"A golden retriever enjoying a festive Irish Christmas in Dublin. Blank inside, A6 size, printed on 350gsm card with an envelope.","price_gbp":3.00,"size":"A6","gsm":350,"category":"christmas","image":"images/cards/irish-guinness-dublin-xmas.jpg","active":true},
  {"id":"starwars-xmas-bundle","title":"Star Wars Golden Retriever Christmas Cards — Festive Bundle","description":"A festive bundle of golden retriever Christmas cards. A6 size, blank inside, printed on 350gsm card with envelopes.","price_gbp":8.50,"size":"A6","gsm":350,"category":"christmas","image":"images/cards/starwars-xmas-bundle.jpg","active":true,"is_bundle":true},
  {"id":"birthday-funny-dog-lover","title":"Golden Retriever Birthday Card — Happy Funny Dog Lover","description":"A fun, feel-good birthday card for any golden retriever lover. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"birthday","image":"images/cards/birthday-funny-dog-lover.jpg","active":true},
  {"id":"birthday-balloons-party-hat","title":"Golden Retriever Birthday Card with Balloons and Party Hat","description":"A golden retriever dressed up for the party with balloons and a party hat. Blank inside, 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"birthday","image":"images/cards/birthday-balloons-party-hat.jpg","active":true},
  {"id":"birthday-dog-friends-a6","title":"Golden Retriever Birthday Card — Party with Dog Friends","description":"A golden retriever celebrating with all his dog friends. A6 size, blank inside, printed on 350gsm card with an envelope.","price_gbp":3.00,"size":"A6","gsm":350,"category":"birthday","image":"images/cards/birthday-dog-friends-a6.jpg","active":true},
  {"id":"birthday-beach-roll","title":"Golden Retriever Birthday Card — Rolling on the Beach","description":"A happy golden retriever rolling about on the beach. A fun birthday card, blank inside. A6 size, 350gsm with an envelope.","price_gbp":3.00,"size":"A6","gsm":350,"category":"birthday","image":"images/cards/birthday-beach-roll.jpg","active":true},
  {"id":"birthday-red-mini-sunglasses","title":"Golden Retriever Birthday Card — Red Mini and Sunglasses","description":"A cool golden retriever in sunglasses beside a classic red Mini. Works as a birthday or general card. Blank inside, 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"birthday","image":"images/cards/birthday-red-mini-sunglasses.jpg","active":true},
  {"id":"baalated-birthday-sheep","title":"Funny Belated Birthday Card — \"Baa-lated Wishes\" Cartoon Sheep","description":"A playful belated birthday card with a punny cartoon sheep. Blank inside, printed on 350gsm card with an envelope.","price_gbp":2.50,"size":"5x7","gsm":350,"category":"birthday","image":"images/cards/baalated-birthday-sheep.jpg","active":true},
  {"id":"valentine-nelson-pup","title":"Nelson the Golden Retriever Pup Valentine's Card","description":"Nelson sends a little love this Valentine's Day. Blank inside, 5x7 size, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"valentine","image":"images/cards/valentine-nelson-pup.jpg","active":true},
  {"id":"valentine-dog-love","title":"Golden Retriever Valentine's Day Card — Dog Love","description":"A heartfelt golden retriever Valentine's card for the one you love. Blank inside, 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"valentine","image":"images/cards/valentine-dog-love.jpg","active":true},
  {"id":"valentine-red-rose-mischief","title":"Golden Retriever Valentine's Day Card — Red Rose Mischief","description":"A mischievous golden retriever with a single red rose. A charming Valentine's card, blank inside. 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"valentine","image":"images/cards/valentine-red-rose-mischief.jpg","active":true},
  {"id":"valentine-puppies-woof-you","title":"Golden Retriever Puppies Valentine's Day Card — I Woof You Too!","description":"Golden retriever puppies sharing the love this Valentine's Day. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"valentine","image":"images/cards/valentine-puppies-woof-you.jpg","active":true},
  {"id":"fathers-day-farmer-wellies","title":"Farmer Father's Day Card — Golden Retriever Puppy Between Dad's Wellies","description":"A golden retriever puppy peeking out between a farmer dad's wellies. A warm Father's Day card, blank inside. 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"fathers-day","image":"images/cards/fathers-day-farmer-wellies.jpg","active":true},
  {"id":"fathers-day-dad-rescue","title":"Dad to the Rescue Father's Day Card — Golden Retriever Rescue","description":"A heroic golden retriever for the dad who always saves the day. Blank inside, 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"fathers-day","image":"images/cards/fathers-day-dad-rescue.jpg","active":true},
  {"id":"fathers-day-general","title":"Golden Retriever Father's Day Card","description":"A lovely golden retriever Father's Day card to mark the day. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"fathers-day","image":"images/cards/fathers-day-general.jpg","active":true},
  {"id":"mothers-day-heart-balloons","title":"Golden Retriever Mother's Day Card — Heart-Shaped Balloons","description":"A golden retriever with heart-shaped balloons for Mum's special day. Blank inside, 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"mothers-day","image":"images/cards/mothers-day-heart-balloons.jpg","active":true},
  {"id":"mothers-day-funny-kitchen","title":"Golden Retriever Mother's Day Card — Funny Dog in Kitchen","description":"A cheeky golden retriever causing kitchen chaos — a funny Mother's Day card. Blank inside, 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"mothers-day","image":"images/cards/mothers-day-funny-kitchen.jpg","active":true},
  {"id":"baby-boy-puppy-a6","title":"Golden Retriever Puppy Baby Boy Card","description":"A sweet golden retriever puppy to welcome a new baby boy. A6 size, blank inside, printed on 350gsm card with an envelope.","price_gbp":3.00,"size":"A6","gsm":350,"category":"baby","image":"images/cards/baby-boy-puppy-a6.jpg","active":true},
  {"id":"baby-girl-congratulations-a6","title":"Golden Retriever Puppy Congratulations Baby Girl Card","description":"A golden retriever puppy to celebrate a new baby girl. A6 size, blank inside, 350gsm card with an envelope.","price_gbp":3.00,"size":"A6","gsm":350,"category":"baby","image":"images/cards/baby-girl-congratulations-a6.jpg","active":true},
  {"id":"sympathy-raincoat","title":"Golden Retriever Sympathy Card — Dog in Raincoat","description":"A gentle, comforting golden retriever sympathy card. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"sympathy","image":"images/cards/sympathy-raincoat.jpg","active":true},
  {"id":"sympathy-all-dogs-heaven","title":"Golden Retriever Sympathy Card — All Dogs Go To Heaven","description":"A tender pet loss sympathy card for a golden retriever owner. Blank inside, 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"sympathy","image":"images/cards/sympathy-all-dogs-heaven.jpg","active":true},
  {"id":"sympathy-beach-heaven","title":"Pet Loss Sympathy Card — Beach Scene, Heaven This Way","description":"A peaceful beach scene to offer comfort after the loss of a beloved pet. Blank inside, 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"sympathy","image":"images/cards/sympathy-beach-heaven.jpg","active":true},
  {"id":"get-well-soon-a6","title":"Nelson Says Get Well Soon — Encouragement Card","description":"Nelson sends warm wishes for a speedy recovery. A6 size, blank inside, printed on 350gsm card with an envelope.","price_gbp":3.00,"size":"A6","gsm":350,"category":"get-well","image":"images/cards/get-well-soon-a6.jpg","active":true},
  {"id":"thank-you-a6","title":"Nelson Says Thank You — Thank You Card","description":"Nelson's way of saying thanks. A6 size, blank inside, printed on 350gsm card with an envelope.","price_gbp":3.00,"size":"A6","gsm":350,"category":"general","image":"images/cards/thank-you-a6.jpg","active":true},
  {"id":"general-autumn-fall","title":"Golden Retriever General Card — Autumn / Fall Celebration","description":"A golden retriever enjoying the autumn leaves. A versatile general card for any occasion. Blank inside, 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"general","image":"images/cards/general-autumn-fall.jpg","active":true},
  {"id":"general-paddleboard-boat","title":"Golden Retriever Card — Nelson on a Paddleboard Behind a Boat","description":"Nelson out on the water on his paddleboard. A fun birthday or general card, blank inside. 5x7, 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"general","image":"images/cards/general-paddleboard-boat.jpg","active":true},
  {"id":"thinking-of-you","title":"Golden Retriever Thinking of You Card","description":"A thoughtful golden retriever card to let someone know they're in your thoughts. Blank inside, printed on 350gsm card with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"thinking-of-you","image":"images/cards/thinking-of-you.jpg","active":true},
  {"id":"st-patricks-irish-stor","title":"Golden Retriever St Patrick's Day Card — Irish Stor Collection","description":"A golden retriever celebrating St Patrick's Day in style. Part of the Irish Stor Collection. Blank inside, 350gsm with an envelope.","price_gbp":4.00,"size":"5x7","gsm":350,"category":"st-patricks","image":"images/cards/st-patricks-irish-stor.jpg","active":true}
]
```

**Category nav (use these slugs + labels):**
`christmas` Christmas · `birthday` Birthday · `valentine` Valentine's · `fathers-day` Father's Day · `mothers-day` Mother's Day · `baby` New Baby · `sympathy` Sympathy & Pet Loss · `get-well` Get Well Soon · `thinking-of-you` Thinking of You · `st-patricks` St Patrick's · `general` General

Counts: Christmas 13, Birthday 6, Valentine 4, Sympathy 3, Father's Day 3, General 3, Mother's Day 2, Baby 2, Get Well 1, Thinking of You 1, St Patrick's 1. (Client can re-home any card by editing its `category`.)

---

## 7. Image filename checklist (client supplies originals, named exactly)

Drop into `images/cards/`, JPG, ideally ~1200px on the long edge, web-compressed. Names must match exactly:

```
nelson-rudolph-xmas.jpg          nelson-mr-snowman-xmas.jpg
santa-bus-puppies-xmas.jpg       nelson-beach-xmas.jpg
reindeer-sleigh-xmas.jpg         nelson-wellies-xmas.jpg
festive-dog-art-xmas.jpg         nelson-nutcracker-xmas.jpg
puppy-fireplace-xmas.jpg         puppy-festive-holiday-xmas.jpg
mistletoe-kiss-xmas.jpg          irish-guinness-dublin-xmas.jpg
starwars-xmas-bundle.jpg         birthday-funny-dog-lover.jpg
birthday-balloons-party-hat.jpg  birthday-dog-friends-a6.jpg
birthday-beach-roll.jpg          birthday-red-mini-sunglasses.jpg
baalated-birthday-sheep.jpg      valentine-nelson-pup.jpg
valentine-dog-love.jpg           valentine-red-rose-mischief.jpg
valentine-puppies-woof-you.jpg   fathers-day-farmer-wellies.jpg
fathers-day-dad-rescue.jpg       fathers-day-general.jpg
mothers-day-heart-balloons.jpg   mothers-day-funny-kitchen.jpg
baby-boy-puppy-a6.jpg            baby-girl-congratulations-a6.jpg
sympathy-raincoat.jpg            sympathy-all-dogs-heaven.jpg
sympathy-beach-heaven.jpg        get-well-soon-a6.jpg
thank-you-a6.jpg                 general-autumn-fall.jpg
general-paddleboard-boat.jpg     thinking-of-you.jpg
st-patricks-irish-stor.jpg
```
Plus brand photos in `images/nelson/`: a hero shot of Nelson, the packaging with the golden-retriever sticker, an envelope flat-lay. These carry §1.

**Build-time fallback:** until real images arrive, Claude Code should render a neutral placeholder (light card with the title) for any missing file so the layout is testable. Never block on images.

---

## 8. `netlify.toml`

```toml
[build]
  publish = "."
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/create-checkout"
  to = "/.netlify/functions/create-checkout"
  status = 200
```

---

## 9. Secure checkout function — `netlify/functions/create-checkout.js`

```javascript
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const products = require("../../data/products.json");

// Server-side price lookup — the client can NEVER set a price
const priceLookup = {};
products.forEach((p) => {
  priceLookup[p.id] = { title: p.title, amount: Math.round(p.price_gbp * 100) };
});

// Tiered UK postage by total card count
function ukPostagePence(totalQty) {
  return totalQty >= 4 ? 0 : 150; // free over 3 cards, else £1.50
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { items } = JSON.parse(event.body); // [{ id, quantity }]

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

    const totalQty = items.reduce((n, i) => n + Math.max(1, parseInt(i.quantity, 10)), 0);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: ["GB", "IE", "US", "CA", "AU"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: ukPostagePence(totalQty), currency: "gbp" },
            display_name: totalQty >= 4 ? "UK Standard — FREE (4+ cards)" : "UK Standard (2-3 days)",
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

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
```

> One Stripe shipping rate applies per session; the UK rate is computed from basket quantity at session creation. Strict UK-vs-international gating by destination is a post-MVP refinement — don't over-engineer day one.

---

## 10. `package.json` / `.gitignore`

```json
{ "name": "nelsons-stor", "version": "1.0.0", "dependencies": { "stripe": "^16.0.0" } }
```
```
node_modules/
.env
.netlify/
```

---

## 11. Frontend spec (Claude Code writes HTML/CSS/JS to these requirements — vanilla JS, no framework)

**`index.html`**
- **Nelson hero**: big warm photo, one brand line ("Hand-drawn golden retriever cards, made in Belfast — with a surprise free card in every order").
- **Trust strip**: ⭐ 5.0 from 130+ reviews · Free UK postage on 4+ · Dispatched in 2–3 days.
- **Category grid** (11 labels above). Click filters the product grid.
- **Product tiles**: image, title, size badge (5x7 / A6), price; link to `product.html?id=`. Bundle badge if `is_bundle`.

**`product.html`**
- Read `?id=`, render image + description + size/gsm.
- **Quantity selector** (replaces variants — buying 4 of one design is how packs happen).
- Nudge when basket would hit 3: "Add 1 more for free UK postage."
- "Add to basket" → localStorage + confirmation.

**`cart.js`** — key `nelsons_cart`, shape `[{ id, title, qty, price_gbp }]`. Functions: `addItem, removeItem, updateQty, getCart, clearCart, cartCount, cartTotal`. Basket badge in header sitewide.

**`cart.html`** — line items, qty steppers, subtotal, **dynamic postage preview** (FREE once qty ≥ 4), "Checkout" → `checkout.js`.

**`checkout.js`**
```javascript
async function goToCheckout() {
  const cart = getCart();
  if (!cart.length) return;
  const items = cart.map((i) => ({ id: i.id, quantity: i.qty }));
  const res = await fetch("/api/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const { url, error } = await res.json();
  if (error) { alert("Checkout error: " + error); return; }
  window.location = url;
}
```

**`success.html`** — `clearCart()`, warm thank-you in Nelson's voice, restate dispatch speed + free bonus card, Instagram follow + email signup.
**`cancel.html`** — basket intact, "no charge made", link back.
**`about.html`** — Nelson's story, 5★ social proof (a few real review lines), packaging photos (the sticker!), Belfast roots. A conversion asset, not filler.

---

## 12. Design direction

- **Nelson-led, warm, premium-but-friendly.** Artwork and dog carry it.
- Type: characterful display face for headings (**Fraunces** or **DM Serif Display**), clean sans body (**DM Sans** / **Inter**). Google Fonts.
- Palette: warm neutrals + golden-retriever tones (cream, soft gold, warm brown) + one accent. No cold corporate blue.
- Big imagery, generous whitespace, soft shadows, rounded corners. Photograph cards on wood/kraft like the Etsy shots — keep the recognisable look.
- Sticky minimal header: Nelson logo left, basket badge right.
- Mobile-first: 1 → 2 → 3/4 columns.

---

## 13. Capacity reality (she hand-prints and posts)

- **Honest dispatch promise**: "Each card printed fresh and dispatched within 2–3 working days." Turns self-printing into a quality signal. Matches the "arrived quickly" reviews — don't promise next-day.
- **Order queue**: Stripe Dashboard → Payments (address + line items per order). Turn on Stripe email receipts. Add the §15 webhook → Google Sheet sooner than a POD shop would, because she's physically fulfilling.
- No inventory counting (she can always print another) — omitted on purpose.

---

## 14. Stripe setup (15 min, before testing)

1. Stripe account, stay in **Test mode** for the build.
2. Developers → API keys → copy **Secret key** (`sk_test_...`).
3. Netlify → Site settings → Environment variables → `STRIPE_SECRET_KEY = sk_test_...`.
4. Test card `4242 4242 4242 4242`, any future expiry/CVC/postcode.
5. Go live: flip Stripe to live, swap env var to `sk_live_...`, redeploy.

Checkout is fully Stripe-hosted, so only the secret key is needed — server-side.

---

## 15. Deploy + (optional) order webhook

```bash
git init && git add . && git commit -m "Nelson's Stor initial build"
# push to a new GitHub repo, then:
# Netlify → Add new site → Import from GitHub → pick repo
# Set STRIPE_SECRET_KEY → Deploy
```
Custom domain: Netlify → Domain settings → add domain → point registrar DNS. HTTPS automatic. **Buy the domain early** — it goes on the packaging insert (§17).

**Optional order webhook (add when the dashboard gets annoying):** a second Netlify function on Stripe's `checkout.session.completed` event that appends each paid order (name, address, items) to a Google Sheet or emails her. Don't build day one.

---

## 16. Build order for Claude Code

1. Scaffold structure + `netlify.toml`, `package.json`, `.gitignore`.
2. `data/products.json` — paste Section 6 verbatim.
3. `products.js` + `index.html` (Nelson hero, trust strip, category grid from JSON, placeholder images).
4. `product.html` + quantity selector + free-postage nudge.
5. `cart.js` + `cart.html` with dynamic postage preview.
6. `netlify/functions/create-checkout.js` (Section 9).
7. `checkout.js`, `success.html`, `cancel.html`, `about.html`.
8. `styles.css` design pass (Section 12).
9. `netlify dev` to test the function locally → deploy (Section 15).

---

## 17. The Etsy-fee recovery play (the actual point)

The site recovers nothing if nobody lands on it. The system that recovers Etsy fees:

1. **Packaging insert** in every Etsy order: "Order direct next time at [domain] — free UK postage on 4+ and the same surprise free card. Use code NELSON10." QR to the site.
2. **First-order discount** (NELSON10) — hand back a slice of the recovered fee to convert buyers to direct. (Add a Stripe promotion code; enable `allow_promotion_codes: true` on the session when ready.)
3. **Email capture** at checkout + on `about.html` — seasonal ranges (Christmas, Valentine's, Mother's/Father's Day) emailed to past buyers at zero fee. The long-term margin engine.
4. **Instagram** — Nelson is inherently shareable. Social → direct site → no Etsy cut.

Build the site, but treat the **insert + email list** as the real product.

---

## 18. Honest cost comparison

| | Etsy | This build |
|---|---|---|
| Per-sale platform fee | 6.5% + Offsite Ads up to 15% | **£0** |
| Payment processing | ~4% + 20p | ~1.5% + 20p (Stripe UK) |
| Monthly | £0 + £0.16/listing | £0 (Netlify + Stripe free tiers) |
| Domain | — | ~£10/yr |
| **Brings customers** | **Yes** | **No — she brings them** |

That last row is the whole strategy: keep Etsy for reach, own the channel for everyone who'd come back anyway.
