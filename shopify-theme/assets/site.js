/* Vanilla replacement for the two webflow.js components this page uses:
 * w-dropdown (About / Gifts menus) and w-nav (mobile hamburger, over-left).
 * Class/attribute contract matches the compiled stylesheet (thyun.css), so
 * the existing Webflow CSS keeps doing the presentation.
 */
(function () {
  'use strict';

  /* ---------------- w-dropdown ---------------- */

  function closeDropdown(dd) {
    dd.classList.remove('w--open');
    const toggle = dd.querySelector('.w-dropdown-toggle');
    const list = dd.querySelector('.w-dropdown-list');
    if (toggle) {
      toggle.classList.remove('w--open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    if (list) list.classList.remove('w--open');
  }

  function openDropdown(dd) {
    document.querySelectorAll('.w-dropdown.w--open').forEach(closeDropdown);
    dd.classList.add('w--open');
    const toggle = dd.querySelector('.w-dropdown-toggle');
    const list = dd.querySelector('.w-dropdown-list');
    if (toggle) {
      toggle.classList.add('w--open');
      toggle.setAttribute('aria-expanded', 'true');
    }
    if (list) list.classList.add('w--open');
  }

  document.querySelectorAll('.w-dropdown').forEach((dd) => {
    const toggle = dd.querySelector('.w-dropdown-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      dd.classList.contains('w--open') ? closeDropdown(dd) : openDropdown(dd);
    });
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.w-dropdown')) {
      document.querySelectorAll('.w-dropdown.w--open').forEach(closeDropdown);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.w-dropdown.w--open').forEach(closeDropdown);
    }
  });

  /* ---------------- w-nav (collapse: medium, animation: over-left) -------- */

  const nav = document.querySelector('.w-nav');
  const button = nav && nav.querySelector('.w-nav-button');
  const menu = nav && nav.querySelector('.w-nav-menu');
  if (!nav || !button || !menu) return;

  const duration = parseInt(nav.getAttribute('data-duration'), 10) || 400;
  const placeholder = document.createComment('w-nav-menu-home');
  menu.parentNode.insertBefore(placeholder, menu);

  const overlay = document.createElement('div');
  overlay.className = 'w-nav-overlay';
  nav.appendChild(overlay);

  let open = false;

  function openNav() {
    open = true;
    button.classList.add('w--open');
    button.setAttribute('aria-expanded', 'true');
    menu.setAttribute('data-nav-menu-open', '');
    overlay.appendChild(menu);
    overlay.style.display = 'block';
    // webflow.js sizes the overlay inline; over-left otherwise collapses to 0
    overlay.style.width = '100%';
    overlay.style.height = document.documentElement.scrollHeight + 'px';
    menu.style.display = 'block';
    if (nav.getAttribute('data-no-scroll') === '1') {
      document.documentElement.style.overflow = 'hidden';
    }
    // over-left: slide in from the left edge
    menu.style.transform = 'translateX(-100%)';
    menu.style.transition = 'transform ' + duration + 'ms ease-out';
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        menu.style.transform = 'translateX(0)';
      })
    );
  }

  function closeNav() {
    open = false;
    button.classList.remove('w--open');
    button.setAttribute('aria-expanded', 'false');
    menu.style.transform = 'translateX(-100%)';
    setTimeout(() => {
      if (open) return;
      menu.removeAttribute('data-nav-menu-open');
      menu.style.cssText = '';
      overlay.style.display = 'none';
      placeholder.parentNode.insertBefore(menu, placeholder.nextSibling);
      document.documentElement.style.overflow = '';
    }, duration);
  }

  button.addEventListener('click', () => (open ? closeNav() : openNav()));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      button.click();
    }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeNav();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) closeNav();
  });
  // leaving the collapsed breakpoint restores the desktop menu
  window.matchMedia('(min-width: 992px)').addEventListener('change', (mq) => {
    if (mq.matches && open) closeNav();
  });
})();

/* ---------------- product price follows the weight picker ----------------
 * The live page rebound the price whenever the SKU changed (Webflow commerce).
 * Without this the headline keeps the first variant's price while the shopper
 * picks another weight, and the cart charges the other one. */
(function () {
  'use strict';
  var select = document.querySelector('[data-variant-select]');
  var price = document.querySelector('[data-price-display]');
  if (!select || !price) return;
  select.addEventListener('change', function () {
    var opt = select.options[select.selectedIndex];
    var p = opt && opt.getAttribute('data-price');
    if (p) price.textContent = p + ' ';
  });
})();

/* ---------------- w-tabs (category pages' primal tabs) ---------------- */
(function () {
  'use strict';
  document.querySelectorAll('.w-tabs').forEach(function (tabs) {
    var links = Array.prototype.slice.call(tabs.querySelectorAll('.w-tab-link'));
    var panes = Array.prototype.slice.call(tabs.querySelectorAll('.w-tab-pane'));
    links.forEach(function (link, i) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        links.forEach(function (l, j) { l.classList.toggle('w--current', j === i); });
        panes.forEach(function (p, j) { p.classList.toggle('w--tab-active', j === i); });
      });
    });
  });
})();

/* ---------------- w-slider (home category carousel) ----------------
 * Same contract as webflow.js: slides shift together via translateX, the
 * nav renders numbered dots (.w-num), autoplay/delay/duration come from the
 * slider's data attributes. */
(function () {
  'use strict';
  document.querySelectorAll('.w-slider').forEach(function (slider) {
    var mask = slider.querySelector('.w-slider-mask');
    if (!mask) return;
    var slides = Array.prototype.slice.call(mask.querySelectorAll('.w-slide'));
    if (slides.length < 2) return;
    var nav = slider.querySelector('.w-slider-nav');
    var duration = parseInt(slider.getAttribute('data-duration'), 10) || 500;
    var delay = parseInt(slider.getAttribute('data-delay'), 10) || 4000;
    var autoplay = slider.getAttribute('data-autoplay') === 'true';
    var index = 0;
    var timer = null;

    var dots = slides.map(function (_, i) {
      var d = document.createElement('div');
      d.className = 'w-slider-dot';
      d.setAttribute('role', 'button');
      d.setAttribute('aria-label', 'Show slide ' + (i + 1) + ' of ' + slides.length);
      if (nav && nav.classList.contains('w-num')) d.textContent = i + 1;
      d.addEventListener('click', function () { go(i); restart(); });
      if (nav) nav.appendChild(d);
      return d;
    });

    function go(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s) {
        s.style.transition = 'transform ' + duration + 'ms ease';
        s.style.transform = 'translateX(' + (-index * 100) + '%)';
      });
      dots.forEach(function (d, j) { d.classList.toggle('w-active', j === index); });
    }
    function restart() {
      if (!autoplay) return;
      clearInterval(timer);
      timer = setInterval(function () { go(index + 1); }, delay);
    }

    var left = slider.querySelector('.w-slider-arrow-left');
    var right = slider.querySelector('.w-slider-arrow-right');
    if (left) left.addEventListener('click', function () { go(index - 1); restart(); });
    if (right) right.addEventListener('click', function () { go(index + 1); restart(); });

    var startX = null;
    mask.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    mask.addEventListener('pointerup', function (e) {
      if (startX == null) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); restart(); }
      startX = null;
    });

    go(0);
    restart();
  });
})();
