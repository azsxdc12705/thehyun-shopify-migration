// Takes Shopify's own product export CSV and returns an import-ready CSV that
// assigns every variant a SKU and sets its stock level.
//
//   Admin > Products > Export > "All products" > CSV for Excel/Numbers
//   node scripts/fill-sku-inventory.mjs products_export.csv
//   -> writes products_sku_inventory.csv, ready for Products > Import
//   --sku-only leaves stock alone and writes the SKU column by itself
//
// Working from the export (rather than from audit/cms.json) is deliberate: the
// importer matches a row to an existing variant by Handle plus the option
// values, so those strings have to be character-exact. Anything else and the
// import silently creates a second variant instead of updating the one there.
//
// Quantities default to audit/live-stock.json - what the live site is actually
// holding. That snapshot counts a CUT, not a piece: Webflow's condition reads
// the default SKU's quantity, so a cut with several weight variants gets its
// count on the first variant and zero on the rest, which is what the live site
// itself believes. Fix those from the shop ledger before importing, or pass
// --sku-only and load stock separately.
//
// SKU format:  HYUN-<HANDLE>-<option tail>
//   weight option   0.53 lb  -> 053   (hundredths of a pound, 3 digits)
//   other options   Monthly  -> M     (see ABBR; falls back to the value
//                                      uppercased, non-alphanumerics dropped)
//   no options      HYUN-BRISKET
// The handle goes in whole rather than abbreviated because this catalog has
// rib-cap next to ribeye-cap and top-round next to top-round-cap; any
// shortening scheme collides on those.

import fs from 'node:fs';

const [input] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SKU_ONLY = process.argv.includes('--sku-only');
if (!input) {
  console.error('usage: node scripts/fill-sku-inventory.mjs <products_export.csv> [--sku-only]');
  process.exit(1);
}

const ABBR = {
  'Monthly': 'M', 'Twice a Month': '2M',
  'Discovery Collection': 'DSC', 'Signature Collection': 'SIG', 'Grand Collection': 'GRD',
  'Delivery Only': 'DO', 'Delivery + HYUN Dining': 'DD',
};

// RFC4180-ish: quoted fields, doubled quotes, newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f !== ''));
}
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const rows = parseCsv(fs.readFileSync(input, 'utf8'));
const head = rows[0];
const col = (name) => head.indexOf(name);
const need = ['Handle', 'Option1 Name', 'Option1 Value'];
for (const n of need) if (col(n) < 0) { console.error(`the export is missing the "${n}" column`); process.exit(1); }

const skuTail = (optName, optValue) => {
  if (!optValue || optValue === 'Default Title') return null;
  if (/weight/i.test(optName || '')) {
    const m = String(optValue).match(/([\d.]+)/);
    if (!m) return null;
    return String(Math.round(parseFloat(m[1]) * 100)).padStart(3, '0');
  }
  return ABBR[optValue] ?? String(optValue).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6);
};

const stock = SKU_ONLY ? {} : JSON.parse(fs.readFileSync('audit/live-stock.json')).quantities;

const OUT = ['Handle', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
  'Option3 Name', 'Option3 Value', 'Variant SKU'];
// Omitted entirely rather than left blank under --sku-only: the importer reads
// an empty cell in a column that is present as zero.
if (!SKU_ONLY) OUT.push('Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy');

const out = [OUT.map(csvCell).join(',')];
const seen = new Map();
const collisions = [], noStock = new Set(), spread = new Set();
const counted = new Set();   // cuts whose snapshot count is already placed
let handle = '', variants = 0;

for (const r of rows.slice(1)) {
  const cell = (n) => (col(n) >= 0 ? (r[col(n)] ?? '') : '');
  if (cell('Handle')) handle = cell('Handle');           // image-only rows repeat a blank handle
  const o1v = cell('Option1 Value');
  if (!handle || (!o1v && !cell('Option1 Name'))) continue;  // not a variant row

  const tails = [1, 2, 3]
    .map((i) => skuTail(cell(`Option${i} Name`), cell(`Option${i} Value`)))
    .filter(Boolean);
  const sku = ['HYUN', handle.toUpperCase(), ...tails].join('-');

  if (seen.has(sku)) collisions.push(`${sku}  (${handle}: ${seen.get(sku)} / ${o1v})`);
  seen.set(sku, o1v);

  const row = [handle, cell('Option1 Name'), cell('Option1 Value'), cell('Option2 Name'),
    cell('Option2 Value'), cell('Option3 Name'), cell('Option3 Value'), sku];
  if (!SKU_ONLY) {
    if (!(handle in stock)) {
      // Not one of the 54 cuts - subscriptions, bundles, gift sets. Leave these
      // untracked: switching tracking on with no quantity would take the
      // Curated Collection and every gift set out of stock on import.
      noStock.add(handle);
      row.push('', '', 'continue');
    } else {
      let qty = '0';
      if (counted.has(handle)) spread.add(handle);   // a later variant of a cut already counted
      else { qty = String(stock[handle]); counted.add(handle); }
      row.push('shopify', qty, 'deny');
    }
  }
  out.push(row.map(csvCell).join(','));
  variants++;
}

const dest = 'products_sku_inventory.csv';
fs.writeFileSync(dest, out.join('\n') + '\n');

console.log(`${variants} variants -> ${dest}`);
console.log(`SKUs: ${seen.size} unique` + (collisions.length ? `, ${collisions.length} COLLIDING` : ''));
for (const c of collisions) console.log('  ! ' + c);
if (collisions.length) {
  console.log('  Two variants of one cut share a weight. Give one of them a suffix by hand');
  console.log('  (-A / -B) before importing, or the second row overwrites the first.');
  process.exitCode = 1;
}
if (SKU_ONLY) console.log('--sku-only: stock columns omitted, existing quantities untouched');
else {
  console.log(`quantities from audit/live-stock.json for ${counted.size} cuts`);
  if (noStock.size) console.log(`  left untracked (not a cut - subscription, bundle, gift set): ${[...noStock].join(', ')}`);
  if (spread.size) {
    console.log(`\n  ${spread.size} cuts have several weight variants: ${[...spread].join(', ')}`);
    console.log('  The snapshot only knows the cut\'s default variant, so its count sits on the');
    console.log('  first row and the others are 0. Set these from the ledger - they are the rows');
    console.log('  most likely to be wrong.');
  }
  console.log('\nReplace the Variant Inventory Qty column with the shop ledger before importing if you have it.');
}
console.log('\nImport it under Products > Import, WITHOUT ticking "Overwrite any current products".');
console.log('Try a 1-product copy of the file first and check that variant count stays the same.');
