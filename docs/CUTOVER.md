# thehyun.com → Shopify cutover checklist

The theme (`shopify-theme/`, deployed as *THE HYUN (option B port)* on the
dev store) now covers the full site: home, product template (all 65
products), category/sub-primal/bundles/gift-sets pages, the subscription
builder, and the 13 static pages. What remains is store content, commerce
configuration, and the domain move — in that order.

## 1. Store content (scripted, run once)

With `SHOPIFY_DEV_STORE` / `SHOPIFY_DEV_TOKEN` in `.env` (same as the
import scripts):

```
node scripts/make-pages.mjs --apply       # creates the 14 admin pages
node scripts/make-redirects.mjs --apply   # ~100 legacy-path redirects
```

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

- [ ] Restore the real phone number in `snippets/hyun-footer.liquid`
      (redacted to 000.000.0000 for the public repo)
- [ ] Real Instagram URL in the footer (currently `#`)
- [ ] `/available-cuts` page (54-item availability grid) — not ported yet;
      redirect currently points it at `/collections/all`
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
