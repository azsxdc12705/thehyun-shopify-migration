// pages: /checkout
window.initHyunCustomAddressAutocomplete = async function () {
  console.log("HYUN custom address autocomplete init");

  const {
    AutocompleteSessionToken,
    AutocompleteSuggestion
  } = await google.maps.importLibrary("places");

  const streetInput = document.querySelector(".google-address-field");
  const cityInput = document.getElementById("wf-ecom-shipping-city");
  const stateInput = document.getElementById("wf-ecom-shipping-state");
  const zipInput = document.getElementById("wf-ecom-shipping-zip");

  if (!streetInput) {
    console.log("HYUN custom autocomplete: .google-address-field not found");
    return;
  }

  let sessionToken = new AutocompleteSessionToken();
  let debounceTimer = null;
  let activeSuggestions = [];

  const wrapper = document.createElement("div");
  wrapper.className = "hyun-address-wrap";

  streetInput.parentNode.insertBefore(wrapper, streetInput);
  wrapper.appendChild(streetInput);

  const dropdown = document.createElement("div");
  dropdown.className = "hyun-address-dropdown";
  wrapper.appendChild(dropdown);

  function showDropdown() {
    dropdown.style.display = "block";
  }

  function hideDropdown() {
    dropdown.style.display = "none";
  }

  function clearDropdown() {
    dropdown.innerHTML = "";
    activeSuggestions = [];
    hideDropdown();
  }

  function triggerInputEvents(input) {
    if (!input) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getComponent(components, type, useShortName) {
    const component = components.find(function (c) {
      return c.types.includes(type);
    });

    if (!component) return "";
    return useShortName ? component.shortText : component.longText;
  }

  function getPredictionText(prediction) {
    if (!prediction) return "";

    if (prediction.text && typeof prediction.text.toString === "function") {
      return prediction.text.toString();
    }

    return prediction.text || prediction.place || "";
  }

  async function fetchSuggestions(value) {
    const inputValue = value.trim();

    if (inputValue.length < 3) {
      clearDropdown();
      return;
    }

    try {
      const request = {
        input: inputValue,
        sessionToken: sessionToken,
        includedRegionCodes: ["us"],
        includedPrimaryTypes: ["street_address"],
        language: "en-US",
        region: "us"
      };

      const response =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      const suggestions = response.suggestions || [];

      activeSuggestions = suggestions.filter(function (s) {
        return s.placePrediction;
      });

      dropdown.innerHTML = "";

      if (!activeSuggestions.length) {
        hideDropdown();
        return;
      }

      activeSuggestions.forEach(function (suggestion) {
        const prediction = suggestion.placePrediction;
        const option = document.createElement("div");

        option.className = "hyun-address-option";
        option.textContent = getPredictionText(prediction);

        option.addEventListener("mousedown", function (event) {
          event.preventDefault();
          selectSuggestion(suggestion);
        });

        dropdown.appendChild(option);
      });

      showDropdown();
    } catch (error) {
      console.error("HYUN address autocomplete error:", error);
      clearDropdown();
    }
  }

  async function selectSuggestion(suggestion) {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;

    try {
      const place = prediction.toPlace();

      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress"]
      });

      const components = place.addressComponents || [];

      const streetNumber = getComponent(components, "street_number");
      const route = getComponent(components, "route", true);

      const city =
        getComponent(components, "locality") ||
        getComponent(components, "sublocality_level_1") ||
        getComponent(components, "neighborhood");

      const state = getComponent(components, "administrative_area_level_1", true);
      const zip = getComponent(components, "postal_code");

      const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

      streetInput.value = streetAddress || place.formattedAddress || "";

      if (cityInput && city) cityInput.value = city;
      if (stateInput && state) stateInput.value = state;
      if (zipInput && zip) zipInput.value = zip;

      triggerInputEvents(streetInput);
      triggerInputEvents(cityInput);
      triggerInputEvents(stateInput);
      triggerInputEvents(zipInput);

      clearDropdown();

      sessionToken = new AutocompleteSessionToken();
    } catch (error) {
      console.error("HYUN address selection error:", error);
    }
  }

  streetInput.addEventListener("input", function () {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(function () {
      fetchSuggestions(streetInput.value);
    }, 250);
  });

  streetInput.addEventListener("focus", function () {
    if (activeSuggestions.length) showDropdown();
  });

  document.addEventListener("click", function (event) {
    if (!wrapper.contains(event.target)) {
      hideDropdown();
    }
  });

  console.log("HYUN custom address autocomplete ready");
};