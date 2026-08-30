// Builds the token-bearing local artifacts (gitignored):
//   demo.html          — live curated-collection page with the widget swapped in
//   embed-snippet.html — self-contained paste-in for a Webflow Embed element
// Run: node webflow-embed/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const env = readFileSync(new URL('../.env', dir), 'utf8');
const token = env.match(/^SHOPIFY_STOREFRONT_TOKEN=(\S+)/m)[1];
const shop = env.match(/^SHOPIFY_DEV_STORE=(\S+)/m)[1];
// When inlined in a <script> block, a literal "</script>" (it appears in the
// widget's header comment) would terminate the tag early — escape it.
const js = readFileSync(new URL('buy-widget.js', dir), 'utf8')
  .replaceAll('</script>', '<\\/script>');

const widgetDiv = (handle) =>
  `<div data-hyun-buy="${handle}"\n` +
  `     data-shop="${shop}"\n` +
  `     data-token="${token}"></div>`;

// --- demo.html ---
let html = await (await fetch('https://www.thehyun.com/product/curated-collection')).text();

// swap the price block + Webflow add-to-cart form for the widget
const formAt = html.indexOf('commerce-add-to-cart-form');
const start = html.lastIndexOf('<form', formAt);
const end = html.indexOf('</form>', start) + '</form>'.length;
const priceAt = html.lastIndexOf('<div class="div-block-18">', start);
html =
  html.slice(0, priceAt) +
  '<div>' + widgetDiv('curated-collection') +
  '<script src="buy-widget.js" defer></script>' +
  html.slice(end);

// drop the custom scripts that die at cutover (checkout patches + price toggle)
for (const marker of ['Disable hidden checkout fields', 'CART_TIMER_KEY', 'updatePriceVisibility']) {
  const re = new RegExp(String.raw`<script[^>]*>(?:(?!</script>)[\s\S])*?${marker}(?:(?!</script>)[\s\S])*?</script>`);
  if (!re.test(html)) throw new Error('marker not found: ' + marker);
  html = html.replace(re, '');
}
writeFileSync(new URL('demo.html', dir), html);

// --- embed-snippet.html ---
const snippet = `<!-- THE HYUN buy widget — paste into a Webflow Embed element on the
     Ecommerce Product Template, replacing the price div + add-to-cart form.
     In the Webflow embed editor, replace HANDLE below with "+ Add Field" -> Slug
     so one embed serves every product. Publish to the webflow.io staging
     domain only to demo without touching thehyun.com. -->
${widgetDiv('HANDLE')}
<script>
${js}</script>
`;
writeFileSync(new URL('embed-snippet.html', dir), snippet);
// --- staging-footer.html ---
// STAGING demo custom code. Goes in the Ecommerce Product Template's page
// settings ("Before </body> tag") — NOT the site-wide footer, whose 10k
// limit the existing checkout-patch scripts already half-fill. Hostname-
// gated: does nothing on thehyun.com even if accidentally published there.
// Hides the Webflow price block + add-to-cart form and mounts the widget
// in their place, handle taken from the URL.
const footer = `<!-- THE HYUN staging demo: Shopify buy widget (webflow.io only).
     Paste at the END of "Product Template" page settings > Before </body> tag,
     leaving any existing code above it in place. -->
<script>
(function () {
  if (!location.hostname.endsWith('.webflow.io')) return;
  var m = location.pathname.match(/^\\/product\\/([^\\/]+)/);
  var form = document.querySelector('form[data-node-type="commerce-add-to-cart-form"]');
  if (!m || !form) return;
  var priceBlock = document.querySelector('.div-block-18');
  if (priceBlock) priceBlock.style.display = 'none';
  form.style.display = 'none';
  var mount = document.createElement('div');
  mount.setAttribute('data-hyun-buy', m[1]);
  mount.setAttribute('data-shop', '${shop}');
  mount.setAttribute('data-token', '${token}');
  (priceBlock || form).parentElement.insertBefore(mount, priceBlock || form);
})();
${js}</script>
`;
writeFileSync(new URL('staging-footer.html', dir), footer);

// --- quiz-demo.html + staging-quiz.html ---
// quiz-demo: the live /subscription-builder page with the three custom
// scripts stripped (2 site-wide checkout patches + the old 11k quiz script)
// and the ported quiz wired in. staging-quiz: paste-in for SITE settings →
// Custom code → Footer (appended after the existing scripts; ~3.2k + this
// stays under the 10k limit) — gated to the staging host and the builder
// path, so it is inert everywhere else.
const quizJs = readFileSync(new URL('quiz.js', dir), 'utf8')
  .replaceAll('</script>', '<\\/script>');
const quizCfg = `window.HYUN_QUIZ = { shop: '${shop}', token: '${token}' };`;

let builder = await (await fetch('https://www.thehyun.com/subscription-builder')).text();
for (const marker of ['Disable hidden checkout fields', 'CART_TIMER_KEY', 'curated-webflow-add-to-cart-wrap']) {
  const re = new RegExp(String.raw`<script[^>]*>(?:(?!</script>)[\s\S])*?${marker}(?:(?!</script>)[\s\S])*?</script>`);
  if (!re.test(builder)) throw new Error('marker not found on builder page: ' + marker);
  builder = builder.replace(re, '');
}
builder = builder.replace('</body>',
  `<script>${quizCfg}<\/script><script src="quiz.js" defer><\/script></body>`);
writeFileSync(new URL('quiz-demo.html', dir), builder);

const stagingQuiz = `<!-- THE HYUN staging demo: subscription-builder quiz -> Shopify
     (webflow.io only). Append to Site settings > Custom code > Footer. -->
<script>
if (location.hostname.endsWith('.webflow.io') && location.pathname === '/subscription-builder') {
  ${quizCfg}
}
${quizJs}</script>
`;
writeFileSync(new URL('staging-quiz.html', dir), stagingQuiz);

console.log('demo.html', html.length, '; embed-snippet.html', snippet.length,
  '; staging-footer.html', footer.length, '; quiz-demo.html', builder.length,
  '; staging-quiz.html', stagingQuiz.length, 'chars (Webflow limit 10,000)');
