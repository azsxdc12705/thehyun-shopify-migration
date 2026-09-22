// Rebuilds the product CSV that restores weights, prices and SKUs to the cuts.
//
//   node scripts/restore-catalog-csv.mjs
//   -> catalog_restore.csv, imported under Products > Import WITH
//      "Overwrite any current products that have the same handle" ticked
//
// Written on 2026-09-22, after the live catalog was found holding 71 variants
// where the Webflow source has 85: 65 of them collapsed to "Default Title"
// (the Weight option gone) and 52 priced $0.00. audit/live-catalog-2026-09-22.json
// is that state; audit/cms.json is the source of truth it is measured against.
//
// Only the columns being repaired are emitted. Shopify leaves a column it is
// not given alone, so descriptions, images, tags and collections are untouched
// even with the overwrite box ticked - that box decides whether an existing
// handle is updated at all, not how much of it is replaced.
//
// --with-stock also writes the quantity columns, seeded from audit/live-stock.json.
// Default is to leave stock alone: getting the catalog sellable again and
// counting the meat are separate jobs, and the second one wants the ledger.

import fs from 'node:fs';

const WITH_STOCK = process.argv.includes('--with-stock');
const cms = JSON.parse(fs.readFileSync('audit/cms.json')).collections;
const stock = WITH_STOCK ? JSON.parse(fs.readFileSync('audit/live-stock.json')).quantities : {};

const ABBR = {
  'Monthly': 'M', 'Twice a Month': '2M',
  'Discovery Collection': 'DSC', 'Signature Collection': 'SIG', 'Grand Collection': 'GRD',
  'Delivery Only': 'DO', 'Delivery + HYUN Dining': 'DD',
};
const skuTail = (optName, optValue) => {
  if (!optValue) return null;
  if (/weight/i.test(optName || '')) {
    const m = String(optValue).match(/([\d.]+)/);
    return m ? String(Math.round(parseFloat(m[1]) * 100)).padStart(3, '0') : null;
  }
  return ABBR[optValue] ?? String(optValue).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6);
};
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const money = (p) => (p?.value != null ? (p.value / 100).toFixed(2) : '0.00');

const skusByProduct = new Map();
for (const s of cms['SKUs'].items) {
  const r = s.fieldData.product;
  if (!skusByProduct.has(r)) skusByProduct.set(r, []);
  skusByProduct.get(r).push(s);
}

const COLS = ['Handle', 'Title', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
  'Option3 Name', 'Option3 Value', 'Variant SKU', 'Variant Price', 'Variant Requires Shipping',
  'Variant Taxable', 'Variant Fulfillment Service'];
if (WITH_STOCK) COLS.push('Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy');

const rows = [COLS.map(csvCell).join(',')];
const seen = new Set();
const collisions = [], zeroPriced = [];
let products = 0, variants = 0;

for (const p of cms['Products'].items) {
  const f = p.fieldData;
  const skus = skusByProduct.get(p.id) || [];
  if (!skus.length) continue;

  const props = f['sku-properties'] || [];
  const valueName = new Map();
  for (const pr of props) for (const e of pr.enum || []) valueName.set(`${pr.id}:${e.id}`, e.name);

  products++;
  let first = true;
  const counted = new Set();
  for (const s of skus) {
    const opts = props.map((pr) => ({
      name: pr.name,
      value: valueName.get(`${pr.id}:${s.fieldData['sku-values']?.[pr.id]}`) ?? '',
    }));
    const sku = ['HYUN', f.slug.toUpperCase(), ...opts.map((o) => skuTail(o.name, o.value)).filter(Boolean)].join('-');
    if (seen.has(sku)) collisions.push(`${sku} (${f.slug})`);
    seen.add(sku);

    const price = money(s.fieldData.price);
    if (parseFloat(price) === 0) zeroPriced.push(`${f.slug}${opts[0]?.value ? ' / ' + opts[0].value : ''}`);

    const row = [
      f.slug,
      first ? f.name : '',                       // Shopify groups the rest onto this handle
      opts[0]?.name ?? 'Title', opts[0]?.value ?? 'Default Title',
      opts[1]?.name ?? '', opts[1]?.value ?? '',
      opts[2]?.name ?? '', opts[2]?.value ?? '',
      sku, price, 'TRUE', 'TRUE', 'manual',
    ];
    if (WITH_STOCK) {
      if (!(f.slug in stock)) row.push('', '', 'continue');        // not a cut: leave untracked
      else if (counted.has(f.slug)) row.push('shopify', '0', 'deny');
      else { row.push('shopify', String(stock[f.slug]), 'deny'); counted.add(f.slug); }
    }
    rows.push(row.map(csvCell).join(','));
    variants++;
    first = false;
  }
}

fs.writeFileSync('catalog_restore.csv', rows.join('\n') + '\n');
console.log(`catalog_restore.csv — ${products} products, ${variants} variants, ${seen.size} SKUs`);
if (collisions.length) { console.log(`COLLIDING SKUs: ${collisions.join(', ')}`); process.exitCode = 1; }

const live = JSON.parse(fs.readFileSync('audit/live-catalog-2026-09-22.json'));
const liveVariants = live.flatMap((p) => p.variants).length;
console.log(`live right now: ${live.length} products, ${liveVariants} variants`);
console.log(`\n${zeroPriced.length} variants are $0.00 in the Webflow source too — they stay $0.00 and`);
console.log(`unbuyable, which is what the old site did with them. Priced cuts restored: ${variants - zeroPriced.length}.`);
console.log(WITH_STOCK ? '\nstock columns included (from audit/live-stock.json)' : '\nstock columns omitted — run with --with-stock to seed quantities too');
console.log('\nImport: Products > Import > tick "Overwrite any current products that have the same handle".');
console.log('Do one product first (cut the file down to striploin) and check it comes back with 5 weights.');
