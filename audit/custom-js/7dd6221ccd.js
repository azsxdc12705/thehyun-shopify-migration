// pages: /checkout
(function () {
  var CART_TIMEOUT_HOURS = 24;
  var CART_TIMEOUT_MS = CART_TIMEOUT_HOURS * 60 * 60 * 1000;
  var CART_TIMER_KEY = "hyunCartLastActivity";

  try {
    var saved = parseInt(localStorage.getItem(CART_TIMER_KEY), 10);

    if (!saved || Date.now() - saved > CART_TIMEOUT_MS) {
      window.location.href = "/cart";
    }
  } catch (e) {
    window.location.href = "/cart";
  }
})();