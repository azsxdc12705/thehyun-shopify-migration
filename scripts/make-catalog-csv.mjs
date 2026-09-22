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
const stocked = [], noWeights = [];

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
    // every weight this cut is known to have been cut at, priced as it was priced
    const weights = new Map();   // lb -> { price, qty }
    const props = f['sku-properties'] || [];
    const weightProp = props.find((pr) => /weight/i.test(pr.name));
    if (weightProp) {
      const valueName = new Map();
      for (const e of weightProp.enum || []) valueName.set(e.id, e.name);
      for (const s of sourceSkus) {
        const lb = parseFloat(valueName.get(s.fieldData['sku-values']?.[weightProp.id]) ?? '');
        const price = s.fieldData.price ? s.fieldData.price.value / 100 : 0;
        if (!(lb > 0) || !(price > 0)) continue;
        weights.set(lb, { price, qty: 0 });
      }
    }
    for (const lb of ledger.pieces[handle] ?? []) {
      const price = ledger.prices[handle]?.[lb.toFixed(2)];
      if (price == null) throw new Error(`${handle} ${lb} lb has no price in the ledger`);
      const row = weights.get(lb) ?? { price, qty: 0 };
      row.price = price;          // the ledger is today's price, the catalog is history
      row.qty += 1;
      weights.set(lb, row);
    }

    if (!weights.size) {
      // never sold online by weight: keep the single row the source describes,
      // untracked, at its source price (zero for the cuts the shop sells in store only)
      noWeights.push(handle);
      emit([handle, f.name, 'Title', 'Default Title', '', '', '', '',
        `HYUN-${handle.toUpperCase()}`,
        money(sourceSkus[0].fieldData.price ? sourceSkus[0].fieldData.price.value / 100 : 0),
        '', '', 'continue', 'TRUE', 'TRUE', 'manual']);
    } else {
      let first = true;
      for (const [lb, row] of [...weights].sort((a, b) => a[0] - b[0])) {   // lightest first, so variants.first is the cheapest and the product page agrees with product.price
        emit([handle, first ? f.name : '', 'Weight', wLabel(lb), '', '', '', '',
          `HYUN-${handle.toUpperCase()}-${wCode(lb)}`, money(row.price),
          'shopify', String(row.qty), 'deny', 'TRUE', 'TRUE', 'manual']);
        pieces += row.qty;
        first = false;
      }
      const inStock = [...weights.values()].reduce((a, b) => a + b.qty, 0);
      if (inStock) stocked.push(`${handle} ${inStock}`);
    }
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
if (noWeights.length) console.log(`\n${noWeights.length} cuts have no priced weight anywhere in the source or the ledger, so they keep a single untracked row at their source price and stay unbuyable, as on the old site:\n  ${noWeights.join(', ')}`);
console.log('\nImport: Products > Import, tick "Overwrite any current products that have the same handle".');
console.log('Cut the file to striploin first and check it comes back with its weights and 7 in stock.');
