/* THE HYUN subscription-builder quiz, ported from Webflow (audit/custom-js/
 * b5ce728bb6.js) to Shopify. Runs on /subscription-builder against the
 * existing Webflow-designed quiz DOM (.curated-step / .curated-option-card /
 * .curated-review / .curated-add-to-cart).
 *
 * What the old script hacked around, Shopify does natively:
 *  - hidden Webflow add-to-cart form sync  -> Storefront cartCreate
 *  - separate preferences form submission  -> cart line attributes (land on
 *    the order, visible in checkout and Admin)
 *  - localStorage one-subscription-per-cart guards -> Shopify's own cart
 *
 * Expects window.HYUN_QUIZ = { shop, token } to be defined first; no-ops
 * otherwise (that is how the staging gate works).
 */
(function () {
  var cfg = window.HYUN_QUIZ;
  if (!cfg) return;

  var HANDLE = 'curated-collection';
  var PLAN_BY_FREQUENCY = {
    'Monthly': 'Deliver every month',
    'Twice a Month': 'Deliver every 2 weeks',
  };
  // quiz card labels that differ from the Shopify option values
  var VALUE_MAP = {
    'Every Month': 'Monthly',
    'Every Two Weeks': 'Twice a Month',
    'Delivery + Dining at HYUN': 'Delivery + HYUN Dining',
  };
  var MULTI_LIMITS = { 'cooking-style': 4, 'preferred-cuts': 2, avoid: 1 };
  var LIMIT_MSG = {
    'cooking-style': 'Please select up to 4 styles.',
    'preferred-cuts': 'Please select up to 2 preferred cuts.',
    avoid: 'Please select one item to avoid.',
  };

  var answers = {
    frequency: '',
    'collection-size': '',
    experience: '',
    'cooking-style': [],
    'preferred-cuts': [],
    avoid: [],
  };

  function mapped(value) {
    return VALUE_MAP[value] || value;
  }

  function gql(query, variables) {
    return fetch('https://' + cfg.shop + '/api/2025-07/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': cfg.token,
      },
      body: JSON.stringify({ query: query, variables: variables }),
    }).then(function (r) { return r.json(); });
  }

  function boot() {
    var steps = Array.prototype.slice.call(document.querySelectorAll('.curated-step'));
    var review = document.querySelector('.curated-review');

    // Replacing the nodes drops any listeners the legacy quiz script attached
    // (it coexists with this one on staging); harmless when it is absent.
    document.querySelectorAll('.curated-option-card, .curated-add-to-cart').forEach(function (n) {
      n.replaceWith(n.cloneNode(true));
    });

    var addButton = Array.prototype.slice
      .call(document.querySelectorAll('.curated-add-to-cart'))
      .find(function (btn) { return !btn.closest('.curated-webflow-add-to-cart-wrap'); });

    function isComplete() {
      return (
        answers.frequency &&
        answers['collection-size'] &&
        answers.experience &&
        answers['cooking-style'].length > 0 &&
        answers['preferred-cuts'].length > 0 &&
        answers.avoid.length > 0
      );
    }

    // The legacy script never filled the review list, so every line stayed
    // "—" even after a completed quiz. Fill it from the answers.
    var REVIEW_LABELS = {
      frequency: 'Frequency',
      'collection-size': 'Collection Size',
      experience: 'Experience',
      'cooking-style': 'Preferred Style',
      'preferred-cuts': 'Preferred Cuts',
      avoid: 'Avoid',
    };

    function updateReview() {
      document.querySelectorAll('[data-review]').forEach(function (el) {
        var q = el.getAttribute('data-review');
        var value = answers[q];
        if (Array.isArray(value)) value = value.join(', ');
        el.textContent = (REVIEW_LABELS[q] || q) + ': ' + (value || '—');
      });
    }

    function showNextStep(currentStep) {
      var next = steps[steps.indexOf(currentStep) + 1];
      if (next) next.classList.add('is-active');
      updateReview();
      if (isComplete() && review) review.classList.add('is-active');
    }

    function handleMultiSelect(card, question, value) {
      var selected = answers[question];
      var already = selected.indexOf(value) !== -1;

      if (question === 'avoid') {
        document.querySelectorAll('.curated-option-card[data-question="avoid"]').forEach(function (s) {
          s.classList.remove('is-selected');
        });
        answers.avoid = already ? [] : [value];
        if (!already) card.classList.add('is-selected');
        return;
      }

      if (already) {
        answers[question] = selected.filter(function (v) { return v !== value; });
        card.classList.remove('is-selected');
        return;
      }
      if (selected.length >= MULTI_LIMITS[question]) {
        alert(LIMIT_MSG[question]);
        return;
      }
      selected.push(value);
      card.classList.add('is-selected');
    }

    document.querySelectorAll('.curated-option-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var question = card.getAttribute('data-question');
        var value = card.getAttribute('data-value');
        var currentStep = card.closest('.curated-step');
        if (!question || !value || !currentStep) return;

        if (MULTI_LIMITS[question]) {
          handleMultiSelect(card, question, value);
        } else {
          answers[question] = value;
          currentStep.querySelectorAll('.curated-option-card').forEach(function (s) {
            s.classList.remove('is-selected');
          });
          card.classList.add('is-selected');
        }
        showNextStep(currentStep);
      });
    });

    function firstMissing() {
      if (!answers.frequency) return 'Please select your frequency.';
      if (!answers['collection-size']) return 'Please select your collection size.';
      if (!answers.experience) return 'Please select your experience.';
      if (!answers['cooking-style'].length) return 'Please select at least one preferred style.';
      if (!answers['preferred-cuts'].length) return 'Please select at least one preferred cut.';
      if (!answers.avoid.length) return 'Please select one avoid preference, or select No Avoidance.';
      return null;
    }

    // Native mode (on-theme): product data is Liquid-rendered into
    // #hyun-product-json and checkout goes through the Cart AJAX API with the
    // selling plan and the preferences as line item properties — no token.
    function nativeCheckout(wanted) {
      var blob = document.getElementById('hyun-product-json');
      var product = JSON.parse(blob.textContent);
      var variant = product.variants.nodes.find(function (v) {
        return v.selectedOptions.every(function (o) { return wanted[o.name] === o.value; });
      });
      var plan = product.sellingPlanGroups.nodes
        .flatMap(function (g) { return g.sellingPlans.nodes; })
        .find(function (p) { return p.name === PLAN_BY_FREQUENCY[wanted['Frequency']]; });
      if (!variant || !plan) {
        return Promise.reject(new Error('no variant/plan for ' + JSON.stringify(wanted)));
      }
      // Adds to the shopper's existing cart; clearing it here would drop
      // whatever else they were buying (see buy-widget.js).
      return Promise.resolve()
        .then(function () {
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{
              id: variant.id,
              quantity: 1,
              selling_plan: plan.id,
              properties: {
                'Preferred Style': answers['cooking-style'].join(', '),
                'Preferred Cuts': answers['preferred-cuts'].join(', '),
                'Avoid': answers.avoid.join(', '),
              },
            }] }),
          });
        })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) throw new Error(data.description || data.message || 'cart add failed');
            window.location.href = '/checkout';
          });
        });
    }

    function checkout() {
      var wanted = {
        'Frequency': mapped(answers.frequency),
        'Collection Size': mapped(answers['collection-size']),
        'Experience': mapped(answers.experience),
      };

      if (document.getElementById('hyun-product-json')) {
        nativeCheckout(wanted).catch(function (err) {
          delete addButton.dataset.busy;
          alert('Checkout could not be started. Please try again.');
          console.error('[hyun-quiz]', err);
        });
        return;
      }

      gql(
        'query ($handle: String!) { product(handle: $handle) {' +
        ' variants(first: 100) { nodes { id selectedOptions { name value } } }' +
        ' sellingPlanGroups(first: 10) { nodes { sellingPlans(first: 10) { nodes { id name } } } } } }',
        { handle: HANDLE }
      ).then(function (res) {
        var product = res.data.product;
        var variant = product.variants.nodes.find(function (v) {
          return v.selectedOptions.every(function (o) { return wanted[o.name] === o.value; });
        });
        var plan = product.sellingPlanGroups.nodes
          .flatMap(function (g) { return g.sellingPlans.nodes; })
          .find(function (p) { return p.name === PLAN_BY_FREQUENCY[wanted['Frequency']]; });
        if (!variant || !plan) throw new Error('no variant/plan for ' + JSON.stringify(wanted));

        return gql(
          'mutation ($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) {' +
          ' cart { checkoutUrl } userErrors { message } } }',
          { lines: [{
            merchandiseId: variant.id,
            quantity: 1,
            sellingPlanId: plan.id,
            attributes: [
              { key: 'Preferred Style', value: answers['cooking-style'].join(', ') },
              { key: 'Preferred Cuts', value: answers['preferred-cuts'].join(', ') },
              { key: 'Avoid', value: answers.avoid.join(', ') },
            ],
          }] }
        );
      }).then(function (res) {
        var out = res.data.cartCreate;
        if (out.userErrors.length) throw new Error(out.userErrors[0].message);
        window.location.href = out.cart.checkoutUrl;
      }).catch(function (err) {
        delete addButton.dataset.busy;
        alert('Checkout could not be started. Please try again.');
        console.error('[hyun-quiz]', err);
      });
    }

    if (addButton) {
      addButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var missing = firstMissing();
        if (missing) { alert(missing); return; }
        if (addButton.dataset.busy) return;
        addButton.dataset.busy = '1';
        checkout();
      });
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
