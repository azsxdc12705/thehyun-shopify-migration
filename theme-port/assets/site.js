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
