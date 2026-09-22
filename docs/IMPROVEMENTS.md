# Webflow → Shopify migration: what was found and fixed

A working record of the defects found and the corrections made while moving
thehyun.com — a Japanese Wagyu butcher in Gramercy, New York — from Webflow
Ecommerce to Shopify. Written as it happened, not reconstructed afterwards.
Every figure here was measured against the live site, the source catalog, or
the shop's own records; the supporting evidence is in the repository.

| Document | Contents |
| --- | --- |
| `docs/LIVE-SITE-BUGS.md` | 29 defects in the live Webflow site, with evidence |
| `docs/PORT-FIXES.md` | Defects found and fixed during the port itself |
| `docs/CUTOVER.md` | Cutover checklist and open decisions |
| `docs/INVENTORY-MANUAL.md` | Stock-entry manual for shop staff (Korean) |
| `audit/ledger-2026-09-22.json` | Stock and per-pound rates extracted from the shop's workbook |
| `audit/live-catalog-2026-09-22.json` | The damaged catalog, captured before any repair |

**The unusual thing about this shop.** One physical piece of meat is one
product variant. A striploin is not "a striploin" in stock somewhere — it is a
0.41 lb piece at $58.22 and a separate 0.56 lb piece at $79.52, each sold once.
Nearly every decision below follows from that.

---

## 1. A catalog corruption on launch day, and the repair

The site went live and immediately read sold out across the board. The
inventory was not the problem; the catalog itself had been damaged.

| | Expected | As found |
| --- | --- | --- |
| Variants | 85 | 71 |
| Priced $0.00 | 8 | 52 |
| Lost their Weight option | 0 | 65 |
| Cuts that could be bought | — | 1 of 54 |

The theme reads a $0.00 price as "not sold online" — the same rule the old site
used, where those 8 cuts meant "in-store only". At 52 the storefront had
effectively closed.

The cause appears to be a Products → Import run with "Overwrite" ticked and an
incomplete file. **The importer replaces a product's variant set rather than
merging into it**, and the evidence for that was in the damage itself:
`curated-collection` dropped from 12 variants to 6 while every surviving
variant kept `created_at 2026-08-25`. Variants absent from the file were
removed; none were recreated.

**Repair.** `scripts/make-catalog-csv.mjs` rebuilds the catalog from the
Webflow export plus the shop's stock ledger and emits an import-ready CSV.

**The import behaviour was tested before trusting it** — nine striploin rows
first, on the live store, and the result matched the prediction exactly:

```
before   Default Title · $0.00 · no SKU · untracked · 0 g
after    9 weights · no Default Title row · 7 in stock · SKUs and grams set
```

No stray variant survives. That answered the one question the rebuild depended
on and which no amount of reading the documentation would have settled.

---

## 2. Twenty-nine defects in the live site

These belong to the shop as it runs today, independent of the migration.
Several are losing orders or order data. Full write-ups in
`docs/LIVE-SITE-BUGS.md`.

### Orders lost, or arriving incomplete

| # | Defect |
| --- | --- |
| 1 | Checkout **locks out after 24 hours, permanently and silently**. No message; payment simply stops working |
| 2 | In-store pickup orders arrive with **no name, no phone and no pickup time** |
| 3 | Delivery orders **lose the apartment number** |
| 4 | The order's contact email is read from the **footer newsletter box** |
| 22 | **The charged amount is computed in the browser** and posted to the server. Whether that is exploitable depends on server-side re-pricing — worth confirming with whoever owns the middleware |

### Price data

| # | Defect |
| --- | --- |
| 9 | Seven products publicly priced $0.00 |
| 10 | Tongue priced 17× its peers |
| 11 | A Top Round SKU sold at "0.00 lb" |

The root cause of 10 and 11 surfaced later: the string `2lb` appears as the
weight on **31 unrelated cuts** — an untouched Webflow default, not a measured
piece. Tongue at $200 was that default multiplied by a per-pound rate.

### Cart and subscription

| # | Defect |
| --- | --- |
| 16 | A gift message **persists into later orders** |
| 17 | Add-on failures are invisible to the customer |
| 18 | Removing a subscription can leave two in the cart |
| 19 | The subscription add-to-cart gets **~900 ms before the page leaves**. Miss it and the customer arrives at checkout with an empty cart, cannot see the error, and cannot go back — the six-step quiz has to be redone |
| 20 | The double-submit guard sets `disabled` on an `<a>` tag, which does nothing |
| 21 | `/checkout` **blanks the address fields the customer is typing into**, at +300 ms and +1000 ms after load |

### Sold-out state (28, 29)

Webflow renders all 54 cuts into the page and hides the unavailable ones with
CSS, so a crawler sees markup a customer never does. That part works. The
condition behind it does not:

```
category pages     quantity > 0   →  hide the "sold out" badge
/available-cuts    quantity > 1   →  show the card
```

**A cut down to its last piece is for sale, is not marked sold out, and is
missing from the page named after availability.** The stock most worth moving
is precisely what gets hidden.

Separately, the sold-out badge sits at `opacity: 0` and only fades in on hover
— so on a phone, where there is no hover, 41 sold-out cuts look identical to
the 13 in stock.

> This one is worth noting for a different reason: I first reported the
> Available Cuts page as broken, the owner pushed back, and they were right.
> Re-measuring with a real browser rather than fetched HTML showed the page
> works and the defect is the off-by-one. The corrected finding is the more
> useful one.

---

## 3. Defects introduced by the port, caught before launch

A mechanical port carries over things that only worked in the original's
context. Found by reviewing the ported theme adversarially against the live
site. Full list in `docs/PORT-FIXES.md`.

### Would have cost money

- **Displayed price did not match the price charged.** The product page showed
  the first variant's price and never updated when a different weight was
  selected
- **Buying the subscription emptied the shopper's cart.** A `/cart/clear.js`
  call carried over from the Webflow workaround
- **Sold-out could never appear.** Variants imported without inventory
  tracking, so Shopify reported everything available forever and the entire
  sold-out treatment was unreachable

### Would have broken pages

- **`/available-cuts` would have shown 6 of 54 cuts, permanently.** The port
  froze Webflow's *evaluated* visibility classes — 101 elements carrying
  `w-condition-invisible`, which never recompute once they are Liquid
- **Zero-price products rendered an empty column** — one condition wrapped the
  price, the form and the out-of-stock notice together
- **The cart page rendered under a full-screen dark overlay** — a
  `position:fixed; inset:0; background:#000c` wrapper carried over verbatim
- **The quiz never ran**, and 404 / search / cart fell through to Shopify's
  bare default templates

---

## 4. Rebuilding the data

### Stock

The Webflow CMS export carries no stock at all. The numbers came from the
shop's own spreadsheet.

- **In stock** = a 2026 row with a weight, a price and no Sale date. Exactly 20
  rows out of 1,025 — matching the summary tab's own total
- Currently: striploin 7 · rib cap 5 · ribeye center 4 · chateaubriand 4

### Per-pound rates

**The date column could not be used.** 59 rows carry a production date *later
than their sale date*, all reading `2026-09-22` — a `TODAY()` formula that had
been overwritten into them. Ordering by date put rib cap at $95.00/lb off a
mistyped row when every real batch around it was $105.00. Rates were taken by
sheet order instead.

**21 cuts had their price corrected**, and about half were off by an order of
magnitude:

| Cut | Webflow | Shop ledger |
| --- | --- | --- |
| tenderloin-head | $17.25 | $142.00 |
| clod-heart | $8.75 | $93.00 |
| flank-steak | $9.00 | $95.00 |
| rib-plate | $5.25 | $89.00 |
| main-knuckle | $8.75 | $99.00 |
| top-sirloin-butt | $9.38 | $103.00 |
| chuck-tender | $11.63 | $75.00 |

These were not eccentric pricing — the Webflow weight/price pairs were simply
wrong, which is the same `2lb` default behind defect #10. Six cuts had no
usable price in Webflow at all and now have one.

Within a cut, price is exactly proportional to weight (all five striploin
weights land on $142.00/lb to the cent), so a rate plus a weight reproduces the
shop's own arithmetic rather than inventing a number.

### SKUs

Of 85 SKU records in the Webflow export, **zero carried a SKU code**. Assigned
`HYUN-<handle>-<weight in hundredths>` — `HYUN-RIBEYE-CENTER-034`. Handles go
in whole rather than abbreviated because this catalog has `rib-cap` beside
`ribeye-cap` and `top-round` beside `top-round-cap`; any shortening scheme
collides. The codes are the matching key for the POS and delivery-platform
integrations that come next.

### What the import file deliberately leaves out

| Omitted | Why |
| --- | --- |
| `Variant Taxable`, `Variant Requires Shipping` | 64 of 71 live variants are `taxable:false` — a per-product split someone set deliberately, and New York exempts unprepared food. An omitted column is preserved; a blank cell in a column that *is* present is not |
| The `2lb` weight | The Webflow default on 31 unrelated cuts. Shipping it invents a two-pound cut nobody weighed |
| `norigae-tassel` | Created in Shopify after the Webflow export, so the generator cannot produce it — and therefore the import cannot damage it |

Every cut is imported tracked with policy `deny`. An untracked variant is
unconditionally available in Shopify, so an untracked cut would have been
orderable without limit — top-round is priced $49.84 and the shop holds none.
**Inventory gates a cut; price must never be what holds it back.**

---

## 5. Shipped to production

Deployed to thehyun.com on 2026-09-22 and verified against the live site.

- **Sold-out weights are hidden.** A sold piece leaves the picker rather than
  sitting in it greyed out — it is gone, not a choice. striploin went from 9
  options to 6
- **Grids price from the cheapest piece actually in stock.** Previously they
  used the minimum price on file regardless of stock, so Ribeye Center was
  advertised at $48.28 when the cheapest buyable piece was $61.06
- **A rejected add-to-cart shows its reason.** A 422 from `/cart/add.js` — the
  piece sold while the page sat open, which with one piece per weight is an
  ordinary Saturday — was being treated as a network failure and retried as a
  full-page post that would be refused again, on a reload that loses the
  customer's place
- Real phone number and Instagram link, which had shipped as placeholders

### Where the new site is better than the one it replaces

- Every page has its own title (77 of 108 pages shared "THE HYUN")
- Images carry `alt` text (all were empty)
- The sold-out badge is visible without hovering
- `/available-cuts` shows a cut with one piece left
- 112 legacy URLs resolve through 301s
- Checkout is Shopify's, so the price is decided server-side — defect #22
  disappears structurally rather than being patched

---

## 6. Open

### Needs an owner decision

- **Three cuts still have no price anywhere**: brisket, brisket-point, omasum
- **Five ledger names match no product**: Baby loin, M.Gluters Medius,
  M.Gluteus Profundus, M.Piriformis, Oyster blade Cap. Held back until one is
  stocked (Pencil is confirmed as never listed online)
- **Shipping rates.** The live site computes them in a custom service keyed on
  ZIP, delivery-vs-pickup, weight and whether the item is a bundle or gift —
  perishable-shipping logic, not a carrier quote. Reusing that service needs
  carrier-calculated shipping (Advanced plan); reproducing it with Shopify's
  own zone × weight tiers works on any plan
- **Credential rotation.** The stock workbook contained an `IDPW` sheet. The
  sheet has been removed, but the values survive in earlier versions, backups
  and copies

### Queued

- Import the full `catalog.csv`
- Confirm the 12 `curated-collection` variants come back with their selling
  plans attached — the plans read as product-level rather than per-variant, so
  they should be inherited, but that is worth checking rather than assuming
- Real stock sync (`TheHyunInventory`); until then staff enter stock by hand
- Enter the SKUs in Square, which currently has none
