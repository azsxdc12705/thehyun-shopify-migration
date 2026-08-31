# thehyun.com → Shopify cutover checklist

The theme (`shopify-theme/`, deployed as *THE HYUN (option B port)* on the
dev store) now covers the full site: home, product template (all 65
products), category/sub-primal/bundles/gift-sets pages, the subscription
builder, and the 13 static pages. What remains is store content, commerce
configuration, and the domain move — in that order.

## 1. Store content (scripted, run once)

Either over the Admin API, with `SHOPIFY_DEV_STORE` / `SHOPIFY_DEV_TOKEN`
set (see **Provisioning without an Admin API token** below — the store can no
longer mint one from the old Develop-apps screen):

```
node scripts/make-pages.mjs --apply       # creates the 16 admin pages
node scripts/make-redirects.mjs --apply   # 112 legacy-path redirects
```

…or entirely from the admin UI, which needs no token at all — same section.

- Pages activate the ported designs by handle — no template assignment
  needed.
- Redirects map every Webflow URL (`/product/*`, `/sub-primal/*`,
  `/forequarter`, `/our-story`, …) to its Shopify home, preserving links
  and SEO.
- Optional: set each smart collection's sort to "Manually" in admin if the
  live site's curated product order within groups matters.
- Delete the duplicate **`offal-1`** collection in admin. "Offal" is both a
  Category and a Sub Primal in the Webflow CMS, and the first run of
  `make-collections.mjs` created it twice; the script now dedupes, but the
  extra collection is already on the dev store.

### Customer accounts — decide before cutover

The live site has real account pages (`/log-in`, `/sign-up`, `/user-account`)
and the redirects send them to `/account*`. This theme has no
`templates/customers/*`, so either:
- turn on Shopify's **hosted customer accounts** (no theme templates needed —
  recommended, and it is where Shopify is heading), or
- write the `customers/*` templates if you want them styled in-theme.

Subscribers need an account to manage their subscription, so this is not
optional for the Curated Collection.

### Stock has to be loaded before the storefront is honest

The Webflow CMS export carries no stock numbers, so every variant imported
with no quantity. The import now sets variants to track inventory and deny
oversell, but until real quantities land Shopify believes everything is in
stock: the ported store treats 46 cuts as buyable where the live site sells 7.

The live grids do expose the quantity per cut — Webflow renders all 54 and
hides what fails an inventory condition — so that reading is captured in
`audit/live-stock.json` and can be written onto the store now:

```
node scripts/set-inventory.mjs            # dry run
node scripts/set-inventory.mjs --apply    # write the quantities
```

That is a stopgap with a real ceiling: it is a snapshot from one day, and a
cut in stock reads as "2 or more" because the page never says how many. Point
the store at the `TheHyunInventory` sync (or a stock CSV from the POS) before
launch; this only stops the storefront from over-offering in the meantime.

## 2. Commerce configuration (owner)

- [ ] Pick a Shopify plan (also unlocks removing the storefront password)
- [ ] Shopify Payments with the real business details; enable the
      subscription-compatible payment methods
- [ ] Taxes (NY nexus), shipping zones/rates, local delivery + pickup
      (Store POS stays Square; `TheHyunInventory` syncs stock)
- [ ] **Enable Local Pickup** for the Gramercy store. This replaces the live
      site's `/checkout-method` interstitial ("Deliver to Your Doorstep" vs
      "In-Store Pickup"), which is deliberately not ported: Shopify's checkout
      picks the delivery method itself, so a pre-checkout page asking the same
      question cannot drive it and would only add a step. `/checkout-method`
      redirects to `/cart`.
- [ ] Customer notification emails (order, shipping, subscription billing)
- [ ] Newsletter: the footer form posts to Shopify customer capture
      (tagged `newsletter`); connect Klaviyo/em ail tool if wanted

## 3. Theme polish before publish

- [ ] Restore the real phone number in three places, all redacted for the
      public repo: `snippets/hyun-footer.liquid` (000.000.0000),
      `snippets/hyun-page-store.liquid` (+1.000.000.0000) and
      `snippets/hyun-page-contact.liquid` ((000) 000-0000)
- [ ] Real Instagram URL in the footer (currently `#`)
- [ ] Optional: quiz `pageshow` reset (bfcache) — known gap from the port

## 4. Fonts

- [ ] Adobe Typekit kit `ixk3mkf` → add `thehyun.com` and
      `d903wc-8k.myshopify.com` (or the production myshopify domain) to
      allowed domains
- [ ] URW Classico / Neue Haas font files currently load from the Webflow
      CDN inside `thyun.css` — re-host on Shopify's CDN before Webflow is
      shut off (upload as theme assets, rewrite the `@font-face` URLs)

## 5. Verify end to end (on the dev store first)

- [ ] Subscription checkout: quiz → checkout shows *Recurring subtotal …
      every 2 weeks*, preferences attached as line properties
- [ ] Product page → Add to Cart → cart → checkout for a one-time cut
- [ ] Gift set Buy now (return_to=/checkout)
- [ ] Contact / inquiry forms deliver
- [ ] Old-URL redirects resolve (spot check /product/brisket, /our-story,
      /forequarter)

## 6. Domain move

- [ ] Publish the theme on the production store
- [ ] Shopify admin → Domains → connect `thehyun.com` + `www`
      (A 23.227.38.65 / CNAME shops.myshopify.com per Shopify's current
      instructions)
- [ ] Lower DNS TTL a day ahead; switch; watch certificate issuance
- [ ] Webflow: disable ecommerce/site publish after DNS settles
- [ ] Announce / monitor analytics, checkout conversion, 404 logs
      (Shopify's URL redirect report catches misses)

---

## Provisioning without an Admin API token

Shopify has retired admin-created custom apps, so the old
*Settings → Apps and sales channels → Develop apps* route no longer issues new
tokens. Both provisioning steps can be done from the admin UI instead:

### Redirects — CSV import (2 minutes, 112 redirects)

```
node scripts/make-redirects.mjs --csv     # writes redirects.csv, no credentials
```

Then in admin: **Online Store → Navigation → URL redirects → Import**, upload
`redirects.csv`. The columns are Shopify's own (`Redirect from`,
`Redirect to`).

### Pages — 16 by hand

**Online Store → Pages → Add page**. Only the title and the handle matter;
the theme renders each design by handle, so leave the body empty. Two handles
do not match what Shopify derives from the title and must be set by hand in
the page's **Search engine listing → Edit** section:

| Title | Handle |
| --- | --- |
| Subscription Builder | `subscription-builder` |
| Japanese Wagyu | `japanese-wagyu` |
| Our Story | `our-story` |
| Brand Philosophy | `brand-philosophy` |
| Design Philosophy | `design-philosophy` |
| Bojagi Wrapping | **`bojagi`** (not `bojagi-wrapping`) |
| Local Delivery | `local-delivery` |
| Store | `store` |
| Contact | `contact` |
| Shipping and Returns | **`shipping-delivery`** (not `shipping-and-returns`) |
| Wholesale Inquiry | `wholesale-inquiry` |
| Corporate Gifts | `corporate-gifts` |
| Corporate Gifts Inquiry | `corporate-gifts-inquiry` |
| Subscription | `subscription` |
| Available Cuts | `available-cuts` |
| Gift Sets | `gift-sets` |

### If you do want a token (for re-runs and the product import)

Create the app in the **Dev Dashboard** (partners.shopify.com → Apps → Create
app → the API-only option), give it these Admin API scopes, install it on the
store, and copy the Admin API access token into `.env` as
`SHOPIFY_DEV_TOKEN` (with `SHOPIFY_DEV_STORE=d903wc-8k.myshopify.com`):

| Scope | Needed for |
| --- | --- |
| `write_products` | `import-products.mjs`, `make-collections.mjs` |
| `write_content` | `make-pages.mjs` (pages) |
| `write_online_store_navigation` | `make-redirects.mjs` (URL redirects) |
| `write_inventory` | `set-inventory.mjs` (stock levels) |

The token the earlier product import used already has `write_products`; the
other two scopes have to be added to that app and the app reinstalled before
the pages and redirects scripts will work.
