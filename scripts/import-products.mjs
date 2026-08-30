// Webflow catalog -> Shopify dev store.
//
//   node scripts/import-products.mjs            # dry run (default)
//   node scripts/import-products.mjs --apply
//
// Reads the frozen CMS snapshot (audit/cms.json), never Webflow live - the
// import must be reproducible while the live site keeps changing.
//
// Idempotent by handle: a product whose handle already exists is updated, not
// duplicated, so the script can re-run after a partial failure.

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
const categories = new Map(cms['Categories'].items.map((c) => [c.id, c.fieldData.name]));
const subPrimals = new Map(cms['Sub Primals'].items.map((c) => [c.id, c.fieldData.name]));

// SKUs grouped under their product.
const skusByProduct = new Map();
for (const sku of cms['SKUs'].items) {
  const ref = sku.fieldData.product;
  if (!skusByProduct.has(ref)) skusByProduct.set(ref, []);
  skusByProduct.get(ref).push(sku);
}

const money = (price) => (price?.value != null ? (price.value / 100).toFixed(2) : null);

const products = [];
for (const item of cms['Products'].items) {
  const f = item.fieldData;
  const skus = skusByProduct.get(item.id) || [];

  // Option axes: sku-properties defines them; sku-values points each SKU at
  // one enum value per axis.
  const props = f['sku-properties'] || [];
  const valueName = new Map();
  for (const p of props) for (const v of p.enum) valueName.set(`${p.id}:${v.id}`, v.name);

  const variants = skus.map((sku) => {
    const sf = sku.fieldData;
    const optionValues = props.map((p) => ({
      optionName: p.name,
      name: valueName.get(`${p.id}:${sf['sku-values']?.[p.id]}`) ?? '?',
    }));
    return {
      optionValues: optionValues.length ? optionValues : [{ optionName: 'Title', name: 'Default Title' }],
      price: money(sf.price) ?? '0.00',
      compareAtPrice: money(sf['compare-at-price']),
      sku: sf.sku || undefined,
    };
  });
  if (variants.length === 0) continue; // nothing purchasable ever existed

  const tags = [
    ...(f.category || []).map((id) => categories.get(id)).filter(Boolean),
    ...[subPrimals.get(f['sub-primals'])].filter(Boolean),
  ];

  const image = skus.find((s) => s.fieldData['main-image']?.url)?.fieldData['main-image']?.url;

  const metafields = [
    ['korean_name', f['korean-name'], 'single_line_text_field'],
    ['contents', f.contents, 'multi_line_text_field'],
    ['parts', f.parts, 'single_line_text_field'],
    ['bg_color', f['bg-color'], 'single_line_text_field'],
  ]
    .filter(([, v]) => v)
    .map(([key, value, type]) => ({ namespace: 'webflow', key, type, value: String(value) }));

  products.push({
    input: {
      title: f.name,
      handle: f.slug,
      descriptionHtml: f.description || '',
      vendor: 'THE HYUN',
      status: 'ACTIVE',
      tags,
      productOptions: props.length
        ? props.map((p, i) => ({ name: p.name, position: i + 1, values: p.enum.map((v) => ({ name: v.name })) }))
        : [{ name: 'Title', position: 1, values: [{ name: 'Default Title' }] }],
      variants,
      metafields: metafields.length ? metafields : undefined,
      files: image ? [{ originalSource: image, contentType: 'IMAGE' }] : undefined,
    },
    // For the report, not the API.
    summary: { name: f.name, variants: variants.length, options: props.map((p) => p.name), tags },
  });
}

console.log(`${products.length} products to import`);
const multi = products.filter((p) => p.summary.variants > 1);
console.log(`  multi-variant: ${multi.length}   single: ${products.length - multi.length}`);
for (const p of products.slice(0, 8)) {
  console.log(`  ${p.summary.name.padEnd(34)} ${p.summary.variants} variant(s)  [${p.summary.options.join('×') || 'default'}]  ${p.summary.tags.join(', ')}`);
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to create them.');
  process.exit(0);
}

const MUT = `mutation productSet($input: ProductSetInput!) {
  productSet(input: $input, synchronous: true) {
    product { id handle variantsCount { count } }
    userErrors { field message }
  }
}`;

let created = 0;
const failed = [];
for (const p of products) {
  try {
    const d = await gql(MUT, { input: p.input });
    const errs = d.productSet.userErrors;
    if (errs.length) failed.push({ name: p.summary.name, error: errs.map((e) => e.message).join('; ') });
    else created++;
  } catch (err) {
    failed.push({ name: p.summary.name, error: err.message.slice(0, 120) });
  }
  process.stdout.write(`\r${created + failed.length}/${products.length}`);
}
console.log(`\n\ncreated/updated: ${created}`);
if (failed.length) {
  console.log(`failed: ${failed.length}`);
  for (const f of failed) console.log(`  ${f.name}: ${f.error}`);
  process.exitCode = 1;
}
