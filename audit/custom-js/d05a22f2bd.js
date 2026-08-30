// pages: /checkout
document.addEventListener("DOMContentLoaded", function () {
  function clearCheckoutFields() {
    const fieldsToClear = [
      "#wf-ecom-shipping-name",
      "#wf-ecom-shipping-address",
      "#wf-ecom-shipping-city",
      "#wf-ecom-shipping-zip",
      ".google-address-field"
    ];

    fieldsToClear.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (field) {
        field.value = "";
        field.setAttribute("autocomplete", "off");
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll(".info_store_wrap .auth-field").forEach(function (field) {
      field.value = "";
      field.setAttribute("autocomplete", "off");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });

    document.querySelectorAll(".shipping-address .auth-field").forEach(function (field) {
      const label = field.previousElementSibling?.textContent?.toLowerCase() || "";
      if (label.includes("country")) return;

      field.value = "";
      field.setAttribute("autocomplete", "off");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const shippingPreview = document.getElementById("z-shipping-preview");
    if (shippingPreview) {
      shippingPreview.textContent = "Calculated by ZIP code";
    }

    const totalPreview = document.getElementById("z-total-preview");
    const subtotalEl = document.querySelector(".text-block-58");

    if (totalPreview && subtotalEl) {
      totalPreview.textContent = subtotalEl.textContent;
    }
  }

  clearCheckoutFields();

  setTimeout(clearCheckoutFields, 300);
  setTimeout(clearCheckoutFields, 1000);
});