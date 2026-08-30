/* Mock Storefront API for the buy widget and the subscription-builder quiz —
 * demo mode only. Active when the [data-hyun-buy] mount has no data-token
 * (same contract as webflow-embed/test.html), or when window.HYUN_QUIZ is
 * configured without a token. IDs and prices are the real dev-store values
 * (verified via Admin API, 2026-08-25).
 */
(function () {
  const mount = document.querySelector('[data-hyun-buy]');
  const widgetMock = mount && !mount.dataset.token;
  const quizMock = window.HYUN_QUIZ && !window.HYUN_QUIZ.token;
  if (!widgetMock && !quizMock) return;

  const PLAN = {
    month: { id: 'gid://shopify/SellingPlan/7879033078', name: 'Deliver every month' },
    weeks: { id: 'gid://shopify/SellingPlan/7879065846', name: 'Deliver every 2 weeks' },
  };
  // [variantId, price, frequency, size, experience]
  const ROWS = [
    [51546604339446, 270, 'Twice a Month', 'Discovery Collection', 'Delivery Only'],
    [51546604372214, 330, 'Monthly', 'Discovery Collection', 'Delivery + HYUN Dining'],
    [51546604404982, 400, 'Monthly', 'Signature Collection', 'Delivery + HYUN Dining'],
    [51546604437750, 580, 'Monthly', 'Grand Collection', 'Delivery + HYUN Dining'],
    [51546604470518, 150, 'Monthly', 'Discovery Collection', 'Delivery Only'],
    [51546604503286, 220, 'Monthly', 'Signature Collection', 'Delivery Only'],
    [51546604536054, 396, 'Twice a Month', 'Signature Collection', 'Delivery Only'],
    [51546604568822, 576, 'Twice a Month', 'Signature Collection', 'Delivery + HYUN Dining'],
    [51546604601590, 450, 'Twice a Month', 'Discovery Collection', 'Delivery + HYUN Dining'],
    [51546604634358, 400, 'Monthly', 'Grand Collection', 'Delivery Only'],
    [51546604667126, 900, 'Twice a Month', 'Grand Collection', 'Delivery + HYUN Dining'],
    [51546604699894, 720, 'Twice a Month', 'Grand Collection', 'Delivery Only'],
  ];
  const product = {
    title: 'Curated Collection',
    options: [
      { name: 'Frequency', optionValues: [{ name: 'Twice a Month' }, { name: 'Monthly' }] },
      { name: 'Collection Size', optionValues: [{ name: 'Discovery Collection' }, { name: 'Signature Collection' }, { name: 'Grand Collection' }] },
      { name: 'Experience', optionValues: [{ name: 'Delivery Only' }, { name: 'Delivery + HYUN Dining' }] },
    ],
    variants: { nodes: ROWS.map(([id, price, f, s, e]) => ({
      id: 'gid://shopify/ProductVariant/' + id,
      availableForSale: true,
      price: { amount: String(price), currencyCode: 'USD' },
      selectedOptions: [
        { name: 'Frequency', value: f },
        { name: 'Collection Size', value: s },
        { name: 'Experience', value: e },
      ],
    })) },
    sellingPlanGroups: { nodes: [{ sellingPlans: { nodes: [PLAN.month, PLAN.weeks] } }] },
  };

  function showMockCheckout(lines) {
    let box = document.getElementById('mock-checkout-note');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'mock-checkout-note';
      box.style.cssText =
        'position:fixed;bottom:16px;right:16px;max-width:420px;z-index:9999;' +
        'background:#212222;color:#fbf9ee;padding:14px 16px;margin:0;' +
        'font:12px/1.5 monospace;white-space:pre-wrap;box-shadow:0 4px 24px #0006';
      document.body.appendChild(box);
    }
    box.textContent =
      'DEMO — Shopify checkout would open here.\ncartCreate lines:\n' +
      JSON.stringify(lines, null, 2);
  }

  const realFetch = window.fetch;
  window.fetch = function (url, opts) {
    if (!String(url).includes('/api/')) return realFetch.apply(this, arguments);
    const body = JSON.parse(opts.body);
    let data;
    if (body.query.includes('cartCreate')) {
      showMockCheckout(body.variables.lines);
      data = { cartCreate: { cart: { checkoutUrl: '#mock-checkout' }, userErrors: [] } };
    } else {
      data = { product };
    }
    return Promise.resolve({ json: () => Promise.resolve({ data }) });
  };
})();
