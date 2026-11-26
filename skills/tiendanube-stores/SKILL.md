---
name: tiendanube-stores
description: Use when working with a Tienda Nube / Nuvemshop store — developing or deploying a theme (classic snipplet .tpl templates, incl. the legacy rio theme; @tiendanube/cli FTP workflow), porting a redesign onto a live theme, creating/reading catalog data via the Admin REST API, doing the OAuth token exchange, or installing the Nuvemshop MCP server. Spanish/Portuguese e-commerce, mitiendanube.com / tiendanube.com stores.
---

# Tienda Nube / Nuvemshop Stores

Two separate surfaces, never confuse them:
- **Theme code** (`.tpl` Twig templates) → deploy via **`@tiendanube/cli` FTP**. No REST endpoint edits theme files.
- **Store data** (products, categories, customers, orders) → **Admin REST API** (and the MCP wraps it). Cannot edit theme files.

Plan/Impulso tier is required to edit theme code at all (lower tiers lock the theme).

## Toolkit (scripts in this skill dir — copy to a working dir, never to the theme)
| File | Does | Run |
|---|---|---|
| `tn-api.mjs` | Generic Admin API client (lib + CLI). Reads `./.env`. 429-retry, `listAll` pagination, CRUD wrappers. | `node tn-api.mjs GET /store` · `import { api, listProducts, createProduct } from './tn-api.mjs'` |
| `oauth-token.mjs` | Exchange OAuth `code` → token, save to `.env`. | `node oauth-token.mjs <code>` |
| `create-catalog.mjs` + `catalog.example.json` | Bulk-create categories+products from a JSON file (any store). | `node create-catalog.mjs catalog.json` |
| `safe-push.sh` | FTP push without uploading `.git`, requires a git restore point. | `./safe-push.sh <theme-dir>` |

Workflow for a NEW store: `mkdir ~/Desktop/Projects/<store>` (layout below) → copy toolkit into `store/` → creds (`oauth-token.mjs`) → `.env` → seed data (`create-catalog.mjs`) → `ftp pull` into `theme-pristine/`, copy to `theme/` → port design → `safe-push.sh theme/`. All verified working against a live store.

## Project layout — ONE folder per store

Every store gets its own project folder `~/Desktop/Projects/<store>/`. Never mix two stores in one tree. Inside:

| Folder | Holds |
|---|---|
| `theme/` | FTP working copy — pulled theme + your redesign edits. **This is the push source** (`safe-push.sh theme/`). |
| `theme-pristine/` | Untouched `ftp pull` = restore point. Own `git init` + one "pristine" commit. Never edit; `git checkout` from here to roll back a bad push. |
| `store/` | Data tooling copied from this skill (`tn-api.mjs`, `oauth-token.mjs`, `create-catalog.mjs`), `.env` (creds, gitignored), catalog JSON. All Admin-API / data work runs here. |
| `reports/` | Analysis + reporting, itself split: `scripts/` (`.mjs` analysis/API tooling), `data/` (`.json` — `analysis.json`, `money.json`, `financials.json`), `sources/` (editable report `.html` that gets printed to PDF), `deliverables/` (finished client PDFs/XLSX). `.env` + `report.config.json` stay at the `reports/` root. |
| `redesign/` | Optional Astro demo / mockups + build tooling, itself split: `app/` (the Astro project — `src public astro.config.mjs package.json node_modules dist`), `tooling/` (`*.py *.sh` build scripts), `output/` (generated screenshots, harness, `lookbook.html`), `deliverables/` (final lookbook PDF + hostable commentable review site for owner sign-off — see commentable-review-site skill). Scripts anchor to the `redesign/` root via `__file__` (`ROOT = dirname(dirname(__file__))`) and reference `app/dist`, `output/…`, `../theme` — so they live in `tooling/` yet the harness HTTP server (rooted at `redesign/`) still serves `/theme`, `/app/dist/img`, `/output/harness`. |
| `docs/` | Specs, plans, notes (`.md`). Keep `README.md` at the store-folder root. |

**Reorg rule:** the `.env` loader and most scripts read **cwd-relative** bare paths (`existsSync('.env')`), so **always run scripts from the `reports/` (or store) root** — that's the cwd the `.env`/config resolve against. You *can* split `scripts/` from `data/`/`sources/` (cleaner for a full project), but only if the script writes there explicitly: either it's stdout (`node scripts/money.mjs > data/money.json`), or its read/write paths are made root-relative (`data/analysis.json`, `sources/report.html`) or set via an out-dir flag/env (`REPORTS_DATA=data`, `analyze_finance.py --out data`, `render.sh sources/x.html deliverables/x.pdf`). Never leave a script pointing at a bare filename whose file you moved into a subfolder — update the path or it breaks. Finished client artifacts (PDFs/XLSX/decks) always go in `deliverables/`.

## CLI — theme dev (legacy FTP)

```bash
npm i -g @tiendanube/cli           # binary: `tiendanube`
tiendanube theme ftp setup --ftp-server ftp.tiendanube.com \
  --ftp-username <user> --ftp-password <pass> \
  --store-url https://<store>.mitiendanube.com/ -y
tiendanube theme ftp pull          # download theme to cwd
tiendanube theme ftp push -y       # upload — OVERWRITES LIVE THEME (no preview URL!)
tiendanube theme ftp watch         # auto-push on save
```

> **→ Deploy-to-live + verify + rollback:** if the `tiendanube-deploy-rehearsal` skill is installed, invoke it (Skill tool) and follow it — it adds an automated layered QA harness, a rendered-equality rollback gate and a dress rehearsal (push→test→auto-rollback). If it is not installed, use the pristine-commit restore point and the gotchas below, and check the live store visually right after the push. This skill (tiendanube-stores) covers the FTP/API mechanics either way.

**Critical gotchas:**
- Legacy FTP has **no preview** — `push` goes straight to the live storefront. Always `git init` + commit the pristine pull first as a restore point (`git checkout <pristine> . && ftp push`).
- `push` is interactive → use **`-y`**. It is run from a non-interactive shell here, so `-y` is mandatory.
- Before pushing, **`mv .git ../tmp`** then move it back after — the CLI uploads everything in cwd, including `.git`. (`safe-push.sh` does this + the restore-point check for you.)
- Fork workflow (`tiendanube theme authorize`, bearer token, install management) exists but is **Ipanema-theme only**. Everything else = FTP.

## Theme architecture (classic snipplet theme)

Applies to the classic snipplet themes (the live store here runs **`rio`**, a legacy theme; same file shape as other classic themes). **For porting a redesign onto rio — the header-with-modals trap, the mandatory legal footer, `.scss` scoping, transfer-price/modal/cart classes, mobile-overflow traps, and the structural-review-before-push workflow — read `rio-theme.md` in this skill dir.**

| Piece | Where |
|---|---|
| HTML shell, `<head>`, header/footer includes | `layouts/layout.tpl` |
| Per-page templates | `templates/{home,product,category,cart,...}.tpl` |
| Home is composed of sections | `snipplets/home/*` via `home-section-switch.tpl` (driven by `settings.home_order_position_*`) |
| Reusable product card (image/price/variants/add-to-cart/quickshop) | `snipplets/grid/item.tpl` (shared by home/category/search — restyle via CSS, don't edit markup per-page) |
| Header (nav, search, cart, modals) | `snipplets/header/*` — `header.tpl` includes `header-modals.tpl` (cart drawer `#modal-cart`, hamburger, notifications) |
| Styles (compiled) | `static/css/style-*.scss`; tokens in `style-tokens.tpl`. Add new stylesheets as `.scss`, phase-scoped, no global rules |
| Admin-configurable settings | `config/settings.txt` (these are DEFAULTS; live values are stored per-store, set in the visual customizer — NOT settable via API or theme files) |
| Legacy note (`rio`) | `theme pull --published` → 422; use plain `ftp pull`/`push`. The footer carries MANDATORY legal markup (`new_powered_by_link`, `claim-info`) — see `rio-theme.md` |

### Real data tags (verified)
- **Products on home**: `sections.primary.products` (Destacados), `sections.new.products` (Novedades — auto-fills from newest catalog), `sections.sale.products` (Ofertas). Loop through `{% include 'snipplets/grid/item.tpl' with {slide_item: true} %}` (set `section_columns_desktop/_mobile`, `section_slider` first). No generic `products` global on home.
- **Product fields**: `product.name`, `product.price | money`, `product.compare_at_price | money`, `product.url`, `product.available`, `product.variations`. Image via `component('product-item-image', {...})`.
- **Add to cart**: simple product = `<form class="js-product-form" method="post" action="{{ store.cart_url }}"><input type="hidden" name="add_to_cart" value="{{product.id}}"><input type="submit" class="js-addtocart ..."></form>`. Variant product = quickshop trigger `<span data-toggle="#quickshop-modal" data-modal-url="modal-fullscreen-quickshop" class="js-quickshop-modal-open js-fullscreen-modal-open js-modal-open">` (quickshop modal is included globally via `snipplets/grid/quick-shop.tpl`).
- **Nav menu**: `{% for item in navigation %}` → `item.url`, `item.name`, `item.subitems`.
- **Categories**: `{% for category in categories %}` → `category.url`, `category.name`, `category.handle`, `category.subcategories`. Home category tiles use `settings.slider_categories` (`slide.link | setting_url`, `slide.image | static_url | settings_image_url('small')`).
- **Cart**: count `cart.items_count`; cart page `store.cart_url`; ajax drawer opens via `data-toggle="#modal-cart"` + classes `js-modal-open js-fullscreen-modal-open` (modal lives in `header/header-modals.tpl`).
- **Search**: `{{ component('search/search-form', { placeholder_text: 'Buscar' | translate }) }}`.
- **Newsletter / popup email** (real subscribe, registers in store): POST to **`/winnie-pooh`** with fields `email`, hidden `name`, hidden `message`, hidden `type=newsletter`, hidden honeypot `winnie-pooh`, submit `name="contact"`. See `home-newsletter.tpl`.
- **WhatsApp**: `{% if store.whatsapp %}<a href="{{ store.whatsapp }}">` (full wa.me URL; set in admin, not theme).
- **Store info**: `store.name`, `store.contact_url`, `store.instagram`, `store.facebook`.
- **Static assets**: `{{ 'images/x.webp' | static_url }}`. ⚠️ Twig `|` binds tighter than `~`, so concatenated paths MUST be parenthesized: `{{ ('images/' ~ x ~ '.webp') | static_url }}`.

### Porting a redesign onto a live theme (pattern that works)
Start from a copy of the pristine FTP pull (minimal diff) and a git restore point. Then:
1. Scoped CSS in `static/css/<name>.scss` (**`.scss`, not `.css`** — matches the compiled pipeline), linked in `layout.tpl` head, per-template-gated (`{% if template == 'home' %}`), async (`media="print" onload`). Scope **every** rule under `.template-{home,product,…}` / an ID / a wrapper class — **no global `html/body/*/:root` rules**.
2. Gate off the default **footer + whatsapp** on that template (they carry no logic) so your design supplies its own. **Do NOT gate off `header.tpl`** if it carries the cart drawer / modals (it does on rio + classic themes) — keep it included and hide its bar via CSS, reuse its `#modal-cart` hook. Replacing the footer means re-carrying the MANDATORY legal markup (`new_powered_by_link`, `claim-info`).
3. Rewrite the template wired to the real tags above, with **graceful fallback** (`{% if sections.new.products %}`…real…`{% else %}`…demo…`{% endif %}`) so it never looks empty before the merchant configures the customizer. Reuse `grid/item.tpl` for cards.
4. Editable copy → **additive** `settings.txt` keys read with `| default(...)`; never remove existing keys.
5. Mobile: no negative-margin full-bleed (horizontal scroll), `@media (hover:none)` for touch add-to-cart, ≥44px targets, `.js`-gate scroll reveals.
6. Other pages keep stock theme. Verify structurally (no render/preview) — selectors must hit real classes; balanced tags; `diff -rq` = intended surface. `PUSH.md` documents push + rollback + deploy-time visual QA.

**Owner sign-off before the live push:** rio FTP has no preview, so the merchant approves the *direction* on a separate hostable demo (the redesign's `app/dist` mockups), not the live store. For a web+mobile, **commentable** review site (pinned comments → free Google Sheet, scope + sign-off) that the owner navigates and you triage, see the **commentable-review-site** skill. Pixel-truth is still confirmed only at deploy.

**→ Full rio playbook (the traps above, with verified code): `rio-theme.md` in this skill dir.**

## Admin REST API — store data

Base `https://api.tiendanube.com/v1/{store_id}`. Headers: `Authentication: bearer {token}`, `Content-Type: application/json`, and a real **`User-Agent`** (required — include a contact email). `store_id` == the OAuth `user_id`. Localized text fields are objects: `{"es": "..."}`. Prices are strings. Sanity check = `GET /store` (NOT empty path — that 404s).

### OAuth (get the token — needs a partner app)
1. Create app at **partners.tiendanube.com** → get **App ID** + **Client Secret**. Add product/category/order/customer/coupon read+write scopes you need (token scope limits everything later, e.g. `write_products` alone can't touch orders).
2. Put `TIENDANUBE_APP_ID` + `TIENDANUBE_CLIENT_SECRET` in `.env`. Owner opens `https://www.tiendanube.com/apps/{app_id}/authorize/`, authorizes → redirect carries `?code=...`.
3. `node oauth-token.mjs <code>` → exchanges + writes `TIENDANUBE_ACCESS_TOKEN` + `TIENDANUBE_STORE_ID` to `.env`. **Code is SINGLE-USE — capture on the first call, never just print it** (raw endpoint: `POST https://www.tiendanube.com/apps/authorize/token`, returns `{access_token, user_id (=store_id), scope}`).

`.env` is untracked/gitignored. Token = full store write access — never commit, never push to the theme.

### CRUD — anything, via the toolkit
```bash
node tn-api.mjs GET    /store
node tn-api.mjs GET    /products '{"fields":"id,name","per_page":"200"}'
node tn-api.mjs POST   /categories '{"name":{"es":"Hombre"}}'
node tn-api.mjs PUT    /products/123 '{"published":false}'
node tn-api.mjs DELETE /products/123
```
Library: `import { listProducts, createProduct, updateProduct, deleteProduct, createCategory, createCoupon, listOrders, addProductImage, listAll } from './tn-api.mjs'`. `listAll(path, params)` follows Link-header pagination. Helpers: `es('texto')` → `{es:'texto'}`, `money(n)`, `promo(n, pct)`. Product payload shape:
```js
{ name: es("Zapatilla X"), description: es("<p>…</p>"), categories:[catId],
  attributes:[es("Talle")],
  variants:[{ price:"89999", promotional_price:"71999", stock:8, values:[es("40")] }],
  images:[{src:"https://…"}], published:true, free_shipping:false }
```
- Images: pass a **public URL** in `src` — the API fetches it and re-hosts on the TN CDN (or POST base64 to `/products/{id}/images`).
- Coupons: `POST /coupons { code, type:"percentage"|"absolute", value, valid, max_uses, ... }`.
- Bulk seed: put the whole catalog in a JSON file and run `node create-catalog.mjs catalog.json` (see `catalog.example.json`).
- Catalogs with `variants` REQUIRE a top-level `"attribute"` (e.g. `"Talle"`) — without it the API 422s every variant product.
- `create-catalog.mjs` is NOT idempotent — re-running it duplicates categories and products.

**Customizer caveat:** creating products does NOT auto-place them in `sections.primary` (Destacados) — that needs a customizer "Productos" section. But `sections.new` auto-fills from newest products, so a wired home grid usually lights up once products exist. WhatsApp number, featured sections, popup config, category-tile images = admin/customizer only (no API, not in theme files).

## MCP server (optional convenience over the API)
`AlexandreProenca/nuvemshop-mcp-server` (Python). Build + register as stdio with Claude Code:
```bash
git clone --depth 1 https://github.com/AlexandreProenca/nuvemshop-mcp-server.git mcp
docker build -t <name>-mcp ./mcp
# env file: TIENDANUBE_ACCESS_TOKEN, TIENDANUBE_STORE_ID, TIENDANUBE_BASE_URL=https://api.tiendanube.com/v1, MCP_TRANSPORT=stdio
claude mcp add --scope user <name>-mcp -- docker run -i --rm --env-file <abs>/mcp/.env.runtime <name>-mcp python main.py
```
⚠️ Run `python main.py` directly — NOT `start.sh` (it prints banners to stdout and corrupts the stdio JSON-RPC). MCP wraps the REST API only; it cannot edit theme files. Scope of the token limits what it can do (`write_products` ≠ orders/customers).

## Common mistakes
| Mistake | Fix |
|---|---|
| `ftp push` without `-y` | Hangs on confirm prompt in non-interactive shell |
| Pushing without moving `.git` | Uploads `.git` to the store |
| Expecting a preview URL on FTP | There is none — push = live; keep a git restore point |
| `{{ 'a' ~ x ~ '.webp' \| static_url }}` | Only filters `.webp`; wrap in parens |
| `GET /v1/{store}` for sanity | 404 — use `GET /store` |
| Printing the OAuth token instead of saving | Code is single-use; you lose it and need a fresh code |
| Trying to set WhatsApp / featured section via API | Those are admin/customizer-only, not in API or theme files |
| Hand-rolling add-to-cart with variants | Reuse `snipplets/grid/item.tpl`; restyle via CSS |
