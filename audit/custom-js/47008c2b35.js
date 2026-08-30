// pages: /, /our-story, /brand-philosophy, /design-philosophy, /japanese-wagyu ...
document.addEventListener("DOMContentLoaded", function () {
  var CART_TIMER_KEY = "hyunCartLastActivity";

  function updateCartActivity() {
    localStorage.setItem(CART_TIMER_KEY, String(Date.now()));
  }

  document.addEventListener("click", function (event) {
    if (
      event.target.closest(".w-commerce-commerceaddtocartbutton") ||
      event.target.closest("[data-node-type='commerce-add-to-cart-button']") ||
      event.target.closest("input[type='submit']")
    ) {
      updateCartActivity();
    }
  });
});