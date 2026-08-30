// pages: /checkout
document.addEventListener("DOMContentLoaded", function () {
  const checkoutButton = document.getElementById("checkout-btn");
  if (!checkoutButton) return;

  checkoutButton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

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
    let isPickup = savedMethod === "pickup";

    if (!isDeliver && !isPickup) {
      isDeliver = methodText.includes("deliver");
      isPickup =
        methodText.includes("pick up") ||
        methodText.includes("pickup");
    }

    function getFieldValueByLabel(sectionSelector, keyword) {
      const section = document.querySelector(sectionSelector);
      if (!section) return "";

      const labels = section.querySelectorAll(".auth_label");

      for (const label of labels) {
        const labelText =
          label.textContent.trim().toLowerCase();

        if (!labelText.includes(keyword)) continue;

        let field = label.nextElementSibling;

        while (
          field &&
          !field.classList.contains("auth-field")
        ) {
          field = field.nextElementSibling;
        }

        return field
          ? String(field.value || "").trim()
          : "";
      }

      return "";
    }

    function getValueById(id) {
      return (
        document.getElementById(id)?.value?.trim() ||
        ""
      );
    }

    function getFirstValue(selectors) {
      for (const selector of selectors) {
        const el = document.querySelector(selector);

        if (el && String(el.value || "").trim()) {
          return String(el.value).trim();
        }
      }

      return "";
    }

    const zipInput =
      document.getElementById("wf-ecom-shipping-zip");

    const zip =
      zipInput?.value?.trim() || "";

    let deliveryName = "";
    let streetAddress = "";
    let streetAddress2 = "";
    let city = "";
    let state = "";
    let country = "US";
    let customerEmail = "";
    let customerPhone = "";

    if (isDeliver) {
      deliveryName =
        getValueById("wf-ecom-shipping-name") ||
        getFieldValueByLabel(
          ".shipping-address",
          "name"
        );

      streetAddress =
        getValueById("wf-ecom-shipping-address") ||
        document.querySelector(
          ".google-address-field"
        )?.value?.trim() ||
        getFieldValueByLabel(
          ".shipping-address",
          "street"
        ) ||
        getFieldValueByLabel(
          ".shipping-address",
          "address"
        );

      streetAddress2 =
        getValueById("wf-ecom-shipping-address-2") ||
        getValueById("wf-ecom-shipping-address2") ||
        getFieldValueByLabel(
          ".shipping-address",
          "apartment"
        ) ||
        getFieldValueByLabel(
          ".shipping-address",
          "unit"
        );

      city =
        getValueById("wf-ecom-shipping-city") ||
        getFieldValueByLabel(
          ".shipping-address",
          "city"
        );

      state =
        getValueById("wf-ecom-shipping-state") ||
        getFieldValueByLabel(
          ".shipping-address",
          "state"
        );

      customerEmail =
        getFirstValue([
          "#wf-ecom-email",
          "#email",
          'input[type="email"]'
        ]) ||
        getFieldValueByLabel(
          ".shipping-address",
          "email"
        );

      customerPhone =
        getFirstValue([
          "#wf-ecom-shipping-phone",
          "#phone",
          'input[type="tel"]'
        ]) ||
        getFieldValueByLabel(
          ".shipping-address",
          "phone"
        );

      if (!deliveryName) {
        alert("Please enter your full name.");
        return;
      }

      if (!streetAddress) {
        alert("Please enter your street address.");
        return;
      }

      if (!city) {
        alert("Please enter your city.");
        return;
      }

      if (!state) {
        alert("Please enter your state.");
        return;
      }

      if (!zip || !/^\d{5}$/.test(zip)) {
        alert("Please enter a valid ZIP code.");
        return;
      }
    }

    if (isPickup) {
      const pickupName =
        getFieldValueByLabel(
          ".info_store_wrap",
          "name"
        );

      const phoneNumber =
        getFieldValueByLabel(
          ".info_store_wrap",
          "phone"
        );

      const pickupDateTime =
        getFieldValueByLabel(
          ".info_store_wrap",
          "date"
        ) ||
        getFieldValueByLabel(
          ".info_store_wrap",
          "time"
        );

      if (!pickupName) {
        alert("Please enter the pickup name.");
        return;
      }

      if (!phoneNumber) {
        alert("Please enter a phone number.");
        return;
      }

      if (!pickupDateTime) {
        alert(
          "Please enter your preferred pickup date and time."
        );
        return;
      }
    }

    const categoryMap = {};

    const normalize = (str) =>
      str
        ? str
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase()
        : "";

    document
      .querySelectorAll(
        ".lz_info_products .w-dyn-item"
      )
      .forEach((el) => {
        const prodNameEl =
          el.querySelector(
            ".lz_info_products_txt"
          );

        const catNameEl =
          el.querySelector(
            ".lz_info_category_txt"
          );

        if (prodNameEl && catNameEl) {
          const pName = normalize(
            prodNameEl.textContent.trim()
          );

          const cName =
            catNameEl.textContent.trim();

          categoryMap[pName] = cName;
        }
      });

    const items = [];

    const orderList =
      document.getElementById("lz_order_items");

    if (orderList) {
      const checkoutItems =
        orderList.querySelectorAll(
          ".w-commerce-commercecheckoutorderitem, .items-blocks"
        );

      checkoutItems.forEach((el) => {
        const name =
          el
            .querySelector(".text-block-56")
            ?.textContent.trim() ||
          el
            .querySelector(
              ".w-commerce-commercecheckoutorderitemname"
            )
            ?.textContent.trim() ||
          "";

        const qtyEl =
          el.querySelector(".option-quantity");

        const quantity = qtyEl
          ? parseInt(
              qtyEl.textContent.replace(
                /[^0-9]/g,
                ""
              ),
              10
            )
          : 1;

        const weightEl =
          el.querySelector(".option-weight");

        let weight = false;

        if (weightEl) {
          const weightMatch =
            weightEl.textContent.match(
              /[0-9.]+/
            );

          weight = weightMatch
            ? parseFloat(weightMatch[0])
            : false;
        }

        const priceEl =
          el.querySelector(".option-price");

        let price = 0;

        if (priceEl) {
          price =
            parseFloat(
              priceEl.textContent.replace(
                /[^0-9.]/g,
                ""
              )
            ) || 0;
        }

        const singlePriceEl =
          el.querySelector(
            ".option-single-price"
          );

        let singlePrice = 0;

        if (singlePriceEl) {
          singlePrice =
            parseFloat(
              singlePriceEl.textContent.replace(
                /[^0-9.]/g,
                ""
              )
            ) || 0;
        }

        const rawCategory =
          categoryMap[normalize(name)] ||
          "General";

        const isBundle =
          rawCategory
            .toLowerCase()
            .includes("bundles");

        const isGift =
          rawCategory
            .toLowerCase()
            .includes("gift");

        if (name) {
          items.push({
            name: name,

            quantity:
              isNaN(quantity)
                ? 1
                : quantity,

            weight: weight,

            price: price,

            "single-price":
              singlePrice,

            category:
              rawCategory,

            isBundle:
              isBundle,

            isGift:
              isGift
          });
        }
      });
    }

    const subtotalEl =
      document.querySelector(
        ".text-block-58"
      );

    const subtotalText =
      subtotalEl?.textContent.replace(
        /[^0-9.]/g,
        ""
      ) || "0";

    const productPrice =
      parseFloat(subtotalText);

    if (
      isNaN(productPrice) ||
      productPrice <= 0 ||
      items.length === 0
    ) {
      alert(
        "We couldn't verify your order. Please check your cart."
      );
      return;
    }

    checkoutButton.disabled = true;

    try {
      const requestBody = {
        productPrice:
          productPrice,

        zip:
          zip,

        isDeliver:
          isDeliver,

        items:
          items,

        giftMessageEnabled:
          localStorage.getItem(
            "hyunGiftMessageEnabled"
          ) || "no",

        giftMessageText:
          localStorage.getItem(
            "hyunGiftMessageEnabled"
          ) === "yes"
            ? localStorage.getItem(
                "hyunGiftMessageText"
              ) || ""
            : "",

        shippingAddress: {
          name:
            deliveryName,

          line1:
            streetAddress,

          line2:
            streetAddress2,

          city:
            city,

          state:
            state,

          postalCode:
            zip,

          country:
            country,

          email:
            customerEmail,

          phone:
            customerPhone
        },

        shippingName:
          deliveryName,

        shippingLine1:
          streetAddress,

        shippingLine2:
          streetAddress2,

        shippingCity:
          city,

        shippingState:
          state,

        shippingZip:
          zip,

        shippingCountry:
          country,

        customerEmail:
          customerEmail,

        customerPhone:
          customerPhone
      };

      console.log(
        "[checkout] request body:",
        requestBody
      );

      const res =
        await fetch(
          "https://shipping.thehyun.com/api/create-checkout-session",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                requestBody
              )
          }
        );

      const data =
        await res
          .json()
          .catch(() => ({}));

      if (!res.ok) {
        alert(
          data.message ||
            "We couldn't verify your order. Please return to the cart and try again."
        );
        return;
      }

      if (data?.url) {
        window.location.href =
          data.url;
      } else {
        alert(
          "Checkout failed: Missing redirect URL"
        );
      }
    } catch (err) {
      console.error(err);

      alert(
        "Checkout failed: Network error"
      );
    } finally {
      checkoutButton.disabled =
        false;
    }
  });
});