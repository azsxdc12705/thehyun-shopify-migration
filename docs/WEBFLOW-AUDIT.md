# Webflow site audit — thehyun.com

Crawled from the published site on 2026-08-25: 103 pages, every inline script,
external script and the compiled stylesheet. Raw material (full custom-code
files, page JSON, CSS) is in the crawl workspace; this records what matters.

## Page inventory (103 pages)

| group | pages |
| --- | --- |
| products (`/product/*`) | 58 |
| sub-primal category (`/sub-primal/*`) | 14 |
| top-level category (loin/round/plate/forequarter/offal…) | 6 |
| story/brand (our-story, brand-philosophy, design-philosophy, japanese-wagyu, bojagi…) | ~8 |
| commerce flow (store, cart, checkout, checkout-method, sign-up, log-in, user-account) | 7 |
| subscription (subscription, subscription-builder) | 2 |
| info (contact, shipping-delivery, wholesale-inquiry, corporate-gifts…) | ~8 |

**5 broken internal links** found in navigation/pages, all category-link typos:
`/s/sub-primal/offal`, `/sub-primal/Knuckle` (capital K), `/sub/sub-primal/rump`,
`/subc/sub-primal/rump`, `/subcategories/offal`. Worth fixing in Webflow now
regardless of any migration.

## Custom code: 16 scripts, 61KB — and 49KB of it patches cart/checkout

| script | size | where | what it does |
| --- | --- | --- | --- |
| 0d52f91c | 2.5KB | all 103 pages | disables hidden required checkout fields so they don't block checkout |
| 47008c2b | 0.5KB | all 103 pages | cart activity timer (localStorage) |
| 72e731fb | **18.8KB** | /cart | cart page logic |
| b4e0a2ad | **11.6KB** | /checkout | checkout button behaviour |
| 67aa122c | 6KB | /checkout | ZIP validation |
| 0f6c5eaa | 5.4KB | /checkout | Google Maps address autocomplete |
| d05a22f2 | 1.9KB | /checkout | clears checkout fields |
| 543cec0e | 1KB | /checkout | gift message fields |
| e521cbcb | 0.9KB | /checkout | pickup section toggle |
| 75005a2b | 0.6KB | /checkout | shipping-state default workaround |
| e20322be | 0.5KB | /checkout | order method from session/localStorage |
| 7dd6221c | 0.4KB | /checkout | 24h cart timeout |
| a85f5041 | 0.5KB | /checkout-method | delivery vs pickup selection |
| **b5ce728b** | **11.3KB** | /subscription-builder | **subscription quiz (frequency × collection size × experience) — a real feature** |
| 649dee4d | 0.7KB | 58 product pages | price display formatting |
| a85030f4 | 0.3KB | /available-cuts | page guard |

**The finding:** 13 of 16 scripts (~49KB) exist to patch Webflow's cart and
checkout. Under a Shopify-checkout architecture every one of them is deleted,
not ported — Shopify's checkout does natively what this code fights for.
What actually gets ported is small:

- the **subscription-builder quiz** (11KB) — rewired to Shopify selling plans
- the **product price formatter** (0.7KB) — or replaced by the buy widget
- the **address autocomplete** — Shopify checkout has this built in; delete too

## External dependencies

- `js.stripe.com/v3` on all pages (Webflow's payment path)
- Adobe Typekit (`use.typekit.net/ixk3mkf.js`) — **font licence is tied to
  allowed domains; if pages ever move host, the kit's domain list must be
  updated in the Adobe account**
- Google Maps JS API for checkout address autocomplete (key redacted from the
  snapshot in this repo)
- Design: one compiled stylesheet, 192KB (`thyun.webflow.shared.*.css`)

## What this means for the Webflow-front / Shopify-back option

The custom code is not a migration burden — it is a symptom inventory. Nearly
all of it documents exactly which parts of Webflow commerce the shop had to
fight, and all of those parts are the ones being replaced. The two real
features to carry over are the subscription quiz and product-page price
display.

---

# CMS structure (pulled via Data API, 2026-08-25)

Six collections. Two are cruft: `Sub-Primals` (0 items — an abandoned duplicate
of `Sub Primals`) and `Gift Sets` (0 items).

| collection | items | maps to Shopify |
| --- | --- | --- |
| Products | 65 | Products, 1:1 |
| SKUs | 85 | Variants (`Option1: Weight` carries over as the variant option) |
| Categories | 10 | Collections |
| Sub Primals | 14 | Collections (product → sub-primal is a Reference field) |
| Sub-Primals, Gift Sets | 0 | skipped |

Product fields with no native Shopify slot — go to metafields: `korean-name`,
`contents` (rich text), `parts`, `bg-color`. `available-stock` is set on only
17 of 65 products; real inventory lives in the inventory app, which becomes the
source of truth via the Admin API.

## The subscription finding

**Of 85 SKUs, exactly one is billed as a subscription** (Custom Collection,
$50/month). The twelve Curated Collection variants — the $150–$900 products
with `Frequency: Monthly / Twice a month` printed on them — are **billed
`one-time`**.

So the site sells a product *named* "Monthly" that charges once. Recurrence has
to be arranged after the fact (the second form the user described), because
Webflow's native subscriptions — sunset January 2026 — could never express
this catalog. This is the strongest single argument for the migration, in the
shop's own data: the growth product the owner wants to build on is not actually
a subscription today.

In Shopify this is one product, two option axes (Frequency × Collection Size),
and a selling plan group — natively recurring, one checkout.
