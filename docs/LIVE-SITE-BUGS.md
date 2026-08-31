# Bugs found in the live Webflow site

Found while auditing the migration, all verified against the live site or the
frozen snapshot in `audit/`. They are listed here because they are the current
shop's problems, independent of Shopify — several are losing orders or order
data today. Where the Shopify port already fixes one, that is noted.

Evidence: `audit/custom-js/*.js` (the 16 embedded scripts), `audit/cms.json`
(catalog), and live fetches on 2026-08-31.

---

## 1. Checkout locks out after 24 hours, permanently and silently

`audit/custom-js/7dd6221ccd.js` runs on `/checkout` and redirects to `/cart`
when `localStorage.hyunCartLastActivity` is missing or older than 24 hours.
The only writer is `audit/custom-js/47008c2b35.js`, which sets the key on
clicks matching `.w-commerce-commerceaddtocartbutton`,
`[data-node-type='commerce-add-to-cart-button']` or `input[type='submit']`.

The cart's own "Continue to Checkout" is an anchor
(`<a href="/checkout" class="w-commerce-commercecartcheckoutbutton">`), so it
matches none of them and does not refresh the timer.

**Effect:** a customer who returns to a day-old cart clicks Continue to
Checkout, lands on `/checkout`, and is bounced straight back to `/cart` with no
message. Clicking again repeats forever. The cart is not emptied — checkout is
simply unreachable until they add another item (or happen to click some other
submit button on the page). Sleeping on a purchase is a completely ordinary
thing to do on a $150–900 order.

**Not carried into the port** — there is no such timer.

## 2. In-store pickup orders arrive with no name, no phone and no pickup time

`audit/custom-js/b4e0a2ad38.js` reads and validates `pickupName` (:192),
`phoneNumber` (:198) and `pickupDateTime` (:204), refusing to submit if any is
blank (:214-224). None of the three appears anywhere in the `requestBody`
assembled at :423-505. `customerEmail` and `customerPhone` are only assigned
inside the delivery branch (:143-163), so on the pickup path they stay `""`,
as does the whole `shippingAddress`.

**Effect:** the shop receives a paid pickup order containing items and nothing
else — no way to know who is collecting it, when, or how to reach them. The
customer was required to type all three.

## 3. Delivery orders lose the apartment number

The same script resolves `streetAddress2` from `#wf-ecom-shipping-address-2`,
`#wf-ecom-shipping-address2`, or a label containing "apartment"/"unit". The
live checkout's second address input has **no `id` and no label**:

```html
<input aria-label="Shipping address optional" class="…streetaddressoptional auth-field white last" name="address_line2" type="text"/>
```

**Effect:** `line2` is always empty. Every delivery order goes to the courier
without the apartment, unit or floor — for perishable meat in Manhattan.

## 4. The order's contact email is read from the footer newsletter box

`customerEmail` falls through `#wf-ecom-email` and `#email` (neither exists on
`/checkout`) to `input[type="email"]`. There is exactly one on the page: the
**"Subscribe to THE HYUN" newsletter field in the footer** (`id="email-2"`).

**Effect:** orders normally carry `customerEmail: ""`. If a customer types an
address into the newsletter box before checking out, that address becomes the
order's contact email. There is also no phone field at all on the delivery
form (`#wf-ecom-shipping-phone` matches nothing), so `customerPhone` is always
empty too.

## 5. Duplicate element ids break two checkout labels

`id="wf-ecom-shipping-name"` and `id="wf-ecom-shipping-address"` each appear
**twice** on `/checkout` — once in the pickup block, once in delivery. The
pickup block comes first, so `getElementById` always returns the pickup field,
and the delivery form's "Full Name" and "Street Address" labels point at
hidden inputs: clicking them does nothing and autofill has two targets.

## 6. Homepage CTA points at a 404

`/subcategories/offal` returns **404**. The homepage button "Explore THE
HYUN's Innards Selection" links to it, as do `/japanese-wagyu` and `/round`.
The CMS shows why: there are two sub-primal collections — the live `Sub
Primals` (slug `sub-primal`) and a legacy `Sub-Primals` (slug
`subcategories`) with zero items.

**Fixed in the port** — the button points at `/collections/offal`.

## 7. Three more 404 links in the cuts tab bar

The tab strip is maintained per page, and three copies have truncated paths:

| Page | Link | href | Status |
| --- | --- | --- | --- |
| `/loin` | Offal | `/s/sub-primal/offal` | 404 |
| `/loin` | Rump | `/subc/sub-primal/rump` | 404 |
| `/offal` | Rump | `/sub/sub-primal/rump` | 404 |
| `/japanese-wagyu` | Knuckle | `/sub-primal/Knuckle` | 404 (capital K) |

**Fixed in the port** — one shared snippet renders the tab bar everywhere.

## 8. The corporate-gift lead form is unreachable from its own page

`/corporate-gifts` has two buttons labelled "Corporate Gift Inquiry"; they
link to `/gift-sets-list` and `/wholesale-inquiry`. Neither reaches
`/corporate-gifts-inquiry`, which exists and hosts the corporate form. The
same pattern on `/gift-sets`: "Gift Sets Inquiry" → a product listing.

**Fixed in the port** — all three point at the inquiry form.

## 9. Seven products are publicly priced $0.00

`Brisket`, `Brisket Point`, `Chuck Short Rib`, `Tri Rib`, `Chateaubriand`,
`Filet Mignon`, `Omasum` all carry `price.value: 0` and render "$ 0" on their
product pages. They show as unavailable today, so no free checkout is possible
— but a luxury Wagyu catalogue is advertising $0 prices, and the moment
inventory is set on one it becomes a free order.

The port hides price and the buy form for zero-price products, matching what
the live template does, but **the underlying data still needs fixing**.

## 10. Tongue is priced 17× its peers

Every offal SKU is $11.88 / 2 lb ($5.94/lb) except **Tongue at $200.00 / 2 lb
($100/lb)**. That is within the catalogue's overall range (loin cuts reach
$142/lb), so it may be deliberate — but it is the only offal item priced like
a loin cut, and $20.00 would fit its peers exactly.

## 11. A Top Round SKU is sold at "0.00 lb"

`Top Round Weight: 0.00 lb` at $49.84 — a priced, selectable weight option of
zero pounds.

## 12. Two product names carry an invisible control character

`Bottom Round` and `Upper Oyster Blade` both start with a literal backspace
(U+0008) in the CMS, and their SKU names and two Korean names do too. Browsers
swallow it so pages look fine, but it travels into exports and any system
downstream.

**Fixed in the port** — `scripts/import-products.mjs` now strips control
characters, so a re-run repairs the two Shopify products.

## 13. Product URLs that disagree with the product

| URL | Product shown |
| --- | --- |
| `/product/flat-iron-cap` | Upper Oyster Blade |
| `/product/outside-round` | Bottom Round |
| `/product/hanging-tener` | Hanging Tender (slug misspelled) |
| `/product/small-intenstine` | Small Intenstine (**name** misspelled too) |

The migration keeps the slugs as-is so links survive; renaming any of them
needs a redirect from the old path.

## 14. "Custom Collection" — an unlinked $50 subscription product

In the CMS and now in Shopify: $50, one variant, no description, no selling
plan, no page linking to it, but publicly reachable at
`/product/custom-collection`. Looks like a leftover test record.

## 15. The quiz's review step lists questions it never asks

The subscription builder's review panel lists Frequency, **Occasion**, Cooking
Style, Experience, **Selection Style**. The quiz actually asks six questions,
and neither "Occasion" nor "Selection Style" is one of them, while Collection
Size, Preferred Cuts and Avoid are missing. Nothing fills the values either,
so after completing the quiz every line still reads "—".

**Fixed in the port** — the review lists the six real questions and
`assets/quiz.js` fills them in.

## 16. A gift message persists into later orders

`hyunGiftMessageEnabled` / `hyunGiftMessageText` are written to localStorage
and never cleared — not at checkout, not anywhere in the 16 scripts. The
checkout script reads them unconditionally.

**Effect:** a gift message written in March is still attached to an order
placed in June. The cart does display "Gift Message Added", but nothing
signals that a months-old message is armed.

**Fixed in the port** — the message is a cart attribute, so it lives and dies
with the cart (and, unlike on the live site, actually reaches the order).

## 17. Add-on failures are invisible

The cart's "Wooden Gift Box" / "Bojagi Gift Wrapping" toggles click a hidden
Webflow add-to-cart form and never check the result. The element that reports
failures (`.w-commerce-commerceaddtocarterror`, carrying "You can't purchase
another product with a subscription", "This product is out of stock") sits
inside `.cart-addon-hidden`, which the page's CSS positions at
`left:-9999px; opacity:0`.

**Effect:** when adding a gift box fails, nothing happens and nothing is said.

## 18. Removing a subscription can leave two in the cart

`audit/custom-js/72e731fb4d.js:613-652` clears the one-subscription guard and
navigates to `/subscription-builder` 300 ms later, while Webflow's own remove
call is still in flight. On a slow connection the navigation aborts the
removal: the subscription is still in the cart, the guard is gone, and the
customer can add a second one and pay for both.

## 19. The subscription add-to-cart gets ~900 ms before the page leaves

`audit/custom-js/b5ce728bb6.js` marks the subscription as in-cart *before*
adding it, clicks the hidden add-to-cart at ~900 ms, and navigates to
`/checkout` at 1800 ms. If the add hasn't completed, the customer arrives at
checkout with an empty cart, cannot see the error (the form is off-screen and
the cart popup is suppressed), and going back is blocked by the
already-in-cart guard — the whole six-step quiz has to be redone.

**Fixed in the port** — one `/cart/add.js` call, awaited, then checkout.

## 20. The double-submit guard on the checkout button does nothing

`checkoutButton.disabled = true` is applied to
`<a id="checkout-btn" href="#">`. Anchors have no `disabled` property, so the
button stays live and unchanged while the request is in flight; impatient
customers fire several `create-checkout-session` POSTs.

## 21. `/checkout` blanks fields the customer is typing into

`audit/custom-js/d05a22f2bd.js:51-54` clears the name, address, city and zip
fields at DOMContentLoaded, **+300 ms and +1000 ms**. Anyone typing (or any
browser autofill) inside the first second watches their input disappear.

## 22. The charged amount is computed in the browser

`audit/custom-js/b4e0a2ad38.js:268-434` scrapes every price, quantity and
weight from the DOM and POSTs them to `create-checkout-session`. Whether that
is exploitable depends on whether the server re-prices from its own catalog —
worth confirming with whoever owns `shipping.thehyun.com`, because the client
is written as though the server trusts it.

## 23. Store facts contradict themselves

- **ZIP code:** the footer says `New York, NY 10001` on every page; the store
  page says `10010`. 253 Third Ave is in 10010.
- **Hours:** the store page says Mon–Fri 11am–8pm, Sat 11am–8:30pm, Sun
  11am–7:30pm; the contact page says "Monday to Sunday: 11am – 8:30pm".
- **Phone:** three formats across three pages.

## 24. Contact form submits placeholder values

`/contact`'s topic select posts `First`, `Second`, `Third` instead of
"Wholesale", "Corporate Gifts", "Issue with an order" — leftover Webflow
defaults. Inquiries arrive tagged with meaningless words.

**Fixed in the port** — the values are the labels.

## 25. Copy defects

- **`Japanase Wagyu`** — the main nav link, on all 103 pages.
- **`Jpanese Wagyu's hidden delights`** — homepage heading.
- `accomodations` (contact), `JapaneseWagyu` with no space (our story),
  "were define supply" (japanese-wagyu).
- Subject–verb agreement throughout the brand copy: "Where Japanese Wagyu
  **Meet** Butcher's Artistry", "THE HYUN **serve**", "THE HYUN **offer**",
  "**All order** will be carefully packed".
- Three different casings for the same nav items ("Brand Philosophy" /
  "Brand philosophy"), and "Gift Sets" pointing at two different pages
  depending on whether you use the nav or the footer.
- Copy naming products that do not exist: "Honey Comb Tripe" in the offal
  blurb; "Ribeye" and "Flat Iron Cap" in the Epicurean contents list.

These are carried into the port verbatim — they are the brand's words, so
they are listed rather than silently rewritten. Say the word and they get
fixed in one pass.

## 26. Every image has an empty `alt`

All ~500 images across the site, product photos included. Bad for
accessibility and for image search.

## 27. 77 of 108 pages share the title "THE HYUN"

Including all 58 product pages and all 14 sub-primal pages. No page has a meta
description or a canonical link.

**Fixed in the port** — Shopify titles each page, and product pages get a
description from the product copy.

## 28. `/available-cuts` hides the sold-out state

`/available-cuts` and `/all-japanese-wagyu` render the same 54 products, but
`/available-cuts` has no sold-out markup at all. On `/all-japanese-wagyu` 41
of those 54 show "sold out"; on the page actually called "Available cuts"
every one of them looks available. Both are linked side by side from every
category page.
