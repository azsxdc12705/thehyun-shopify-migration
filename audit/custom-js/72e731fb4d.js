// pages: /cart
document.addEventListener("DOMContentLoaded", function () {
  /* ---------------------------------------------
     1. Shared Helpers
  --------------------------------------------- */

  function parseMoney(text) {
    if (!text) return 0;

    var cleaned = String(text).replace(/,/g, "");
    var match = cleaned.match(/\$\s*([0-9]+(\.[0-9]{1,2})?)/);

    if (!match) return 0;

    var value = parseFloat(match[1]);
    return isNaN(value) ? 0 : value;
  }

  function formatMoney(value) {
    return "$" + value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function normalizeText(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getCartItems() {
    return Array.from(document.querySelectorAll(".cart-page .w-commerce-commercecartitem"));
  }

  function getQuantityFromItem(item) {
    var qtyInput = item.querySelector("input[type='number']");
    if (!qtyInput) return 1;

    var qty = parseInt(qtyInput.value, 10);
    return isNaN(qty) || qty < 1 ? 1 : qty;
  }

  function getItemUnitPrice(item) {
    var priceSelectors = [
      ".w-commerce-commercecartproductprice",
      "[data-node-type='commerce-cart-item-price']"
    ];

    for (var i = 0; i < priceSelectors.length; i++) {
      var priceEl = item.querySelector(priceSelectors[i]);
      if (priceEl && priceEl.textContent.trim()) {
        var price = parseMoney(priceEl.textContent);
        if (price > 0) return price;
      }
    }

    var text = item.textContent || "";
    var matches = text.replace(/,/g, "").match(/\$\s*[0-9]+(\.[0-9]{1,2})?/g);

    if (!matches || !matches.length) return 0;

    return parseMoney(matches[0]);
  }

  function updateCartActivity() {
    localStorage.setItem("hyunCartLastActivity", String(Date.now()));
  }


  /* ---------------------------------------------
     2. Custom Cart Subtotal
  --------------------------------------------- */

  var subtotalSyncTimer = null;

  function calculateCustomSubtotal() {
    var items = getCartItems();
    var subtotal = 0;

    items.forEach(function (item) {
      var unitPrice = getItemUnitPrice(item);
      var quantity = getQuantityFromItem(item);
      subtotal += unitPrice * quantity;
    });

    return subtotal;
  }

  function updateCustomSubtotal() {
    var target = document.querySelector(".cart-summary-value");
    if (!target) return;

    target.textContent = formatMoney(calculateCustomSubtotal());
  }

  function scheduleSubtotalUpdate() {
    clearTimeout(subtotalSyncTimer);

    subtotalSyncTimer = setTimeout(function () {
      updateCustomSubtotal();
    }, 180);
  }

  updateCustomSubtotal();


  /* ---------------------------------------------
     3. Gift Message Modal
  --------------------------------------------- */

  var modal = document.getElementById("giftMessageModal");
  var editBtn = document.querySelector(".gift-message-edit");
  var closeBtn = document.querySelector(".gift-message-close");
  var bg = document.querySelector(".gift-message-modal-bg");
  var updateBtn = document.querySelector(".gift-message-update");
  var yesRadio = document.getElementById("gift-message-yes");
  var noRadio = document.getElementById("gift-message-no");
  var textarea = document.querySelector(".gift-message-textarea");
  var summary = document.querySelector(".gift-message-summary");

  function openGiftMessageModal() {
    if (!modal) return;
    modal.classList.add("is-open");
  }

  function closeGiftMessageModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
  }

  function updateGiftTextareaVisibility() {
    if (!textarea || !yesRadio) return;
    textarea.style.display = yesRadio.checked ? "block" : "none";
  }

  function loadSavedGiftMessage() {
    var enabled = localStorage.getItem("hyunGiftMessageEnabled");
    var message = localStorage.getItem("hyunGiftMessageText") || "";

    if (enabled === "yes") {
      if (yesRadio) yesRadio.checked = true;
      if (textarea) textarea.value = message;
      if (summary) summary.textContent = "Gift Message Added";
    } else {
      if (noRadio) noRadio.checked = true;
      if (textarea) textarea.value = "";
      if (summary) summary.textContent = "No Gift Message";
    }

    updateGiftTextareaVisibility();
  }

  if (modal && editBtn) {
    editBtn.addEventListener("click", function (e) {
      e.preventDefault();
      loadSavedGiftMessage();
      openGiftMessageModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      closeGiftMessageModal();
    });
  }

  if (bg) {
    bg.addEventListener("click", function () {
      closeGiftMessageModal();
    });
  }

  if (yesRadio) {
    yesRadio.addEventListener("change", function () {
      updateGiftTextareaVisibility();
    });
  }

  if (noRadio) {
    noRadio.addEventListener("change", function () {
      updateGiftTextareaVisibility();
    });
  }

  if (updateBtn) {
    updateBtn.addEventListener("click", function () {
      var wantsMessage = yesRadio && yesRadio.checked;
      var message = textarea ? textarea.value.trim() : "";

      localStorage.setItem("hyunGiftMessageEnabled", wantsMessage ? "yes" : "no");
      localStorage.setItem("hyunGiftMessageText", wantsMessage ? message : "");

      if (summary) {
        summary.textContent = wantsMessage ? "Gift Message Added" : "No Gift Message";
      }

      closeGiftMessageModal();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeGiftMessageModal();
    }
  });

  loadSavedGiftMessage();


  /* ---------------------------------------------
     4. Add-on Toggle Products
  --------------------------------------------- */

  var addonSyncTimer = null;

  function findAddonItem(productKeyword) {
    var items = document.querySelectorAll(
      ".cart-addon-hidden .w-dyn-item, .cart-addon-hidden [role='listitem']"
    );

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var nameEl = item.querySelector(".addon-product-name");
      var nameText = normalizeText(nameEl ? nameEl.textContent : item.textContent);

      if (nameText.indexOf(productKeyword) !== -1) {
        return item;
      }
    }

    return null;
  }

  function findRealAddonSubmitButton(productKeyword) {
    var item = findAddonItem(productKeyword);
    if (!item) return null;

    var form =
      item.querySelector(".w-commerce-commerceaddtocartform") ||
      item.querySelector("form") ||
      item;

    return (
      form.querySelector("input[type='submit']") ||
      form.querySelector("button[type='submit']") ||
      form.querySelector(".w-commerce-commerceaddtocartbutton") ||
      form.querySelector("[data-node-type='commerce-add-to-cart-button']") ||
      form.querySelector(".addon-product-button input[type='submit']") ||
      form.querySelector(".addon-product-button button") ||
      form.querySelector(".addon-product-button")
    );
  }

  function cartItemMatches(item, productKeyword) {
    var text = normalizeText(item ? item.textContent : "");
    return text.indexOf(productKeyword) !== -1;
  }

  function findCartItem(productKeyword) {
    var items = getCartItems();

    for (var i = 0; i < items.length; i++) {
      if (cartItemMatches(items[i], productKeyword)) {
        return items[i];
      }
    }

    return null;
  }

  function cartAlreadyHas(productKeyword) {
    return !!findCartItem(productKeyword);
  }

  function removeAddonFromCart(productKeyword) {
    var item = findCartItem(productKeyword);
    if (!item) return false;

    var removeBtn =
      item.querySelector(".w-commerce-commercecartremovebutton") ||
      item.querySelector("[data-node-type='commerce-cart-remove-link']") ||
      item.querySelector("a");

    if (!removeBtn) return false;

    removeBtn.click();
    updateCartActivity();
    scheduleSubtotalUpdate();
    scheduleAddonSync();
    scheduleSubscriptionCartSync();

    return true;
  }

  function getAddonRowFromToggle(toggle) {
    return toggle ? toggle.closest(".cart-addon-item") : null;
  }

  function updateToggleText(toggle, text) {
    if (!toggle) return;

    var innerText = toggle.querySelector("div, span, p, a");
    if (innerText) {
      innerText.textContent = text;
    } else {
      toggle.textContent = text;
    }
  }

  function updateAddonRow(toggleSelector, isSelected, selectedText, emptyText) {
    var toggle = document.querySelector(toggleSelector);
    if (!toggle) return;

    var row = getAddonRowFromToggle(toggle);
    var subtitle = row ? row.querySelector(".cart-addon-subtitle") : null;

    toggle.classList.toggle("is-selected", isSelected);
    updateToggleText(toggle, isSelected ? "✓ Added" : "+ Add");

    if (subtitle) {
      subtitle.textContent = isSelected ? selectedText : emptyText;
    }
  }

  function syncAddonUI() {
    var hasWooden = cartAlreadyHas("wooden");
    var hasBojagi = cartAlreadyHas("bojagi");

    updateAddonRow(
      ".addon-toggle-wooden-box",
      hasWooden,
      "Wooden Gift Box Added",
      "No Wooden Gift Box"
    );

    updateAddonRow(
      ".addon-toggle-bojagi",
      hasBojagi,
      "Bojagi Gift Wrapping Added",
      "No Bojagi Gift Wrapping"
    );
  }

  function scheduleAddonSync() {
    clearTimeout(addonSyncTimer);

    addonSyncTimer = setTimeout(function () {
      syncAddonUI();
    }, 180);
  }

  function addAddon(productKeyword) {
    var button = findRealAddonSubmitButton(productKeyword);

    if (!button) {
      alert("Add-on button not found. Check hidden Product Collection List, Product Name, and Add to Cart button.");
      return;
    }

    button.click();

    updateCartActivity();
    scheduleSubtotalUpdate();
    scheduleAddonSync();
    scheduleSubscriptionCartSync();

    setTimeout(function () {
      scheduleSubtotalUpdate();
      scheduleAddonSync();
      scheduleSubscriptionCartSync();
    }, 800);
  }

  function toggleAddon(productKeyword) {
    if (cartAlreadyHas(productKeyword)) {
      removeAddonFromCart(productKeyword);
    } else {
      addAddon(productKeyword);
    }
  }

  document.addEventListener("click", function (event) {
    var woodenToggle = event.target.closest(".addon-toggle-wooden-box");
    var bojagiToggle = event.target.closest(".addon-toggle-bojagi");

    if (woodenToggle) {
      event.preventDefault();
      toggleAddon("wooden");
    }

    if (bojagiToggle) {
      event.preventDefault();
      toggleAddon("bojagi");
    }
  });

  syncAddonUI();


  /* ---------------------------------------------
     5. Subscription Cart Mode
  --------------------------------------------- */

  var subscriptionSyncTimer = null;
  var subscriptionRemoveRedirectStarted = false;

  var SUBSCRIPTION_IN_CART_STORAGE = "hyunCuratedCollectionInCart";
  var SUBSCRIPTION_KEY_STORAGE = "hyunSubscriptionCartKey";
  var CURATED_KEYS_STORAGE = "hyunCuratedCollectionKeys";

  function isSubscriptionItem(item) {
    var text = normalizeText(item ? item.textContent : "");

    return (
      item && item.classList && item.classList.contains("is-subscription-cart-item") ||
      text.indexOf("curated collection") !== -1 ||
      text.indexOf("subscription") !== -1 ||
      text.indexOf("gourmet collection") !== -1 ||
      text.indexOf("house party collection") !== -1 ||
      text.indexOf("delivery only") !== -1 ||
      text.indexOf("delivery + hyun dining") !== -1
    );
  }

  function getSubscriptionItems() {
    return getCartItems().filter(function (item) {
      return isSubscriptionItem(item);
    });
  }

  function hasSubscriptionInCart() {
    return getSubscriptionItems().length > 0;
  }

  function getSubscriptionSubtotal() {
    var subtotal = 0;

    getSubscriptionItems().forEach(function (item) {
      subtotal += getItemUnitPrice(item) * getQuantityFromItem(item);
    });

    return subtotal;
  }

  function markSubscriptionItems() {
    getCartItems().forEach(function (item) {
      if (isSubscriptionItem(item)) {
        item.classList.add("is-subscription-cart-item");
      } else {
        item.classList.remove("is-subscription-cart-item");
      }
    });
  }

  function makeSubscriptionKeyFromText(text) {
    var normalized = normalizeText(text);

    var frequency = "";
    var occasion = "";
    var experience = "";

    if (normalized.indexOf("twice a month") !== -1) {
      frequency = "Twice a Month";
    } else if (normalized.indexOf("monthly") !== -1) {
      frequency = "Monthly";
    }

    if (normalized.indexOf("house party collection") !== -1) {
      occasion = "House Party Collection";
    } else if (normalized.indexOf("gourmet collection") !== -1) {
      occasion = "Gourmet Collection";
    }

    if (normalized.indexOf("delivery + hyun dining") !== -1) {
      experience = "Delivery + HYUN Dining";
    } else if (normalized.indexOf("delivery only") !== -1) {
      experience = "Delivery Only";
    }

    if (!frequency || !occasion || !experience) return "";

    return [frequency, occasion, experience]
      .map(function (part) {
        return normalizeText(part);
      })
      .join(" | ");
  }

  function clearSubscriptionStorage(clearAnswers) {
    localStorage.removeItem(SUBSCRIPTION_IN_CART_STORAGE);
    localStorage.removeItem(SUBSCRIPTION_KEY_STORAGE);
    localStorage.removeItem(CURATED_KEYS_STORAGE);
    localStorage.removeItem("hyunSubscriptionCartMode");

    if (clearAnswers !== false) {
      sessionStorage.removeItem("hyunSubscriptionBuilderAnswers");
      sessionStorage.removeItem("hyunCuratedCollectionAnswers");
    }
  }

  function syncSubscriptionStorageFromCart() {
    var subscriptionItems = getSubscriptionItems();

    if (subscriptionItems.length) {
      var key = makeSubscriptionKeyFromText(subscriptionItems[0].textContent || "");

      localStorage.setItem(SUBSCRIPTION_IN_CART_STORAGE, "true");

      if (key) {
        localStorage.setItem(SUBSCRIPTION_KEY_STORAGE, key);
        localStorage.setItem(CURATED_KEYS_STORAGE, JSON.stringify([key]));
      }
    } else {
      clearSubscriptionStorage(false);
    }
  }

  function updateSubscriptionPanel() {
    var hasSubscription = hasSubscriptionInCart();

    document.body.classList.toggle("hyun-subscription-cart", hasSubscription);

    var valueEl = document.querySelector(".cart-subscription-subtotal-value");
    if (valueEl) {
      valueEl.textContent = formatMoney(getSubscriptionSubtotal());
    }

    syncSubscriptionStorageFromCart();
  }

  function syncSubscriptionCartUI() {
    markSubscriptionItems();
    updateSubscriptionPanel();
  }

  function scheduleSubscriptionCartSync() {
    clearTimeout(subscriptionSyncTimer);

    subscriptionSyncTimer = setTimeout(function () {
      syncSubscriptionCartUI();
    }, 180);
  }

  function clickRemoveButton(button) {
    if (!button) return;

    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }

  function removeSubscriptionItemsOnly(callback) {
    var items = getSubscriptionItems();

    items.forEach(function (item) {
      var removeBtn =
        item.querySelector(".w-commerce-commercecartremovebutton") ||
        item.querySelector("[data-node-type='commerce-cart-remove-link']");

      if (removeBtn) {
        clickRemoveButton(removeBtn);
      }
    });

    clearSubscriptionStorage(true);

    setTimeout(function () {
      syncSubscriptionCartUI();

      if (typeof callback === "function") {
        callback();
      }
    }, 350);
  }

  /*
    Subscription panel button:
    - Continue to Checkout: force Delivery and go to /checkout.
    - Edit Subscription: remove subscription items only, then go to builder.
  */
  document.addEventListener("click", function (event) {
    var subscriptionButton = event.target.closest(".cart-edit-subscription-button");

    if (!subscriptionButton) return;

    event.preventDefault();
    event.stopPropagation();

    var buttonText = normalizeText(subscriptionButton.textContent);

    if (buttonText.indexOf("continue") !== -1 || buttonText.indexOf("checkout") !== -1) {
      sessionStorage.setItem("hyunOrderMethod", "delivery");
      localStorage.setItem("hyunOrderMethod", "delivery");
      localStorage.removeItem("hyunSubscriptionCartMode");

      window.location.href = "/checkout";
      return;
    }

    clearSubscriptionStorage(true);

    removeSubscriptionItemsOnly(function () {
      window.location.href = "/subscription-builder";
    });
  });

  /*
    Remove behavior:
    - Popup cart on other pages: default Webflow remove only.
    - General product remove: default Webflow remove only.
    - /cart page + subscription remove: allow Webflow remove, then redirect to builder.
  */
  document.addEventListener("click", function (event) {
    var removeBtn = event.target.closest(
      ".w-commerce-commercecartremovebutton, [data-node-type='commerce-cart-remove-link'], a, button"
    );

    if (!removeBtn) return;

    var removeText = normalizeText(removeBtn.textContent);
    if (removeText.indexOf("remove") === -1) return;

    var isCartPage =
      window.location.pathname === "/cart" ||
      window.location.pathname.indexOf("/cart") === 0;

    if (!isCartPage) return;

    var cartItem = removeBtn.closest(".w-commerce-commercecartitem");
    if (!cartItem) return;

    var isSubscription = isSubscriptionItem(cartItem);

    if (!isSubscription) {
      setTimeout(function () {
        updateCustomSubtotal();
        syncAddonUI();
        syncSubscriptionCartUI();
      }, 350);

      return;
    }

    if (subscriptionRemoveRedirectStarted) return;
    subscriptionRemoveRedirectStarted = true;

    clearSubscriptionStorage(true);

    setTimeout(function () {
      window.location.href = "/subscription-builder";
    }, 300);
  }, true);

  syncSubscriptionCartUI();


  /* ---------------------------------------------
     6. Observers / Updates
  --------------------------------------------- */

  var observerTarget =
    document.querySelector(".cart-page .w-commerce-commercecartwrapper") ||
    document.querySelector(".cart-page") ||
    document.body;

  var observer = new MutationObserver(function () {
    scheduleSubtotalUpdate();
    scheduleAddonSync();
    scheduleSubscriptionCartSync();
  });

  observer.observe(observerTarget, {
    childList: true,
    subtree: true,
    characterData: true
  });

  document.addEventListener("change", function () {
    scheduleSubtotalUpdate();
    scheduleAddonSync();
    scheduleSubscriptionCartSync();
  });
});