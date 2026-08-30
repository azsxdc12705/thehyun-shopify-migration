// pages: /checkout
document.addEventListener("DOMContentLoaded", function () {
  const pickupWrap = document.querySelector(".info_store_wrap");
  if (!pickupWrap) return;

  const labels = pickupWrap.querySelectorAll(".auth_label");

  labels.forEach(function (label) {
    const labelText = label.textContent.trim().toLowerCase();

    let field = label.nextElementSibling;

    while (field && !field.classList.contains("auth-field")) {
      field = field.nextElementSibling;
    }

    if (!field) return;

    if (labelText.includes("name")) {
      field.setAttribute("placeholder", "THE HYUN");
    } else if (labelText.includes("phone") || labelText.includes("contact")) {
      field.setAttribute("placeholder", "(555) 555-0100");
    } else if (labelText.includes("date") || labelText.includes("time")) {
      field.setAttribute("placeholder", "May 31, 3:00 PM–5:00 PM");
    }
  });
});