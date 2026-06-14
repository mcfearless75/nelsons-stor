# Nelson's Stor

Golden retriever greeting cards, made in Belfast. Static site + Stripe Checkout, hosted on Netlify.

**592 sales · 5.0★ · Zero platform commission (Stripe only)**

---

## Stack

- Vanilla HTML/CSS/JS — no framework, no build step
- Stripe Checkout (hosted) — no PCI scope on us
- Netlify (free tier) — static hosting + serverless function
- `data/products.json` — catalogue, edit and redeploy

---

## Setup

### 1. Install dependencies (for the Netlify function)

```bash
npm install
```

### 2. Set environment variable

In Netlify → Site settings → Environment variables:

```
STRIPE_SECRET_KEY = sk_test_...   (test mode)
URL = https://your-site.netlify.app
```

For local dev with `netlify dev`, create a `.env` file (never commit it):

```
STRIPE_SECRET_KEY=sk_test_...
URL=http://localhost:8888
```

### 3. Run locally

```bash
npm install -g netlify-cli
netlify dev
```

### 4. Deploy

```bash
git init
git add .
git commit -m "Nelson's Stor initial build"
# push to GitHub, then connect repo in Netlify dashboard
```

---

## Images

Drop client images into the correct folders — filenames must match exactly:

| Folder | Contents |
|--------|----------|
| `images/cards/` | 39 card JPGs — see filenames in `data/products.json` |
| `images/nelson/` | `hero.jpg`, `packaging.jpg`, `sticker.jpg`, `flatlay.jpg` |
| `images/og/` | `og-home.jpg` (1200×630 for social sharing) |

Images: JPG, ~1200px on the long edge, web-compressed. Until images arrive, the site renders SVG placeholders automatically — nothing breaks.

---

## Catalogue management

Edit `data/products.json` directly:

- `"active": false` — hides a card instantly on next deploy
- `"category"` — change category without touching HTML
- Add a new card by appending a new object to the array

---

## Stripe

- **Test mode**: use card `4242 4242 4242 4242`, any future expiry/CVC
- **Go live**: swap `STRIPE_SECRET_KEY` to `sk_live_...` in Netlify env vars, redeploy
- Orders visible in Stripe Dashboard → Payments

---

## Postage logic

| Cards in basket | UK postage |
|-----------------|------------|
| 1–3 | £1.50 |
| 4+ | FREE |

International: £3.50 flat. Computed server-side — price cannot be manipulated by the browser.

---

## IP note

`starwars-xmas-bundle` uses Star Wars IP. To remove it instantly: set `"active": false` in `data/products.json` and redeploy. No other changes needed.
