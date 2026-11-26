# rio theme — porting a redesign onto the live theme

`rio` is a **legacy** Tienda Nube theme. It uses the **classic snipplet architecture** (identical in shape to other classic themes): `layouts/layout.tpl`, `templates/*.tpl`, `snipplets/`, `config/settings.txt`, `static/css/*.scss`. ~151 files in a full pull.

**Legacy ≠ modern theme API:** `tiendanube theme pull --published` → **422**. Use plain **`tiendanube theme ftp pull` / `push`** (FTP, no preview). Editing needs **Plan Impulso**.

This doc is the verified playbook for porting a bespoke design onto a live rio store as **push-ready theme files with a minimal diff** (only the files you intend to change differ from the pristine pull; every other page stays byte-identical to live).

---

## 1. Build model — minimal diff over a pristine pull

- `theme/` = a copy of the **pristine FTP pull** (minus `.git`/`.nuvem`/`.DS_Store`). Start from the exact live theme so a future push diffs ONLY the files you intentionally change.
- Commit the pristine pull as a **git restore point** before touching anything (rollback = `git checkout . && ftp push -y`).
- After each phase, prove the diff: `diff -rq pristine/ theme/ --exclude='.git' --exclude='.nuvem' --exclude='.DS_Store'` should list ONLY your intended files.
- Deliver `theme/` + a `PUSH.md` (push command, rollback, deploy-time visual QA, pre-launch data dependencies). **Do not push as part of the build** unless asked — FTP push is live.

## 2. The header carries critical modals — DO NOT gate it off

rio's `snipplets/header/header.tpl` includes `header-modals.tpl`, which emits the **ajax cart drawer (`#modal-cart`)**, the add-to-cart notification, the cross-sell modal, and `#nav-hamburger` / `#nav-search` — as top-level `<div class="js-modal modal …">` siblings **outside** the `<header class="head-main">`.

**Wrong (breaks the cart drawer):** `{% if template != 'home' %}{% snipplet "header/header.tpl" %}{% endif %}`.

**Right:** keep `header.tpl` **included unconditionally**. Hide only its visible bar with template-scoped CSS, and let your custom header reuse the existing hooks:
```css
.template-home .head-main,
.template-home .header-advertising,
.template-home #shipping-bar-header { display: none !important; }
/* keep the modal machinery reachable */
.template-home #modal-cart, .template-home .js-modal-overlay,
.template-home .js-overlay, .template-home .js-notification { display: revert; }
```
Your header's cart icon must open the drawer (with a safe fallback when ajax cart is off):
```twig
{% if settings.ajax_cart and not store.is_catalog %}
  <a href="#" class="js-modal-open js-fullscreen-modal-open" data-toggle="#modal-cart" data-modal-url="modal-fullscreen-cart" aria-label="Carrito">
{% else %}
  <a href="{{ store.cart_url }}" aria-label="Carrito">
{% endif %}
  …svg… <span class="js-cart-widget-amount">{{ cart.items_count | default(0) }}</span></a>
```
Footer + the WhatsApp snipplet have no such modals → those ARE safe to gate off on the template that supplies its own.

## 3. The footer carries MANDATORY legal markup

If you replace `snipplets/footer/footer.tpl` with your own, you MUST carry over, or you ship a **ToS + consumer-law violation**:
- `{{ new_powered_by_link }}` — the Tienda Nube credit link. **Required visible + functional** by their Terms of Use.
- `{{ component('claim-info', { … }) }}` — consumer-defense / "botón de arrepentimiento" links (AR Ley 24.240). Must be **real links**, not static text. Copy the exact param shape from the stock footer.
- `{{ component('nubesdk-slot', { type: "before_footer" }) }}` — app-injection slot (reviews apps, etc.).
- Business-name/CUIT copyright: `"Copyright {1} - {2}…" | translate( (store.business_name ? store.business_name : store.name) ~ (store.business_id ? ' - ' ~ store.business_id : ''), "now" | date('Y') )`.
- Keep a `js-footer-legal` element — `store.js` sizes it as the cookie-banner offset.

`templates/password.tpl` is **standalone** (own `<html>`, does NOT use `layout.tpl`) and includes the stock footer directly — its legal block is intact there; don't worry about it, but it also won't pick up `layout.tpl`-linked stylesheets (link them in its own `<head>` if you want it branded).

## 4. Stylesheets — `.scss`, phase-scoped, zero global rules

- Add `.scss` not `.css` — rio's static pipeline compiles `.scss` (`style-async.scss` etc.). Plain CSS is valid SCSS, so no syntax cost.
- Link per-template in `layout.tpl`, gated `{% if template == 'product' %}…`, async like rio's `style-async.scss` (`media="print" onload="this.media='all'"` + `<noscript>` fallback).
- **Every rule scoped** under `.template-{home,product,category,search,cart}`, an explicit wrapper class, or an ID (`#modal-cart`). **No bare `html/body/*/:root` rules** — verify: `grep -nE '^(html|body|\*|:root)' static/css/<your>.scss` must be empty. Re-declare your design tokens (`--bg` etc.) on the scope selector, not `:root`.
- The shared product card `snipplets/grid/item.tpl` renders on home + category + search. **Restyle it via CSS only**; don't edit its markup in a single-page phase or you change the other pages. Its real classes: `item-name`, `item-price`, `price-compare`, `item-installments`, `item-image`, `item-image-featured`, `js-item-product`, `js-addtocart`, `item-actions`, `item-btn-quickshop`.

## 5. Known rio tags / components (verified)

- **Home products**: `sections.primary.products` (Destacados), `sections.new.products` (Novedades, auto-fills from newest), `sections.sale.products` (Ofertas). Loop `{% include 'snipplets/grid/item.tpl' with {slide_item: true} %}` after setting `section_columns_desktop`/`section_columns_mobile`.
- **Transfer price ("precio por transferencia")** is a server component: `component('payment-discount-price', { visibility_condition: settings.payment_discount_price, location: 'product' })`. Its internal class is NOT reliably selectable — **wrap the call in your own hook** `<div class="tn-transfer-price">{{ component(...) }}</div>` and style that to make it the headline. Same for installments: `component('installments', { … container_classes: { installment: "item-installments" } })`.
- **Struck promo price**: `product.compare_at_price | money` → class `price-compare` (already in markup; just restyle).
- **Modals** use `{% embed "snipplets/modal.tpl" with { modal_id, modal_class, modal_width, modal_position, modal_transition, modal_mobile_full_screen, modal_header_title: true } %}` with `{% block modal_head %}` + `{% block modal_body %}`. **`modal_header_title: true`** is what renders the header/title region — `modal_head`/`modal_body` are NOT params (just block names).
- **Size guide**: rio has a native page-driven one gated on `settings.size_guide_url` (`#size-guide-modal`). Build a fallback modal only `{% if has_size_variations and not settings.size_guide_url and not quickshop %}`.
- **Cart page vs drawer** use DIFFERENT markup. Drawer line item: `.cart-item`, `.cart-item-name`, `.cart-item-subtotal`. Cart PAGE line item: bootstrap `col-*` cells, name link `[data-component="name.short-name"]`, no `.cart-item-name`. Present on BOTH: `.js-cart-item`, qty field `.js-cart-quantity-input`, qty +/- `.js-cart-quantity-btn.btn` (the `.js-cart-input-spinner`/`.cart-item-spinner` is a hidden loading span, NOT the buttons). Checkout button: page `#go-to-checkout.btn.btn-primary`, drawer `.js-ajax-cart-submit > input.btn.btn-primary` (the `js-ajax-cart-submit` class is on the WRAPPER div). `#modal-cart` only renders when `template != 'cart'` (header-modals).
- **Mobile filter modal** `#nav-filters` (`filters-modals.tpl`) is **portaled to `<body>`** by `store.js` (`.detach().appendTo("body")`). Body keeps its `template-category`/`template-search` class, so `.template-category #nav-filters …` still scopes correctly — style it or the mobile filter UI stays stock while desktop is restyled. Classes inside: `.subtitle`, `.checkbox-text`, `.js-filter-checkbox`, `.js-apply-filter`, `.js-remove-filter.chip`.
- **Account templates are dotted** (`template == 'account.login'`) → body class `template-account-login`. Use `[class*="template-account"]` to scope. Account screens use responsive `col-*` grids, **no `<table>`** — no wide-table mobile overflow.

(For the cross-theme/general tags — newsletter `/winnie-pooh`, `navigation`, `categories`, `store.*`, `static_url` parenthesization — see the parent SKILL.md; they hold on rio too.)

## 6. settings.txt — additive only

Append new `text`/`textarea` fields (tab-indented `name` + `description`) at EOF for editable copy; read them in templates with `| default('demo copy')` so a blank field still renders. **Never remove/rename an existing key** (orphans the merchant's stored value). settings.txt holds DEFAULTS; live customizer values are per-store and are NOT reset by a push.

## 7. Graceful fallback (so it never looks empty pre-launch)

Every real-data block: `{% if <real tag> %}…real…{% else %}…demo/empty-safe…{% endif %}`. The home must look intentional before the merchant configures the customizer or fixes catalog data. Reuse `grid/item.tpl` for product cards rather than hand-rolling add-to-cart/quickshop.

## 8. Mobile correctness (the traps that bite without a preview)

- **No `body{overflow-x:hidden}` exists** in rio → any horizontal overflow = a real scrollbar. The classic offender: a "full-bleed" element using `width:100%` **plus** `margin-inline: calc(-1 * var(--gutter))` — that overflows the viewport. For a sticky mobile add-to-cart, use `position:sticky; bottom:0; width:100%; margin-inline:0; padding-inline:0` (no negative-margin bleed).
- **Touch has no `:hover`** → hover-revealed card add-to-cart is unreachable on mobile. Force it visible under `@media (hover: none)`.
- **Touch targets ≥44px** — rio's qty input defaults to ~40px; bump it. Inline text links that are legally-required taps (consumer-defense) need `display:inline-block; padding-block:.5rem`.
- Don't `display:none` the only search trigger on mobile.
- Keep one breakpoint system (rio/this redesign: 375 / 768 / 1024 / 1440). Mismatched nav vs sticky-ATC breakpoints create dead zones.
- Reveal-on-scroll CSS must be **`.js`-gated** (`<script>document.documentElement.classList.add('js')</script>` before content + `<noscript>` reveal) or the page is blank without JS.

## 9. Verify before push (no render, no preview → structural review)

`.tpl` can't render locally and FTP has no preview, so the pre-deploy bar is **structural review**, not runtime tests:
- Every block wires a real tag and has an `{% if %}…{% else %}` fallback.
- CSS has zero global rules; scoped to the phase's `.template-*`.
- Header stays included (cart drawer alive); cart icon → `#modal-cart`; quickshop intact.
- Footer keeps `new_powered_by_link` + `claim-info`.
- Every CSS selector targets a class that ACTUALLY EXISTS in the rio markup (grep the pristine snipplet — a class guessed from another theme silently no-ops).
- Jinja `if/for/embed` and HTML tags balanced (`grep -Fc '{% if '` vs `'{% endif %}'`).
- `diff -rq` shows only the intended push surface.
- A **multi-agent structural review** (independent reviewers per phase + a mobile pass, each verifying selectors against the pristine theme) catches the silent-no-op and legal/ cart-drawer regressions that a single read misses. Visual QA is unavoidably a deploy-time step — document it in `PUSH.md`.
- **Owner approval** of the *design direction* happens before the push on a hostable demo (not the live store, which can't preview). For a web+mobile commentable review site (pinned comments → Google Sheet) built from the redesign mockups, see the **commentable-review-site** skill.
