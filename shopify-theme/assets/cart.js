/* Cart behaviour, replacing the Webflow commerce cart the port dropped.
 *
 *  - Add to Cart posts to the Cart AJAX API and opens the right-side drawer
 *    instead of navigating (what the live site does).
 *  - Remove links and the cart-page add-ons mutate the cart the same way.
 *  - After every change the cart markup is re-fetched from /cart and swapped
 *    in, so all rendering stays in Liquid (snippets/hyun-cart-items) and no
 *    money formatting is duplicated here.
 *  - Gift message is a cart attribute, so unlike the live site's
 *    localStorage-only version it actually reaches the order.
 */
(function () {
  'use strict';

  var DRAWER = '[data-hyun-cart-drawer]';

  function drawer() { return document.querySelector(DRAWER); }

  function openDrawer() {
    var d = drawer();
    if (d) d.style.display = 'block';
  }

  function closeDrawer() {
    var d = drawer();
    if (d) d.style.display = 'none';
  }

  function isOpen() {
    var d = drawer();
    return !!d && d.style.display === 'block';
  }

  // Re-render every cart-bound region from a fresh /cart response. One source
  // of truth (the Liquid snippets), no client-side money formatting.
  function refresh(keepOpen) {
    return fetch('/cart', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');

        var freshDrawer = doc.querySelector(DRAWER);
        var d = drawer();
        if (freshDrawer && d) {
          d.innerHTML = freshDrawer.innerHTML;
          d.style.display = keepOpen ? 'block' : 'none';
        }

        var freshCount = doc.querySelector('.w-commerce-commercecartopenlinkcount');
        document.querySelectorAll('.w-commerce-commercecartopenlinkcount').forEach(function (el) {
          if (freshCount) el.textContent = freshCount.textContent;
        });

        var freshPage = doc.querySelector('[data-hyun-cart-page]');
        var page = document.querySelector('[data-hyun-cart-page]');
        if (freshPage && page) page.innerHTML = freshPage.innerHTML;
      });
  }

  function cartRequest(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.description || data.message || 'Cart request failed');
        return data;
      });
    });
  }

  /* ---------------- add to cart ---------------- */

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[action*="/cart/add"]');
    if (!form) return;
    e.preventDefault();

    var data = new FormData(form);
    // "Buy now" submits carry return_to=/checkout; honour that by going
    // straight to checkout instead of opening the drawer.
    var straightToCheckout = (e.submitter && e.submitter.name === 'return_to') ||
      data.get('return_to') === '/checkout';
    data.delete('return_to');

    fetch('/cart/add.js', { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.json().then(function (out) {
          if (!r.ok) throw new Error(out.description || out.message || 'Add to cart failed');
          return out;
        });
      })
      .then(function () {
        if (straightToCheckout) { window.location.href = '/checkout'; return; }
        return refresh(true);
      })
      .catch(function (err) {
        // If the AJAX API is unreachable (network, bot challenge), fall back
        // to the plain form post so the item still lands in the cart.
        console.error('[hyun-cart]', err);
        form.submit();
      });
  });

  /* ---------------- drawer open/close ---------------- */

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-hyun-cart-open]')) {
      e.preventDefault();
      isOpen() ? closeDrawer() : openDrawer();
      return;
    }
    if (e.target.closest('[data-hyun-cart-close]')) {
      e.preventDefault();
      closeDrawer();
      return;
    }
    // click outside the open drawer (but not on the cart button) closes it
    if (isOpen() && !e.target.closest('.w-commerce-commercecartcontainer')) {
      closeDrawer();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) closeDrawer();
  });

  /* ---------------- remove ---------------- */

  document.addEventListener('click', function (e) {
    var remove = e.target.closest('[data-hyun-cart-remove]');
    if (!remove) return;
    e.preventDefault();
    var wasOpen = isOpen();
    cartRequest('/cart/change.js', { id: remove.getAttribute('data-hyun-cart-remove'), quantity: 0 })
      .then(function () { return refresh(wasOpen); })
      .catch(function (err) {
        // the anchor's href is Shopify's own remove URL — let it through
        console.error('[hyun-cart]', err);
        window.location.href = remove.getAttribute('href');
      });
  });

  /* ---------------- cart page add-ons ---------------- */

  // Wooden Gift Box and Bojagi Gift Wrapping are real products on the live
  // site too; the toggle adds or removes that line.
  function addonLineKey(handle) {
    var el = document.querySelector('[data-hyun-addon-line="' + handle + '"]');
    return el ? el.getAttribute('data-line-key') : null;
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-hyun-addon]');
    if (!toggle) return;
    e.preventDefault();

    var handle = toggle.getAttribute('data-hyun-addon');
    var variantId = toggle.getAttribute('data-variant-id');
    var lineKey = addonLineKey(handle);

    var action = lineKey
      ? cartRequest('/cart/change.js', { id: lineKey, quantity: 0 })
      : cartRequest('/cart/add.js', { items: [{ id: Number(variantId), quantity: 1 }] });

    action.then(function () { return refresh(false); })
      .catch(function (err) {
        console.error('[hyun-cart]', err);
        window.alert(err.message || 'Something went wrong updating your cart.');
      });
  });

  /* ---------------- gift message ---------------- */

  function modal() { return document.getElementById('giftMessageModal'); }

  document.addEventListener('click', function (e) {
    if (e.target.closest('.gift-message-edit')) {
      e.preventDefault();
      var m = modal();
      if (m) m.classList.add('is-open');
      return;
    }
    if (e.target.closest('.gift-message-close') || e.target.closest('.gift-message-modal-bg')) {
      e.preventDefault();
      var mm = modal();
      if (mm) mm.classList.remove('is-open');
      return;
    }
    if (e.target.closest('.gift-message-update')) {
      e.preventDefault();
      var wants = document.getElementById('gift-message-yes');
      var text = document.querySelector('.gift-message-textarea');
      var message = wants && wants.checked ? (text ? text.value.trim() : '') : '';
      cartRequest('/cart/update.js', { attributes: { 'Gift Message': message } })
        .then(function () {
          var mm2 = modal();
          if (mm2) mm2.classList.remove('is-open');
          return refresh(false);
        })
        .catch(function (err) { console.error('[hyun-cart]', err); });
    }
  });
})();
