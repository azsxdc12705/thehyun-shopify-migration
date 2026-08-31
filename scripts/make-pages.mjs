// Creates the admin pages the theme's page templates dispatch on.
//
//   node scripts/make-pages.mjs            # dry run (default)
//   node scripts/make-pages.mjs --apply
//
// templates/page.liquid renders each ported design by page handle, so a
// page only needs to exist with the right handle — no template assignment.
// Idempotent: existing handles are skipped.

import 'dotenv/config';

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

const PAGES = [
  ['Subscription Builder', 'subscription-builder'],
  ['Japanese Wagyu', 'japanese-wagyu'],
  ['Our Story', 'our-story'],
  ['Brand Philosophy', 'brand-philosophy'],
  ['Design Philosophy', 'design-philosophy'],
  ['Bojagi Wrapping', 'bojagi'],
  ['Local Delivery', 'local-delivery'],
  ['Store', 'store'],
  ['Contact', 'contact'],
  ['Shipping and Returns', 'shipping-delivery'],
  ['Wholesale Inquiry', 'wholesale-inquiry'],
  ['Corporate Gifts', 'corporate-gifts'],
  ['Corporate Gifts Inquiry', 'corporate-gifts-inquiry'],
  ['Subscription', 'subscription'],
  ['Available Cuts', 'available-cuts'],
  ['Gift Sets', 'gift-sets'],
];

const existing = new Set();
let cursor = null;
do {
  const d = await gql(
    `query ($after: String) { pages(first: 100, after: $after) {
       nodes { handle } pageInfo { hasNextPage endCursor } } }`, { after: cursor });
  d.pages.nodes.forEach((p) => existing.add(p.handle));
  cursor = d.pages.pageInfo.hasNextPage ? d.pages.pageInfo.endCursor : null;
} while (cursor);

const missing = PAGES.filter(([, h]) => !existing.has(h));
console.log(`${PAGES.length} wanted, ${existing.size} exist, ${missing.length} to create`);
missing.forEach(([t, h]) => console.log(`  ${h.padEnd(26)} "${t}"`));

if (!APPLY) { console.log('\nDry run. Re-run with --apply to create them.'); process.exit(0); }

const MUT = `mutation pageCreate($page: PageCreateInput!) {
  pageCreate(page: $page) { page { handle } userErrors { field message } }
}`;
for (const [title, handle] of missing) {
  const d = await gql(MUT, { page: { title, handle, isPublished: true } });
  const errs = d.pageCreate.userErrors;
  console.log(`  ${handle.padEnd(26)} ${errs.length ? errs.map((e) => e.message).join('; ') : 'ok'}`);
}
