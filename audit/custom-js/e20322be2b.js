// pages: /checkout
(function () {
  try {
    var method =
      sessionStorage.getItem("hyunOrderMethod") ||
      localStorage.getItem("hyunOrderMethod");

    if (method !== "pickup" && method !== "delivery") {
      method = "delivery";
    }

    document.documentElement.classList.add("hyun-method-" + method);
    document.documentElement.setAttribute("data-hyun-method", method);
  } catch (e) {
    document.documentElement.classList.add("hyun-method-delivery");
    document.documentElement.setAttribute("data-hyun-method", "delivery");
  }
})();