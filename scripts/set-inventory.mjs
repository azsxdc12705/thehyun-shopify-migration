// Seeds the Shopify store's stock levels from the live site's own inventory,
// captured in audit/live-stock.json.
//
//   node scripts/set-inventory.mjs            # dry run (default)
//   node scripts/set-inventory.mjs --apply    # write the quantities
//
// The Webflow CMS export carries no stock, so until the real POS sync
// (TheHyunInventory) runs, Shopify believes all 54 cuts are in stock and the
// storefront over-offers. The live grids do encode the quantity, though: every
// cut is rendered and Webflow hides what fails an inventory condition, so the
// visible/hidden split is readable per cut. audit/live-stock.json is that
// reading; this script writes it onto the matching Shopify variants.
//
// A quantity of 2 in the snapshot means "two or more" - the live page only
// exposes >0 and >1 - so cuts land in stock with a conservative count, not the
// real one. 1 and 0 are exact.

try { await import('dotenv/config'); } catch { /* not installed */ }
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const STORE = process.env.SHOPIFY_DEV_STORE, TOKEN = process.env.SHOPIFY_DEV_TOKEN;
if (!STORE || !TOKEN) {
  console.error('SHOPIFY_DEV_STORE and SHOPIFY_DEV_TOKEN must be set (see docs/CUTOVER.md).');
  process.exit(1);
}

const gql = async (query, variables = {}) => {
  const r = await fetch(`https://${STORE}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const d = await r.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.data;
};

const { quantities, capturedAt } = JSON.parse(fs.readFileSync('audit/live-stock.json'));

const loc = await gql(`{ locations(first: 1, includeInactive: false) { nodes { id name } } }`);
const location = loc.locations.nodes[0];
if (!location) throw new Error('the store has no active location to stock');

// pull every variant with its handle, so the snapshot's slugs can be matched
const variants = [];
let cursor = null;
do {
  const d = await gql(
    `query ($after: String) { products(first: 100, after: $after) {
       nodes { handle variants(first: 20) { nodes { id title inventoryItem { id tracked } } } }
       pageInfo { hasNextPage endCursor } } }`, { after: cursor });
  for (const p of d.products.nodes) {
    for (const v of p.variants.nodes) variants.push({ handle: p.handle, ...v });
  }
  cursor = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
} while (cursor);

const setQuantities = [];
const unmatched = [];
for (const [handle, qty] of Object.entries(quantities)) {
  const mine = variants.filter((v) => v.handle === handle);
  if (!mine.length) { unmatched.push(handle); continue; }
  // every variant of a cut is the same meat at a different weight, and the
  // live site tracks one quantity for the cut - give each variant that count
  for (const v of mine) {
    setQuantities.push({ inventoryItemId: v.inventoryItem.id, locationId: location.id, quantity: qty });
  }
}

const inStock = Object.values(quantities).filter((q) => q > 0).length;
console.log(`snapshot ${capturedAt}: ${Object.keys(quantities).length} cuts, ${inStock} in stock`);
console.log(`location: ${location.name}`);
console.log(`${setQuantities.length} variants to set` + (unmatched.length ? `, ${unmatched.length} slugs with no product: ${unmatched.join(', ')}` : ''));

if (!APPLY) { console.log('\nDry run. Re-run with --apply to write the quantities.'); process.exit(0); }

const untracked = variants.filter((v) => !v.inventoryItem.tracked);
for (const v of untracked) {
  await gql(
    `mutation($id: ID!, $input: InventoryItemInput!) {
       inventoryItemUpdate(id: $id, input: $input) { userErrors { field message } } }`,
    { id: v.inventoryItem.id, input: { tracked: true } });
}
if (untracked.length) console.log(`turned on tracking for ${untracked.length} variants`);

// inventorySetQuantities is absolute ("available" on hand), not a delta
let done = 0;
for (let i = 0; i < setQuantities.length; i += 100) {
  const batch = setQuantities.slice(i, i + 100);
  const d = await gql(
    `mutation($input: InventorySetQuantitiesInput!) {
       inventorySetQuantities(input: $input) { userErrors { field message } } }`,
    { input: { name: 'available', reason: 'correction', ignoreCompareQuantity: true, quantities: batch } });
  const errs = d.inventorySetQuantities.userErrors;
  if (errs.length) { console.error(errs.map((e) => e.message).join('; ')); process.exitCode = 1; }
  else done += batch.length;
}
console.log(`set: ${done} of ${setQuantities.length} variants`);
