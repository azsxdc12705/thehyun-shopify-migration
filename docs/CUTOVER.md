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

Without a token, go through CSV — and assign SKUs in the same pass, since the
catalog imported with none and every later stock update, POS link and Uber
listing needs one to match on:

```
# Admin > Products > Export > All products > CSV
node scripts/fill-sku-inventory.mjs products_export.csv
# -> products_sku_inventory.csv, import under Products > Import
```

To rebuild the catalog itself rather than update it — the Weight axis, prices,
SKUs and the shop's real stock, all from the repo's own snapshots:

```
node scripts/make-catalog-csv.mjs      # -> catalog.csv
```

No row is invented. A cut's weights are the ones it has really been cut at —
the ledger's history plus whatever it holds today, each at the cut's current
per-pound rate — and the ones with no stock come through at quantity 0. That is
what keeps the Weight option alive: Shopify will not hold a product with no
variants, and losing that option is how the catalog broke on 2026-09-22.
`templates/product.liquid` leaves unavailable weights out of the select, so a
sold weight is gone from the storefront while the row survives in admin.

Deliberate omissions, each of which would otherwise do damage:

| Left out | Why |
| --- | --- |
| `Variant Taxable`, `Variant Requires Shipping` | 64 of 71 live variants are `taxable:false` and that split is per-product, so someone set it. An omitted column is preserved; a blank cell in a column that is present is not. |
| `curated-collection` | Its six live variant ids carry the selling plans and any subscription contract. Restoring the Frequency axis replaces those ids, and the product CSV has no selling-plan column to put them back. Restore it through the admin or the API, contracts checked first. |
| the `2lb` weight | The untouched Webflow default on 31 unrelated cuts — tongue, tail, heel, rib finger. Shipping it invents a two-pound cut nobody weighed. |
| `norigae-tassel` | Created in Shopify after the Webflow export, so `cms.json` cannot produce it. Not in the file, therefore untouched by the import. |

Every cut is tracked at `deny`, including the 21 with no weight at all. An
untracked variant is unconditionally available in Liquid, so an untracked cut
would be orderable without limit — top-round's source row is priced $49.84 and
the shop holds none. Inventory gates a cut; price must never be what holds it
back. Those 21 have no Weight option until one is stocked and added by hand.

**The Overwrite checkbox differs per file, and it matters.** `catalog.csv` needs
it ticked: with it, the importer replaces the variant set in place. The 9/22
forensics show this — `curated-collection` went from 12 variants to 6 while
every surviving variant kept `created_at 2026-08-25`, so variants absent from
the file were removed and none were recreated, which is also why no stray
"Default Title" row will survive this import. `products_sku_inventory.csv` from
`fill-sku-inventory.mjs` needs it **un**ticked: that file only adds SKUs to
variants that already exist.

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
