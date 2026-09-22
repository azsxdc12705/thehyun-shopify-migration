// Builds the product CSV that puts the live catalog back together: the Weight
// axis, prices, SKUs, and the stock the shop actually holds.
//
//   node scripts/make-catalog-csv.mjs
//   -> catalog.csv, imported under Products > Import WITH
//      "Overwrite any current products that have the same handle" ticked
//
// Each cut gets a 0.01 lb row pinned at zero. Shopify will not keep a product
// with no variants, and a cut that sells out would otherwise lose its Weight
// option and come back as a plain "Default Title" product - which is the shape
// the catalog was found in on 2026-09-22. The placeholder holds the axis open
// so staff can add a real weight to a row that is already there, and
// templates/product.liquid leaves unavailable weights out of the select, so it
// never reaches a customer. Its price is the cut's per-pound rate x 0.01 rather
// than zero, because the theme reads a zero price as "not sold online".
//
// Stock comes from audit/ledger-2026-09-22.json - the shop's own sheet, one row
// per physical piece, with the ledger's own prices rather than recomputed ones.
// Two pieces at the same weight become one row with quantity 2.
//
// Bundles, gift sets and the subscription keep their single fixed-price variant
// and stay untracked: turning tracking on with no quantity would take them out
// of stock on import.

import fs from 'node:fs';

const cms = JSON.parse(fs.readFileSync('audit/cms.json')).collections;
const ledger = JSON.parse(fs.readFileSync('audit/ledger-2026-09-22.json'));
const cutHandles = new Set(Object.keys(JSON.parse(fs.readFileSync('audit/live-stock.json')).quantities));
const rates = new Map(JSON.parse(fs.readFileSync('docs/price-per-lb.json'))
  .filter((r) => r.ratePerLb).map((r) => [r.slug, r.ratePerLb]));
// the ledger prices a cut the catalog never priced
for (const [cut, prices] of Object.entries(ledger.prices)) {
  if (rates.has(cut)) continue;
  const [w, p] = Object.entries(prices)[0];
  rates.set(cut, Number((p / parseFloat(w)).toFixed(2)));
}

const PLACEHOLDER = 0.01;
const ABBR = {
  'Monthly': 'M', 'Twice a Month': '2M',
  'Discovery Collection': 'DSC', 'Signature Collection': 'SIG', 'Grand Collection': 'GRD',
  'Delivery Only': 'DO', 'Delivery + HYUN Dining': 'DD',
};
const wLabel = (lb) => `${lb.toFixed(2)} lb`;
const wCode = (lb) => String(Math.round(lb * 100)).padStart(3, '0');
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const money = (n) => Number(n).toFixed(2);

const skusByProduct = new Map();
for (const s of cms['SKUs'].items) {
  const r = s.fieldData.product;
  if (!skusByProduct.has(r)) skusByProduct.set(r, []);
  skusByProduct.get(r).push(s);
}

const COLS = ['Handle', 'Title', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
  'Option3 Name', 'Option3 Value', 'Variant SKU', 'Variant Price', 'Variant Inventory Tracker',
  'Variant Inventory Qty', 'Variant Inventory Policy', 'Variant Requires Shipping', 'Variant Taxable',
  'Variant Fulfillment Service'];
const rows = [COLS.map(csvCell).join(',')];
const seen = new Set();
const collisions = [];
let cuts = 0, others = 0, pieces = 0;
const stocked = [];

for (const p of cms['Products'].items) {
  const f = p.fieldData;
  const sourceSkus = skusByProduct.get(p.id) || [];
  if (!sourceSkus.length) continue;
  const handle = f.slug;
  const emit = (row) => {
    if (seen.has(row[8])) collisions.push(row[8]);
    seen.add(row[8]);
    rows.push(row.map(csvCell).join(','));
  };
  const cut = cutHandles.has(handle);

  if (cut) {
    cuts++;
    const rate = rates.get(handle) ?? null;
    const counts = new Map();
    for (const lb of ledger.pieces[handle] ?? []) counts.set(lb, (counts.get(lb) ?? 0) + 1);

    // placeholder first, so it is the row staff see at the top of an empty cut
    let first = true;
    const placeholderPrice = rate ? Math.max(0.01, rate * PLACEHOLDER) : 0.01;
    emit([handle, f.name, 'Weight', wLabel(PLACEHOLDER), '', '', '', '',
      `HYUN-${handle.toUpperCase()}-${wCode(PLACEHOLDER)}`, money(placeholderPrice),
      'shopify', '0', 'deny', 'TRUE', 'TRUE', 'manual']);
    first = false;

    for (const [lb, qty] of [...counts].sort((a, b) => b[0] - a[0])) {
      const price = ledger.prices[handle]?.[lb.toFixed(2)];
      if (price == null) throw new Error(`${handle} ${lb} lb has no price in the ledger`);
      emit([handle, '', 'Weight', wLabel(lb), '', '', '', '',
        `HYUN-${handle.toUpperCase()}-${wCode(lb)}`, money(price),
        'shopify', String(qty), 'deny', 'TRUE', 'TRUE', 'manual']);
      pieces += qty;
    }
    if (counts.size) stocked.push(`${handle} ${[...counts.values()].reduce((a, b) => a + b, 0)}`);
  } else {
    others++;
    const props = f['sku-properties'] || [];
    const valueName = new Map();
    for (const pr of props) for (const e of pr.enum || []) valueName.set(`${pr.id}:${e.id}`, e.name);
    let first = true;
    for (const s of sourceSkus) {
      const opts = props.map((pr) => ({
        name: pr.name, value: valueName.get(`${pr.id}:${s.fieldData['sku-values']?.[pr.id]}`) ?? '',
      }));
      const tail = opts.map((o) => ABBR[o.value] ?? String(o.value).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6)).filter(Boolean);
      emit([handle, first ? f.name : '',
        opts[0]?.name ?? 'Title', opts[0]?.value ?? 'Default Title',
        opts[1]?.name ?? '', opts[1]?.value ?? '', opts[2]?.name ?? '', opts[2]?.value ?? '',
        ['HYUN', handle.toUpperCase(), ...tail].join('-'),
        money(s.fieldData.price ? s.fieldData.price.value / 100 : 0),
        '', '', 'continue', 'TRUE', 'TRUE', 'manual']);
      first = false;
    }
  }
}

fs.writeFileSync('catalog.csv', rows.join('\n') + '\n');
console.log(`catalog.csv — ${rows.length - 1} rows: ${cuts} cuts (tracked), ${others} bundles/gift sets/subscription (untracked)`);
console.log(`stock from the ledger: ${pieces} pieces across ${stocked.length} cuts — ${stocked.join(', ')}`);
if (collisions.length) { console.log(`COLLIDING SKUs: ${[...new Set(collisions)].join(', ')}`); process.exitCode = 1; }
const noRate = [...cutHandles].filter((h) => !rates.has(h));
if (noRate.length) console.log(`\n${noRate.length} cuts have no per-pound rate in the source, so their placeholder is $0.01:\n  ${noRate.join(', ')}`);
console.log('\nImport: Products > Import, tick "Overwrite any current products that have the same handle".');
console.log('Cut the file to striploin first and check it comes back with 0.01 lb + six weights, 7 in stock.');
