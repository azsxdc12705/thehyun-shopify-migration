# Defects found and fixed in the port

Companion to `docs/LIVE-SITE-BUGS.md`, which covers the live Webflow site's own
defects. This file records problems in **this migration's own work** — found by
auditing the port across four dimensions (coverage, live JS, content/catalog,
adversarial theme review) after the templates were complete, and all fixed.

Each entry names the commit that fixed it. Everything was re-verified against
the dev store after the fix.

---

## Would have cost money

### Displayed price did not match the price charged
`templates/product.liquid`, `assets/site.js` — `1e24682`

The heading printed `product.price_min` while the weight picker pre-selected
`variants.first`. On `/products/tri-chuck` the page advertised **$32.55** and
the form carried **$37.80**. Nothing updated the price when the shopper changed
weight either, so the mismatch persisted through the whole selection.

Now the price comes from the selected variant, that option carries `selected`,
and `site.js` re-renders the price on change — what Webflow's commerce runtime
did on the live page. Affected `tri-chuck`, `striploin`, `ribeye-center`.

### Buying the subscription emptied the shopper's cart
`assets/buy-widget.js`, `assets/quiz.js` — `1e24682`

Both posted `/cart/clear.js` before `/cart/add.js`. Under the Storefront API
that was right — `cartCreate` built a *separate* cart. After the switch to
native mode it is the shopper's real cart, so "Buy Now" on the product page or
"Continue to Checkout" in the quiz silently discarded everything else they had
added.

### Sold-out could never appear
`scripts/import-products.mjs` — `1e24682`

The CMS snapshot carries no stock numbers, so variants imported without
inventory tracking and Shopify reported every one of them available forever.
That made the sold-out treatment in `hyun-cut-group`, `hyun-subprimal-page`,
`hyun-gift-set-row` and `product.liquid` unreachable — on the live site 41 of
54 cuts are sold out today.

Variants now import with `inventoryItem.tracked` and `inventoryPolicy: DENY`;
quantities come from the inventory app after import.

---

## Would have broken pages

### `/available-cuts` would have shown 6 of 54 cuts, permanently
`snippets/hyun-page-available-cuts.liquid` — `1e24682`

The mechanical port froze Webflow's *evaluated* inventory conditions: 101
elements came across carrying `w-condition-invisible`, which `thyun.css` hides
with `display: none !important`. On Webflow those classes were recomputed per
publish; frozen into Liquid they never change. 48 of the 54 cards would have
stayed hidden regardless of what Shopify said — defeating the page's only
purpose. The ported inline script also bailed unless the path was the legacy
`/available-cuts`.

Both fixed: the classes and the inline `opacity:0` on sold-out badges stripped,
and the path guard now matches `/pages/available-cuts`.

### Zero-price products rendered an empty column
`templates/product.liquid` — `1e24682`

The `{% if product.price_min > 0 %}` guard wrapped the price, the form **and**
the out-of-stock `{% else %}`, so the 8 zero-price cuts showed nothing at all
where the live template shows "This cut is currently unavailable".

### Cart page rendered under a full-screen dark overlay
`templates/cart.liquid` — `e929d76`

The live page nests its item list inside Webflow's modal cart wrapper
(`.w-commerce-commercecartcontainerwrapper`, `position: fixed; inset: 0;
background: #000c`), which only stays out of the way because Webflow's cart JS
manages it. Ported verbatim without that runtime, it covered the page. The
wrapper is dropped; `.cart-page-container` carries the layout.

### The quiz never ran
`snippets/hyun-quiz.liquid` — `f45fd4d`

`window.HYUN_QUIZ` was configured but `quiz.js` was never loaded, so the
subscription builder was inert on Shopify.

### Utility routes fell back to Shopify's bare defaults
`templates/404.liquid`, `search.liquid`, `cart.liquid`, `password.liquid`,
`page.liquid` — `bcfd0ad`, `7e3521b`

Any URL without a template — a 404, search, the password gate — rendered
Shopify's unstyled default page. All now render in the theme.

---

## Behaviour that silently did nothing

### Cart quantity input
`assets/cart.js` — `1e24682`

The field accepted input and changed nothing; the `cart-qty-readonly` class it
carries has no rule anywhere. Wired to `/cart/change.js`, matching the live
site's update-item-quantity action.

### Gift-message modal went stale
`templates/cart.liquid` — `1e24682`

The modal sat outside the region `cart.js` re-renders, so after clearing a
message it still showed the old text until a full reload. Moved inside
`[data-hyun-cart-page]`.

---

## Fidelity regressions

| What | Fix | Commit |
| --- | --- | --- |
| Sub-primal pages marked both the parent primal's "All" and the sub-primal as current; live marks only the sub-primal | `hyun-cuts-tabs` guards the All link on `current_sub == blank` | `1e24682` |
| `/collections/all` titled "Products", `/cart` titled "Your Shopping Cart" | Named as the live site names them | `1e24682` |
| Body background class keyed off a template name that never matches (the page is dispatched by handle) | Keyed off `page.handle` | `1e24682` |
| Category grids in Shopify's default order; live is alphabetical | `sortOrder: ALPHA_ASC` on the smart collections | `1e24682` |
| Footer "Gift Sets" pointed at the listing; the live footer points at the landing page | Repointed (the nav dropdown keeps the listing, as live) | `1e24682` |
| Buy widget CSS half-missing — quantity field visible, Buy Now cream instead of black | Second half of the widget-fit block restored | `7e3521b` |
| Phone number left un-redacted on the store and contact pages while the footer was redacted | All three redacted; restore points listed in `CUTOVER.md` | `1e24682` |

---

## Coverage gaps

| Gap | Fix | Commit |
| --- | --- | --- |
| `/available-cuts` and `/gift-sets` had no ported design — both collapsed onto other pages via redirect | Ported; `/gift-sets` is a distinct landing page from `/gift-sets-list` | `aae1c2a` |
| `/log-in`, `/sign-up` had no redirect | → `/account/login`, `/account/register` | `aae1c2a` |
| The three typo'd sub-primal paths from the live `/loin` and `/offal` (all 404 on Webflow) | Redirected so links already in the wild land somewhere real | `aae1c2a` |
| `href="/collections/Knuckle"` — capitalised, carried over from the live page's own 404 link | Lowercased | `aae1c2a` |
| "Offal" is both a Category and a Sub Primal, so `make-collections.mjs` created it twice and Shopify handed the second `offal-1` | Deduped; the existing duplicate needs deleting in admin (noted in `CUTOVER.md`) | `aae1c2a` |
| Control characters (U+0008) in two product titles rode into Shopify | `import-products.mjs` sanitizes titles; a re-run repairs them | `b7e20d8` |

---

## Improvements over the live site

Not defects in the port — places where the port deliberately does better, and
the reasoning is recorded so it survives review.

- **No Storefront API token needed.** `hyun-product-json.liquid` renders the
  product's variant and selling-plan IDs into the page and checkout goes
  through the Cart AJAX API. Setting this up surfaced that the demo's
  hardcoded variant IDs had already gone stale — Liquid renders current ones
  per request. (`9541cc4`)
- **The quiz's review step works.** The live list names two categories the
  quiz never asks and omits three it does, and nothing ever filled the values.
  The port lists the six real questions and fills them. (`c802256`)
- **The cart drawer shows the selling plan and the quiz preferences.** The
  live drawer shows neither. (`e929d76`)
- **The gift message reaches the order.** On the live site it lives only in
  localStorage — and is never cleared, so it follows the customer into later
  orders. Here it is a cart attribute. (`e929d76`)
- **Mis-targeted CTAs corrected**: the corporate-gift inquiry buttons pointed
  at a product listing and the wholesale form; the home slider's Round slide
  had no destination. (`549f387`)
- **Per-page titles and meta descriptions.** 77 of 108 live pages share the
  title "THE HYUN" and none has a description. (`b4a86b6`, `1e24682`)
