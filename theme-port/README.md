# theme-port/ — option B demo: two templates with zero Webflow

1:1 ports of live pages (crawled 2026-08-30) proving that a **full Shopify
migration (option B — no Webflow at all)** keeps the design intact. Everything
Webflow served at runtime is gone; the pages render from this directory alone
plus fonts.

| page | port | buy path |
| --- | --- | --- |
| [`/product/curated-collection`](https://www.thehyun.com/product/curated-collection) | `index.html` | `buy-widget.js` (mock mode) |
| [`/subscription-builder`](https://www.thehyun.com/subscription-builder) | `subscription-builder.html` | `quiz.js` (mock mode) |

Run it:

```
python3 -m http.server 8123        # repo root (matches .claude/launch.json)
open http://localhost:8123/theme-port/
open http://localhost:8123/theme-port/subscription-builder.html
```

## What was removed (vs. the live page)

- `webflow.js` (all three chunks) and Webflow's jQuery build
- Stripe.js + the Webflow ecommerce key / currency settings
- The Webflow cart machinery (GraphQL cart query, cart dropdown, templates)
- Checkout patch scripts (hidden-required-fields disabler, cart activity
  timer, product price formatter) — under a Shopify checkout they patch
  nothing; see `docs/WEBFLOW-AUDIT.md`
- `webfont.js` loader (replaced by a plain Google Fonts stylesheet link) and
  the Typekit JS kit (replaced by the kit's CSS endpoint)
- Cloudflare Turnstile attributes and Webflow form-backend wiring

## What replaces it

| piece | file |
| --- | --- |
| Compiled stylesheet, image URLs localized | `assets/thyun.css` (from `audit/thyun.css`) |
| Images, rehosted from the Webflow CDN | `assets/*.svg` `*.jpg` `*.png` |
| Nav interactions: dropdowns + hamburger (over-left slide), vanilla JS against the same `w--open` / `data-nav-menu-open` CSS contract | `assets/site.js` |
| Buy area: Storefront API widget (one Frequency choice drives variant **and** selling plan) | `assets/buy-widget.js` (copy of `webflow-embed/buy-widget.js`) |
| Mock Storefront API — real dev-store variant/plan IDs, active when `data-token` is empty | `assets/mock-storefront.js` |

Real mode: set `data-shop` / `data-token` on the `[data-hyun-buy]` mount in
`index.html` and drop `mock-storefront.js`.

## The subscription-builder page

The quiz (6 steps + review) is the Webflow-designed DOM verbatim; the state
CSS from the live page's inline head block is carried over (steps hidden until
`.is-active`, cards highlight via `.is-selected`). Driving it is
`assets/quiz.js` — a copy of `webflow-embed/quiz.js`, the 5.7KB Shopify port
of the legacy 11.3KB quiz script. What the legacy script spent its bytes on
(syncing a hidden Webflow add-to-cart form, a second preferences form,
localStorage one-subscription-per-cart guards, cart-popup suppression) Shopify
does natively: one `cartCreate` with the selling plan and the preferences as
cart line attributes. The deleted machinery: the hidden Webflow commerce form,
the off-screen preferences form, both patch scripts, Stripe, the cart
dropdown.

Real mode: fill in `window.HYUN_QUIZ = { shop, token }` in
`subscription-builder.html`.

**Live-site bug the port fixes**: on the live page, choosing *Delivery +
Dining Credit at HYUN* and continuing fails with "Cart connection is not
ready yet." — the quiz card's value (`Delivery + Dining at HYUN`) never
matches the Webflow select option (`Delivery + HYUN Dining`), so the hidden
form sync aborts and the dining-credit path cannot be purchased. `quiz.js`
maps the values explicitly, so the same click-through checks out.

## Deliberately not in the repo

- **Font files.** URW Classico / Neue Haas load from their existing remote
  URLs (Adobe Typekit kit `ixk3mkf` + the site's own CDN uploads); the
  licences don't allow committing them to a public repo.
- **The shop's phone number** — redacted to `000.000.0000` in the footer, per
  the same policy as `audit/`. Restore at deploy.

## Known fidelity gaps

1. **Buy button**: `Buy Now` (straight to Shopify checkout via `cartCreate`),
   greyed until all three options are picked. The live page shows an
   always-black `Add to Cart` that errors after the fact — the widget's
   behaviour is the intended improvement, not an accident.
2. **Fonts still load remotely** (Adobe + the current CDN). At cutover the
   Typekit kit's allowed-domain list must include the Shopify domain, and the
   self-hosted URW Classico/Neue Haas files must move to Shopify's CDN.
3. **Right product column sits ~9px higher** than live (the widget stack is a
   few pixels taller than Webflow's form; the row is vertically centered, so
   the difference halves).
4. **Cart icon is static** (count 0, no dropdown). Under option B cart and
   checkout live on Shopify; the icon should link to the Shopify cart.
5. **Footer newsletter form is visual-only** — the Webflow form backend and
   Turnstile are gone. Needs Shopify Forms/Klaviyo equivalent.
6. **Internal links** (`/our-story`, `/bojagi`, …) resolve only once the rest
   of the site is ported; paths are kept identical so URLs survive migration.
7. **Quantity input hidden** to match the live page (which hides it via
   `.quantity-5`); the widget always buys quantity 1.
8. **Quiz back-navigation reset**: the live page blanks the quiz to step 01 on
   `pageshow` (bfcache restore from cart/checkout); `quiz.js` doesn't — a
   plain reload gives the same fresh state. Only visible when navigating back
   from checkout.
9. **Quiz review placeholders**: the five "Frequency: — …" lines stay as
   dashes after completing the quiz — identical to live, where the legacy
   script never fills them either. Left as-is deliberately.

Comparison screenshots (live vs. port, desktop 1440 / mobile 390, menu-open
state) are generated with Playwright; they are kept out of the repo because
the live captures contain the unredacted footer.
