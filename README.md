# Nelson's Stor

Golden retriever greeting cards, made in Belfast. Static site + Stripe Checkout, hosted on Netlify.

**592 sales · 5.0★ · Zero platform commission (Stripe only)**

Live: **https://nelsonstor.netlify.app**

---

## Current status (handoff — last updated 2026-06-15, commit `86de42e`)

**Done**
- Full site built and live on Netlify. Mobile-responsive (2-col grid, scrollable category nav).
- **Real product artwork + galleries** for 34 of 39 cards, pulled from the client's own Etsy shop (NelsonsStor). Each product page has a gallery (multiple images + a 15s video) — stored in `images/cards/<id>/` and indexed in `data/media.json`. Grid thumbnails use `images/cards/<id>.jpg`.
- **Security hardened**: strict CSP (`script-src 'self'`, no inline JS/handlers), COOP/CORP/HSTS, `esc()` escaping on all injected catalogue data, Stripe redirect-URL validation, function input caps (≤20 items, id ≤64 chars). Server-side prices, env-var secret, no committed secrets.
- **UI polish**: SVG icon system (`js/icons.js`, no emoji icons), focus-visible rings, 44px touch targets, reduced-motion support.

**Pending / decisions for next session**
1. **5 products have no Etsy match** (still on paw placeholders) — decide per card:
   - `st-patricks-irish-stor` — Etsy's St Patrick's listing is an **Irish Donkey**, not a retriever.
   - `thinking-of-you`, `birthday-beach-roll`, `valentine-nelson-pup` — no matching Etsy listing.
   - `fathers-day-general` — closest Etsy listing is "Bringing Dad His Trainers".
   - Options: wire the alternative art, or set `"active": false` to hide them.
2. **`STRIPE_SECRET_KEY` must be added by Paul** in Netlify env vars — checkout won't work until set (`sk_test_...` to test, `sk_live_...` to go live). `URL` is a Netlify reserved built-in (auto-set, do not add).
3. Optional: Playwright responsive screenshot pass (375/768/1024); app-level rate limiting on the checkout function (needs Netlify Pro).

**Etsy media pipeline** (to refresh/extend artwork)
- `data/etsy-media.json` — harvested manifest (product → image URLs + video URL).
- `scripts/fetch-media.js` — downloads all media from the manifest into `images/cards/<id>/` and rebuilds `data/media.json`. Run: `node scripts/fetch-media.js`.
- `scripts/etsy-image-manifest.txt` — chosen flat-art (primary grid image) per product.

**Notes**
- Repo carries ~119MB of media (images + video). Local tooling (`.claude/`, `.claude-flow/`, `.mcp.json`) is gitignored.
- CSS/JS use `must-revalidate` caching; HTML links `styles.css?v=3` (bump on CSS change if a stale cache is ever seen).

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

Product artwork is **already in place** for 34/39 cards, pulled from the client's Etsy shop:

| Folder | Contents |
|--------|----------|
| `images/cards/<id>.jpg` | Primary grid thumbnail (flat artwork) per product |
| `images/cards/<id>/` | Full gallery — `01.jpg…NN.jpg` + `video.mp4` per product |
| `images/nelson/` | About-page brand photos: `packaging.jpg`, `sticker.jpg`, `flatlay.jpg` (still placeholders until client supplies) |

The 5 unmatched products (see Current status) render SVG paw placeholders automatically — nothing breaks. To add/replace artwork, use the Etsy media pipeline or drop a JPG at `images/cards/<id>.jpg`.

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
