// pages: /checkout
document.addEventListener("DOMContentLoaded", function () {
  function setGiftMessageFields() {
    var enabled = localStorage.getItem("hyunGiftMessageEnabled") || "no";
    var message = localStorage.getItem("hyunGiftMessageText") || "";

    var enabledInput = document.getElementById("hyun-gift-message-enabled");
    var messageInput = document.getElementById("hyun-gift-message-text");

    if (enabledInput) {
      enabledInput.value = enabled;
      enabledInput.dispatchEvent(new Event("input", { bubbles: true }));
      enabledInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (messageInput) {
      messageInput.value = enabled === "yes" ? message : "";
      messageInput.dispatchEvent(new Event("input", { bubbles: true }));
      messageInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  setGiftMessageFields();

  setTimeout(setGiftMessageFields, 300);
  setTimeout(setGiftMessageFields, 1000);
});