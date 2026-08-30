// pages: /checkout-method
(function () {
  function handleOrderMethod(e) {
    const card = e.target.closest("[data-order-method]");
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();

    const method = card.getAttribute("data-order-method");

    sessionStorage.setItem("hyunOrderMethod", method);
    localStorage.setItem("hyunOrderMethod", method);

    window.location.href = "/checkout";
  }

  document.addEventListener("click", handleOrderMethod, true);
})();