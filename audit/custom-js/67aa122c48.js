// pages: /checkout
document.addEventListener("DOMContentLoaded", function () {
  const zipInput = document.getElementById("wf-ecom-shipping-zip");
  const preview = document.getElementById("z-shipping-preview");
  if (!zipInput || !preview) return;

  const originalTotalText =
    document.querySelector(".w-commerce-commercecheckoutsummarytotal")?.textContent || "";

  const normalize = (str) =>
    str ? str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";

  const parseMoney = (text) => {
    const n = parseFloat(String(text || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const formatUSD = (value) => `$ ${value.toFixed(2)}`;

  function getSummaryEls() {
    return {
      subtotalEl: document.querySelector(".text-block-58"),
      totalEl: document.querySelector(".w-commerce-commercecheckoutsummarytotal"),
    };
  }

  function updatePreviewAndTotal(shippingCost) {
    preview.textContent = formatUSD(shippingCost);

    const { subtotalEl, totalEl } = getSummaryEls();
    if (!subtotalEl) return;

    const subtotal = parseMoney(subtotalEl.textContent);
    const finalTotal = subtotal + shippingCost;

    const customTotalEl = document.getElementById("z-total-preview");

    if (customTotalEl) {
      customTotalEl.textContent = formatUSD(finalTotal);
    }

    if (totalEl) {
      totalEl.textContent = formatUSD(finalTotal);
    }

    setTimeout(() => {
      const lateTotalEl = document.querySelector(".w-commerce-commercecheckoutsummarytotal");
      if (lateTotalEl) lateTotalEl.textContent = formatUSD(finalTotal);
    }, 0);
  }

  function restoreTotal() {
    const { subtotalEl, totalEl } = getSummaryEls();
    const customTotalEl = document.getElementById("z-total-preview");

    if (subtotalEl && customTotalEl) {
      customTotalEl.textContent = subtotalEl.textContent;
    }

    if (totalEl && originalTotalText != null) {
      totalEl.textContent = originalTotalText;
    }
  }

  restoreTotal();

  function collectCheckoutContext() {
    const savedMethod =
      sessionStorage.getItem("hyunOrderMethod") ||
      localStorage.getItem("hyunOrderMethod");

    const selectedMethodEl = document.querySelector(
      'input[name="shipping-method-choice"]:checked'
    );

    const methodText = selectedMethodEl
      ? (selectedMethodEl.closest("label")?.textContent || "").toLowerCase()
      : "";

    let isDeliver = savedMethod === "delivery";

    if (savedMethod !== "delivery" && savedMethod !== "pickup") {
      isDeliver = methodText.includes("deliver");
    }

    const categoryMap = {};

    document.querySelectorAll(".lz_info_products .w-dyn-item").forEach((el) => {
      const prodNameEl = el.querySelector(".lz_info_products_txt");
      const catNameEl = el.querySelector(".lz_info_category_txt");

      if (prodNameEl && catNameEl) {
        categoryMap[normalize(prodNameEl.textContent.trim())] =
          catNameEl.textContent.trim();
      }
    });

    const items = [];
    const orderList = document.getElementById("lz_order_items");

    if (orderList) {
      const checkoutItems = orderList.querySelectorAll(
        ".w-commerce-commercecheckoutorderitem, .items-blocks"
      );

      checkoutItems.forEach((el) => {
        const name =
          el.querySelector(".text-block-56")?.textContent.trim() ||
          el.querySelector(".w-commerce-commercecheckoutorderitemname")?.textContent.trim() ||
          "";

        const qtyEl = el.querySelector(".option-quantity");
        const quantity = qtyEl
          ? parseInt(qtyEl.textContent.replace(/[^0-9]/g, ""), 10)
          : 1;

        const weightEl = el.querySelector(".option-weight");
        let weight = false;

        if (weightEl) {
          const weightMatch = weightEl.textContent.match(/[0-9.]+/);
          weight = weightMatch ? parseFloat(weightMatch[0]) : false;
        }

        const priceEl = el.querySelector(".option-price");
        const price = priceEl
          ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, "")) || 0
          : 0;

        const singlePriceEl = el.querySelector(".option-single-price");
        const singlePrice = singlePriceEl
          ? parseFloat(singlePriceEl.textContent.replace(/[^0-9.]/g, "")) || 0
          : 0;

        const rawCategory = categoryMap[normalize(name)] || "General";
        const isBundle = rawCategory.toLowerCase().includes("bundles");
        const isGift = rawCategory.toLowerCase().includes("gift");

        if (name) {
          items.push({
            name,
            quantity: isNaN(quantity) ? 1 : quantity,
            weight,
            price,
            "single-price": singlePrice,
            isBundle,
            isGift,
          });
        }
      });
    }

    return { isDeliver, items };
  }

  let timer;

  zipInput.addEventListener("input", function () {
    clearTimeout(timer);

    const zip = zipInput.value.trim();

    if (!/^\d{5}$/.test(zip)) {
      preview.textContent = "Please enter a ZIP code";
      restoreTotal();
      return;
    }

    timer = setTimeout(async function () {
      try {
        preview.textContent = "Calculating shipping...";

        const { isDeliver, items } = collectCheckoutContext();

        const res = await fetch("https://shipping.thehyun.com/api/get-shipping-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zip, isDeliver, items }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          preview.textContent = data?.message || `Request failed (${res.status})`;
          restoreTotal();
          return;
        }

        const cost = data?.shippingCost;

        if (typeof cost === "number") {
          updatePreviewAndTotal(cost);
        } else {
          preview.textContent = "Shipping unavailable for this ZIP";
          restoreTotal();
        }
      } catch (e) {
        preview.textContent = "Network error";
        restoreTotal();
      }
    }, 400);
  });
});