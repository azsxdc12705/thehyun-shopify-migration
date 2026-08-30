// pages: /product/the-hyuns-special-cuts, /product/prime-bbq-collection, /product/babys-first-bites, /product/innards-selection, /product/brisket ...
document.addEventListener("DOMContentLoaded", function () {
  const price = document.querySelector(".product-price");
  const select = document.querySelector(".option-select-field");

  if (!price || !select) return;

  function updatePriceVisibility() {
    const selectedText = select.options[select.selectedIndex].text.trim().toLowerCase();

    if (
      selectedText === "select weight" ||
      selectedText === "" ||
      select.selectedIndex === 0
    ) {
      price.style.display = "none";
    } else {
      price.style.display = "block";
    }
  }

  updatePriceVisibility();
  select.addEventListener("change", updatePriceVisibility);
});