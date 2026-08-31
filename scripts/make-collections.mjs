// Creates a collection per Webflow category and sub-primal, membership by the
// tags the import stamped on each product.
//
//   node scripts/make-collections.mjs            # dry run (default)
//   node scripts/make-collections.mjs --apply
//
// Smart collections (RuleSet on tag) rather than manual lists: membership then
// maintains itself when products are added later, the same way the Webflow
// site derived category pages from references.

// dotenv is a convenience, not a requirement: exported env vars work too,
// and --csv/dry runs need no credentials at all.
try { await import('dotenv/config'); } catch { /* not installed */ }
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const STORE = process.env.SHOPIFY_DEV_STORE, TOKEN = process.env.SHOPIFY_DEV_TOKEN;
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

const cms = JSON.parse(fs.readFileSync('audit/cms.json')).collections;
// "Offal" is both a Category and a Sub Primal, so dedupe: without this the
// same title is created twice and Shopify hands the second one the handle
// `offal-1`, which nothing links to.
const wanted = [...new Set([
  ...cms['Categories'].items.map((c) => c.fieldData.name),
  ...cms['Sub Primals'].items.map((c) => c.fieldData.name),
])];

const { collections } = await gql(`{ collections(first: 100) { nodes { title } } }`);
const existing = new Set(collections.nodes.map((c) => c.title));
const missing = wanted.filter((t) => !existing.has(t));
console.log(`${wanted.length} wanted, ${existing.size} exist, ${missing.length} to create`);

if (!APPLY) { console.log('Dry run.'); process.exit(0); }

const MUT = `mutation collectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) { collection { title } userErrors { message } }
}`;
for (const title of missing) {
  const d = await gql(MUT, { input: {
    title,
    // the live category grids are alphabetical; Shopify's default is not
    sortOrder: 'ALPHA_ASC',
    ruleSet: { appliedDisjunctively: false, rules: [{ column: 'TAG', relation: 'EQUALS', condition: title }] },
  }});
  const errs = d.collectionCreate.userErrors;
  console.log(`  ${title.padEnd(20)} ${errs.length ? errs[0].message : 'ok'}`);
}
