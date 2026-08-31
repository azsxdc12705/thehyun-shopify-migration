// Creates URL redirects mapping every legacy Webflow path to its Shopify
// home, so existing links and SEO survive the cutover.
//
//   node scripts/make-redirects.mjs            # dry run (default)
//   node scripts/make-redirects.mjs --apply
//
// Product paths come from the frozen CMS snapshot (audit/cms.json); the
// rest is the fixed site structure. Idempotent: existing paths are skipped.

import 'dotenv/config';
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

const redirects = new Map();
// every Webflow product page -> the Shopify product URL
for (const p of cms['Products'].items) {
  redirects.set(`/product/${p.fieldData.slug}`, `/products/${p.fieldData.slug}`);
}
// sub-primal pages -> their collections
for (const s of cms['Sub Primals'].items) {
  redirects.set(`/sub-primal/${s.fieldData.slug}`, `/collections/${s.fieldData.slug}`);
}
redirects.set('/sub-primal/Knuckle', '/collections/knuckle'); // capitalised variant in the crawl
// primal category pages
for (const c of ['forequarter', 'loin', 'plate', 'round', 'offal']) {
  redirects.set(`/${c}`, `/collections/${c}`);
}
redirects.set('/all-japanese-wagyu', '/collections/all');
redirects.set('/available-cuts', '/pages/available-cuts');
redirects.set('/subcategories/offal', '/collections/offal');
redirects.set('/bundles', '/collections/bundles');
redirects.set('/gift-sets-list', '/collections/gift-sets');
redirects.set('/gift-sets', '/pages/gift-sets');
// static pages
for (const h of ['subscription-builder', 'japanese-wagyu', 'our-story',
  'brand-philosophy', 'design-philosophy', 'bojagi', 'local-delivery',
  'store', 'contact', 'shipping-delivery', 'wholesale-inquiry',
  'corporate-gifts', 'corporate-gifts-inquiry', 'subscription']) {
  redirects.set(`/${h}`, `/pages/${h}`);
}
// Webflow account/checkout machinery -> Shopify equivalents
redirects.set('/user-account', '/account');
redirects.set('/checkout-method', '/cart');
redirects.set('/log-in', '/account/login');
redirects.set('/sign-up', '/account/register');

// Typo'd sub-primal links on the live /loin and /offal pages (all three 404
// on Webflow today). Redirecting them means any link already out in the wild
// lands somewhere real after the move.
redirects.set('/s/sub-primal/offal', '/collections/offal');
redirects.set('/sub/sub-primal/rump', '/collections/rump');
redirects.set('/subc/sub-primal/rump', '/collections/rump');

const existing = new Set();
let cursor = null;
do {
  const d = await gql(
    `query ($after: String) { urlRedirects(first: 250, after: $after) {
       nodes { path } pageInfo { hasNextPage endCursor } } }`, { after: cursor });
  d.urlRedirects.nodes.forEach((r) => existing.add(r.path));
  cursor = d.urlRedirects.pageInfo.hasNextPage ? d.urlRedirects.pageInfo.endCursor : null;
} while (cursor);

const missing = [...redirects].filter(([path]) => !existing.has(path));
console.log(`${redirects.size} wanted, ${existing.size} exist, ${missing.length} to create`);
for (const [p, t] of missing.slice(0, 12)) console.log(`  ${p.padEnd(32)} -> ${t}`);
if (missing.length > 12) console.log(`  ... and ${missing.length - 12} more`);

if (!APPLY) { console.log('\nDry run. Re-run with --apply to create them.'); process.exit(0); }

const MUT = `mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
  urlRedirectCreate(urlRedirect: $urlRedirect) {
    urlRedirect { path } userErrors { field message }
  }
}`;
let ok = 0;
const failed = [];
for (const [path, target] of missing) {
  const d = await gql(MUT, { urlRedirect: { path, target } });
  const errs = d.urlRedirectCreate.userErrors;
  if (errs.length) failed.push(`${path}: ${errs.map((e) => e.message).join('; ')}`);
  else ok++;
  process.stdout.write(`\r${ok + failed.length}/${missing.length}`);
}
console.log(`\ncreated: ${ok}`);
if (failed.length) { console.log(`failed: ${failed.length}`); failed.forEach((f) => console.log('  ' + f)); process.exitCode = 1; }
