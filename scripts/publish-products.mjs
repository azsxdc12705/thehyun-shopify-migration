// Publishes every product to the Online Store sales channel.
//
//   node scripts/publish-products.mjs
//
// Products created through the Admin API are not published to any channel on
// their own - status ACTIVE is not the same thing - so a freshly imported
// catalog is invisible on the storefront until this runs.

// dotenv is a convenience, not a requirement: exported env vars work too,
// and --csv/dry runs need no credentials at all.
try { await import('dotenv/config'); } catch { /* not installed */ }

const gql = async (query, variables = {}) => {
  const r = await fetch(`https://${process.env.SHOPIFY_DEV_STORE}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_DEV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const d = await r.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.data;
};

// The API no longer names publications, and a dev store has only the three
// standard channels - so publish to all of them rather than guessing which id
// is the Online Store.
const pubs = await gql(`{ publications(first: 10) { nodes { id } } }`);
const input = pubs.publications.nodes.map((p) => ({ publicationId: p.id }));
console.log(`${input.length} publications`);

const ids = [];
let cursor = null;
while (true) {
  const d = await gql(
    `query($cursor: String) { products(first: 100, after: $cursor) {
       nodes { id publishedAt } pageInfo { hasNextPage endCursor } } }`,
    { cursor }
  );
  ids.push(...d.products.nodes.filter((p) => !p.publishedAt).map((p) => p.id));
  if (!d.products.pageInfo.hasNextPage) break;
  cursor = d.products.pageInfo.endCursor;
}
console.log(`${ids.length} unpublished products`);

let done = 0;
for (const id of ids) {
  const d = await gql(
    `mutation($id: ID!, $input: [PublicationInput!]!) {
       publishablePublish(id: $id, input: $input) { userErrors { field message } } }`,
    { id, input }
  );
  const errs = d.publishablePublish.userErrors;
  if (errs.length) console.error(`  ${id}: ${errs[0].message}`);
  else done++;
}
console.log(`published: ${done} of ${ids.length}`);
