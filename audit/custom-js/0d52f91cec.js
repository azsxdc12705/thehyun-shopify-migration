// pages: /, /our-story, /brand-philosophy, /design-philosophy, /japanese-wagyu ...
/* Disable hidden checkout fields so required fields do not block checkout */
(function () {
  function getMethod() {
    var method =
      sessionStorage.getItem("hyunOrderMethod") ||
      localStorage.getItem("hyunOrderMethod") ||
      document.documentElement.getAttribute("data-hyun-method");

    if (method !== "pickup" && method !== "delivery") {
      method = "delivery";
    }

    return method;
  }

  function toggleSectionFields(section, isActive) {
    if (!section) return;

    var fields = section.querySelectorAll("input, select, textarea");

    fields.forEach(function (field) {
      if (!field.hasAttribute("data-hyun-required-checked")) {
        if (field.required || field.hasAttribute("required")) {
          field.setAttribute("data-hyun-was-required", "true");
        }
        field.setAttribute("data-hyun-required-checked", "true");
      }

      if (isActive) {
        field.disabled = false;

        if (field.getAttribute("data-hyun-was-required") === "true") {
          field.required = true;
          field.setAttribute("required", "required");
        }
      } else {
        field.required = false;
        field.removeAttribute("required");
        field.disabled = true;
      }
    });
  }

  function applyCheckoutMethodFields() {
    var method = getMethod();

    var pickupSection =
      document.querySelector('[data-checkout-fields="pickup"]') ||
      document.querySelector(".info_store_wrap");

    var deliverySection =
      document.querySelector('[data-checkout-fields="delivery"]') ||
      document.querySelector(".shipping-address");

    toggleSectionFields(pickupSection, method === "pickup");
    toggleSectionFields(deliverySection, method === "delivery");
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyCheckoutMethodFields();

    setTimeout(applyCheckoutMethodFields, 250);
    setTimeout(applyCheckoutMethodFields, 750);
    setTimeout(applyCheckoutMethodFields, 1500);
  });

  window.addEventListener("load", function () {
    applyCheckoutMethodFields();
  });

  document.addEventListener(
    "click",
    function (e) {
      if (
        e.target.closest('button[type="submit"]') ||
        e.target.closest('input[type="submit"]') ||
        e.target.closest(".w-commerce-commercecheckoutplaceorderbutton") ||
        e.target.closest(".checkout-button") ||
        e.target.closest('[data-node-type="commerce-checkout-place-order-button"]')
      ) {
        applyCheckoutMethodFields();
      }
    },
    true
  );
})();