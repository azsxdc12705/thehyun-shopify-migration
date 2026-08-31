/* THE HYUN buy widget.
 *
 * Paste into a Webflow embed block on a product page:
 *
 *   <div data-hyun-buy="curated-collection"
 *        data-shop="your-store.myshopify.com"
 *        data-token="STOREFRONT_API_TOKEN"></div>
 *   <script src=".../buy-widget.js" defer></script>
 *
 * Loads the product from the Shopify Storefront API by handle, renders one
 * select per option, and checks out via cartCreate. For subscription
 * products, one Frequency choice drives BOTH the variant and the selling
 * plan, so they can never mismatch.
 */
(function () {
  const API_VERSION = '2025-07';

  // ponytail: name map for the one subscription product; move to a data
  // attribute if more subscription products appear.
  const PLAN_BY_FREQUENCY = {
    'Monthly': 'Deliver every month',
    'Twice a Month': 'Deliver every 2 weeks',
  };

  const PRODUCT_QUERY = `query ($handle: String!) {
    product(handle: $handle) {
      title
      options { name optionValues { name } }
      variants(first: 100) {
        nodes {
          id
          availableForSale
          price { amount currencyCode }
          selectedOptions { name value }
        }
      }
      sellingPlanGroups(first: 10) {
        nodes { sellingPlans(first: 10) { nodes { id name } } }
      }
    }
  }`;

  const CART_CREATE = `mutation ($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { checkoutUrl }
      userErrors { message }
    }
  }`;

  function gql(shop, token, query, variables) {
    return fetch('https://' + shop + '/api/' + API_VERSION + '/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    }).then((r) => r.json());
  }

  // Native mode (on-theme): product data is Liquid-rendered into
  // #hyun-product-json (same shape as the Storefront query) and checkout goes
  // through the Cart AJAX API — no Storefront token needed.
  function nativeCreateCart(lines) {
    const line = lines[0];
    const item = { id: line.merchandiseId, quantity: line.quantity };
    if (line.sellingPlanId) item.selling_plan = line.sellingPlanId;
    if (line.attributes) {
      item.properties = {};
      line.attributes.forEach((a) => { item.properties[a.key] = a.value; });
    }
    // Do NOT clear the cart first: under the Storefront API cartCreate made a
    // separate cart, but here this is the shopper's real one and clearing it
    // would silently drop everything else they had.
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [item] }),
    })
      .then((r) => r.json().then((data) => {
        if (!r.ok) throw new Error(data.description || data.message || 'cart add failed');
        return { data: { cartCreate: { cart: { checkoutUrl: '/checkout' }, userErrors: [] } } };
      }));
  }

  function init(mount) {
    const blob = document.getElementById('hyun-product-json');
    if (blob) {
      try {
        render(mount, JSON.parse(blob.textContent), nativeCreateCart);
      } catch (err) {
        mount.textContent = 'Unable to load product.';
        console.error('[hyun-buy]', err);
      }
      return;
    }

    const shop = mount.dataset.shop;
    const token = mount.dataset.token;
    const handle = mount.dataset.hyunBuy;

    gql(shop, token, PRODUCT_QUERY, { handle })
      .then((res) => {
        const product = res.data && res.data.product;
        if (!product) throw new Error('product not found: ' + handle);
        render(mount, product, (lines) => gql(shop, token, CART_CREATE, { lines }));
      })
      .catch((err) => {
        mount.textContent = 'Unable to load product.';
        console.error('[hyun-buy]', err);
      });
  }

  function render(mount, product, createCart) {
    const variants = product.variants.nodes;
    const plans = product.sellingPlanGroups.nodes.flatMap(
      (g) => g.sellingPlans.nodes
    );
    const fmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: variants[0].price.currencyCode,
    });

    mount.innerHTML = '';
    mount.classList.add('hyun-buy');

    // Single-variant products come back with one "Title" option — no pickers.
    const realOptions = product.options.filter((o) => o.name !== 'Title');
    const selects = realOptions.map((opt) => {
      const sel = document.createElement('select');
      sel.className = 'option-select-field hyun-buy-select';
      sel.name = opt.name;
      sel.add(new Option('Select ' + opt.name, ''));
      opt.optionValues.forEach((v) => sel.add(new Option(v.name, v.name)));
      sel.addEventListener('change', update);
      mount.appendChild(sel);
      return sel;
    });

    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.value = '1';
    qty.inputMode = 'numeric';
    qty.className = 'option-select-field hyun-buy-qty';
    qty.setAttribute('aria-label', 'Quantity');
    mount.appendChild(qty);

    const price = el('div', 'product-price hyun-buy-price');
    const button = el('a', 'button add-to-cart-button hyun-buy-button');
    button.textContent = 'Buy Now';
    button.href = '#';
    const error = el('div', 'hyun-buy-error');
    mount.append(price, button, error);

    let current = null; // { variant, plan }

    function update() {
      current = null;
      error.textContent = '';
      price.style.display = 'none';
      button.classList.add('hyun-buy-disabled');

      const chosen = {};
      for (const sel of selects) {
        if (!sel.value) return; // wait until every option is picked
        chosen[sel.name] = sel.value;
      }

      const variant = variants.find((v) =>
        v.selectedOptions.every(
          (o) => o.name === 'Title' || chosen[o.name] === o.value
        )
      );
      // Zero price means "not sold online" in the source catalog — never sell it.
      if (!variant || !variant.availableForSale || !(+variant.price.amount > 0)) {
        error.textContent = 'This combination is unavailable.';
        return;
      }

      // A subscription product must resolve its selling plan — refuse to
      // fall through to a one-time charge (the exact Webflow bug).
      let plan = null;
      if (plans.length) {
        plan = plans.find((p) => p.name === PLAN_BY_FREQUENCY[chosen['Frequency']]);
        if (!plan) {
          error.textContent = 'Unable to set up this subscription. Please contact us.';
          console.error('[hyun-buy] no selling plan for', chosen['Frequency']);
          return;
        }
      }

      current = { variant, plan };
      price.textContent = fmt.format(variant.price.amount);
      price.style.display = 'block';
      button.classList.remove('hyun-buy-disabled');
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      if (!current || button.dataset.busy) return;
      button.dataset.busy = '1';
      button.textContent = 'One moment…';
      const line = {
        merchandiseId: current.variant.id,
        quantity: Math.max(1, parseInt(qty.value, 10) || 1),
      };
      if (current.plan) line.sellingPlanId = current.plan.id;
      createCart([line])
        .then((res) => {
          const out = res.data.cartCreate;
          if (out.userErrors.length) throw new Error(out.userErrors[0].message);
          window.location.href = out.cart.checkoutUrl;
        })
        .catch((err) => {
          delete button.dataset.busy;
          button.textContent = 'Buy Now';
          error.textContent = 'Checkout failed. Please try again.';
          console.error('[hyun-buy]', err);
        });
    });

    update();
  }

  const CSS = `
    .hyun-buy { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
    .hyun-buy-select { padding: 8px 12px; min-width: 260px; }
    .hyun-buy-qty { width: 80px; padding: 8px 12px; }
    .hyun-buy-price { font-size: 1.4em; margin: 0; }
    .hyun-buy-button { margin-top: 8px; cursor: pointer; }
    .hyun-buy-disabled { opacity: .4; pointer-events: none; }
    .hyun-buy-error { color: #b00020; font-size: .9em; min-height: 1.2em; }
  `;
  if (!document.getElementById('hyun-buy-css')) {
    const style = document.createElement('style');
    style.id = 'hyun-buy-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }

  const boot = () =>
    document.querySelectorAll('[data-hyun-buy]').forEach(init);
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
