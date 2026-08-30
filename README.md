# thehyun-shopify-migration

Migration of thehyun.com's commerce from Webflow Ecommerce to Shopify, keeping
the Webflow front end (design untouched) and moving cart, checkout and
subscriptions to Shopify.

**Why.** Webflow sunset native subscriptions in January 2026. The shop's growth
product — Curated Collection, $150–$900, "Monthly / Twice a month" — is billed
`one-time` today; recurrence is arranged after the fact through a second Stripe
form. Of the 61KB of custom JS on the site, 49KB exists to patch Webflow's
cart and checkout. See `docs/WEBFLOW-AUDIT.md`.

**Architecture (option A):** Webflow stays as the front end and CMS. Shopify
holds the catalog, cart, checkout and subscription billing. Product pages get a
buy widget backed by the Storefront API; checkout is Shopify's. Store POS
remains Square; the inventory app (separate repo, `TheHyunInventory`) syncs
stock to Shopify over the Admin API.

## Layout

| path | what |
| --- | --- |
| `audit/` | Frozen snapshot of the Webflow site: CMS export (`cms.json`), all 103 pages' script inventory (`pages.json`), compiled stylesheet, the 16 custom scripts. API keys and contact details are redacted from the snapshot; catalog data is what the public site already serves |
| `docs/` | Audit findings, migration plan |
| `scripts/` | Webflow → Shopify migration tooling |
| `webflow-embed/` | JS embedded into Webflow (Storefront API buy widget) |
| `theme-port/` | Option B demo: the Curated Collection product page and the subscription-builder quiz ported off Webflow entirely (local CSS/assets, vanilla-JS nav, buy widget + quiz in mock mode) — proof the design survives a full Shopify theme migration |

## Status

- [x] Site + CMS audit
- [x] Shopify dev store, product + variant import (65 products / 85 SKUs, all published)
- [x] Subscription selling plans — **validated end to end 2026-08-25**: a test
      checkout of Curated Collection (Twice a Month / Signature / +Dining,
      $576) produced a real recurring contract — *"Recurring subtotal $576.00
      every 2 weeks"*, first + recurring shipments scheduled. One checkout, one
      form. This is the thing Webflow could not do at all.
- [ ] Buy widget in Webflow, checkout on Shopify — widget must pair the
      Frequency variant with the matching selling plan, so the mismatch
      possible on the Shopify product page cannot happen in front of customers
- [ ] Shopify Payments (real account — needs the owner's business details),
      taxes, shipping/pickup
- [ ] Cutover
