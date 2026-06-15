# Nelson's Stor — Admin CMS & Inventory: Design Spec

**Date:** 2026-06-15
**Status:** Draft for sign-off (plan-first; no code until approved)
**Author:** Claude (for PaulMc)

---

## 1. Goal

Give the shop owner a login-protected admin dashboard to fully manage the catalogue without touching code or git:

- Create / edit / hide / delete card listings
- Edit any field: title, description, price, size, gsm, category, bundle flag
- Manage each card's media: add/remove photos, add/replace video, reorder, set the primary (grid) image
- Track inventory: per-card stock count with "sold out" handling and auto-decrement on sale
- Edit postage settings (UK tiers, free threshold, international rate)
- Changes appear on the live shop instantly

## 2. Decisions locked (from kickoff Q&A)

| Decision | Choice |
|----------|--------|
| Backend | **Supabase** (Postgres + Storage + Auth) |
| Stock | **Inventory tracking** — per-card stock, sold-out, decrement on sale |
| Public shop data | **Live read from Supabase** (anon key + RLS), instant edits |
| Admin users | **Single shared login** (one Supabase Auth user) |

**Reconciling inventory with print-on-demand:** stock is *opt-in per card*. `stock_qty = NULL` means unlimited (current default for all 34 cards); an integer means a tracked/limited item that can sell out. So most cards stay "always available" and the owner only sets counts on limited editions.

## 3. Architecture

```
┌─────────────┐     read (anon key, RLS)      ┌──────────────────┐
│ Public shop │ ────────────────────────────► │     Supabase      │
│ (Netlify    │                               │  Postgres + RLS   │
│  static)    │     /api/create-checkout      │  Storage (media)  │
│             │ ──► Netlify Function ──────►   │  Auth (1 admin)   │
│ /admin      │     (service-role key)         └──────────────────┘
│ (protected) │ ◄── auth + CRUD (authed) ─────────────▲
└─────────────┘                                        │
        Stripe webhook ──► Netlify Function ──► decrement stock
```

- **Public shop**: stays static on Netlify; `js/products.js` + product/cart pages fetch catalogue live from Supabase via the JS client (anon/publishable key). RLS allows `SELECT` only on `active = true` products.
- **Admin (`/admin`)**: static page + Supabase Auth (email/password). Authenticated session unlocks CRUD + Storage uploads. Guarded by RLS (`authenticated` role) — the anon key cannot write.
- **Checkout**: `create-checkout.js` reads prices, postage settings, and stock from Supabase using the **service-role key** (server-only) — browser still never sets prices. Validates stock before creating the session.
- **Inventory decrement**: new `stripe-webhook.js` function listens for `checkout.session.completed` and decrements `stock_qty` for tracked items.

## 4. Data model (Postgres)

**`products`**
| column | type | notes |
|--------|------|-------|
| id | text (PK) | keep existing slug ids (e.g. `reindeer-sleigh-xmas`) |
| title | text | |
| description | text | |
| price_gbp | numeric(6,2) | |
| size | text | `5x7` / `A6` |
| gsm | int | |
| category | text | matches existing category slugs |
| is_bundle | bool | default false |
| active | bool | default true (hides instantly when false) |
| stock_qty | int null | NULL = unlimited; int = tracked |
| sort_order | int | manual ordering in grid |
| created_at / updated_at | timestamptz | |

**`product_media`**
| column | type | notes |
|--------|------|-------|
| id | uuid (PK) | |
| product_id | text (FK→products) | |
| type | text | `image` \| `video` |
| url | text | Supabase Storage public URL |
| sort_order | int | gallery order; lowest = primary/grid image |
| created_at | timestamptz | |

**`settings`** (single row, postage config)
| column | type | default |
|--------|------|---------|
| uk_standard_pence | int | 150 |
| uk_free_threshold | int | 4 |
| intl_pence | int | 350 |
| updated_at | timestamptz | |

## 5. Admin dashboard — features

Single-page protected app at `/admin` (vanilla JS + Supabase client, matching the site's no-build stack and blue/cream design tokens):

1. **Login** — email/password (Supabase Auth). Session persisted; logout button.
2. **Card list** — table/grid of all products (incl. inactive), search + category filter, quick toggles for `active`, stock badge, drag-or-number `sort_order`.
3. **Card editor** (per card):
   - Edit all text/number fields + category dropdown + bundle/active toggles + stock (blank = unlimited).
   - **Media manager**: thumbnail strip; upload image(s)/video (drag-drop or picker → Supabase Storage), remove, reorder, mark primary. Shows the same gallery the shop renders.
4. **Add new card** — same editor, blank; generates a slug id from the title (editable, uniqueness-checked).
5. **Postage settings** — edit the three postage values; live preview of the tiers.
6. **Delete** — soft via `active=false` (recommended) or hard delete with confirm (also removes Storage files).

## 6. Public shop changes

- `js/products.js`, `js/page-product.js`, `js/page-cart.js` fetch from Supabase instead of `data/products.json` / `data/media.json`.
- Sold-out handling: tracked cards with `stock_qty = 0` show a "Sold out" badge and disable Add to Basket.
- Keep `data/products.json` as a generated fallback/seed (optional), but Supabase is the source of truth.

## 7. Checkout & inventory

- `create-checkout.js`: build price/postage/stock lookup from Supabase (service-role). Reject if a tracked item is out of stock or requested qty exceeds stock. Postage from `settings`.
- `stripe-webhook.js`: on `checkout.session.completed`, decrement `stock_qty` for tracked line items (idempotent via event id). Requires `STRIPE_WEBHOOK_SECRET`.

## 8. Security

- **RLS on all tables.** `products`/`product_media`: public `SELECT` only where `active=true`; all writes require `authenticated`. `settings`: public `SELECT`, writes `authenticated`.
- **Keys**: anon/publishable key in client (safe, RLS-bound). **Service-role key only in Netlify function env** — never client-side.
- **Auth user** created via Supabase dashboard/admin API (never SQL-insert into `auth.users` — GoTrue won't recognise it).
- **CSP update** (netlify.toml): add the Supabase project URL to `connect-src`; add Supabase Storage domain to `img-src` and `media-src`. Admin page may need a small allowance for the Supabase client.
- Storage bucket: public-read for card media; writes authenticated only.

## 9. Migration

1. Create Supabase project + tables + RLS + Storage bucket (`card-media`).
2. Seed `products` + `settings` from current `data/products.json`.
3. Upload existing `images/cards/**` (34 products, ~119MB incl. video) to Storage; populate `product_media` with public URLs (preserving order + primary).
4. Repoint shop fetches to Supabase; verify parity with current site.
5. Switch checkout function to Supabase; deploy webhook.
6. Once verified, repo media can stay as backup or be removed to slim the repo.

## 10. Phased build order

- **Phase 0 — Setup**: Supabase project, schema, RLS, Storage, env vars, CSP. Seed data + migrate media. *(Shop still works unchanged.)*
- **Phase 1 — Public read**: shop fetches from Supabase (read-only). Verify parity. Sold-out UI.
- **Phase 2 — Admin auth + read**: `/admin` login + card list (read).
- **Phase 3 — Admin edits**: card editor (text/price/fields/postage) writing to Supabase.
- **Phase 4 — Media manager**: upload/remove/reorder/primary to Storage.
- **Phase 5 — Add/delete cards**.
- **Phase 6 — Inventory + checkout**: stock validation in checkout, Stripe webhook decrement, sold-out enforcement.
- Each phase is independently shippable and verifiable.

## 11. Cost (free-tier check)

Supabase free tier: 500MB DB (catalogue is tiny — fine), 1GB Storage (current media ~119MB — fine), ~5GB egress/month (low-traffic shop — fine; video is the main consumer, monitor). No new cost expected at current scale. Netlify unchanged.

## 12. Risks / open questions

- **Egress for video** on Supabase free tier if traffic spikes — mitigate by keeping videos modest (already 15s/~1–3MB) and lazy-loading.
- **Stripe webhook** requires live/test webhook secret config in Netlify; adds a moving part.
- **Admin on a public URL** (`/admin`) — protected by Supabase Auth; consider also a Netlify access rule. Acceptable with strong auth.
- Slug changes for existing products would break inbound links — keep ids stable; editing the slug is allowed only for new cards.
- This supersedes the static `products.json` workflow — the README's "edit products.json" instructions will be updated.

---

## Sign-off

Please review. Confirm or adjust:
1. Scope of the 6 phases (any to drop/defer for v1?)
2. Soft-delete (hide) vs hard-delete preference
3. Whether to keep `data/products.json` as a generated backup
4. Anything missing from the admin feature list

On approval I'll turn this into a detailed implementation plan (writing-plans) and start Phase 0.
