// pages: /subscription-builder
document.addEventListener('DOMContentLoaded', function () {
  const answers = {
    frequency: '',
    'collection-size': '',
    experience: '',
    'cooking-style': [],
    'preferred-cuts': [],
    avoid: []
  };

  const steps = Array.from(document.querySelectorAll('.curated-step'));
  const review = document.querySelector('.curated-review');

  const customAddButton = Array.from(document.querySelectorAll('.curated-add-to-cart')).find(function (btn) {
    return !btn.closest('.curated-webflow-add-to-cart-wrap');
  });

  const SUBSCRIPTION_KEY_STORAGE = 'hyunSubscriptionCartKey';
  const SUBSCRIPTION_IN_CART_STORAGE = 'hyunCuratedCollectionInCart';
  const SUBSCRIPTION_ANSWERS_STORAGE = 'hyunSubscriptionBuilderAnswers';

  const MULTI_LIMITS = {
    'cooking-style': 4,
    'preferred-cuts': 2,
    avoid: 1
  };

  function normalizeFrequency(value) {
    if (value === 'Every Month') return 'Monthly';
    if (value === 'Every Two Weeks') return 'Twice a Month';
    return value;
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function getJoinedAnswer(question) {
    return Array.isArray(answers[question]) ? answers[question].join(', ') : '';
  }

  function getCurrentSubscriptionKey() {
    return [
      normalizeFrequency(answers.frequency),
      answers['collection-size'],
      answers.experience
    ].map(normalizeText).join(' | ');
  }

  function subscriptionAlreadyInCart() {
    return localStorage.getItem(SUBSCRIPTION_IN_CART_STORAGE) === 'true';
  }

  function saveSubscriptionInCart(key) {
    localStorage.setItem(SUBSCRIPTION_IN_CART_STORAGE, 'true');
    localStorage.setItem(SUBSCRIPTION_KEY_STORAGE, key);
    localStorage.setItem('hyunCuratedCollectionKeys', JSON.stringify([key]));
  }

  function saveAnswers() {
    sessionStorage.setItem(SUBSCRIPTION_ANSWERS_STORAGE, JSON.stringify(answers));
    sessionStorage.setItem('hyunCuratedCollectionAnswers', JSON.stringify(answers));
  }

  function isComplete() {
    return (
      answers.frequency &&
      answers['collection-size'] &&
      answers.experience &&
      answers['cooking-style'].length > 0 &&
      answers['preferred-cuts'].length > 0 &&
      answers.avoid.length > 0
    );
  }

  function showNextStep(currentStep) {
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];

    if (nextStep) {
      nextStep.classList.add('is-active');
    }

    if (isComplete() && review) {
      review.classList.add('is-active');
    }
  }

  function selectWebflowOption(selectEl, targetValue) {
    if (!selectEl || !targetValue) return false;

    const target = normalizeText(targetValue);
    const options = Array.from(selectEl.options);

    const match = options.find(function (option) {
      return normalizeText(option.text) === target || normalizeText(option.value) === target;
    });

    if (!match) {
      console.warn('No matching option found:', targetValue, selectEl);
      return false;
    }

    selectEl.selectedIndex = options.indexOf(match);
    selectEl.value = match.value;
    match.selected = true;

    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  }

  function syncHiddenWebflowAddToCart() {
    const hiddenWrap = document.querySelector('.curated-webflow-add-to-cart-wrap');

    if (!hiddenWrap) return false;

    const selects = Array.from(hiddenWrap.querySelectorAll('select'));

    if (selects.length < 3) {
      console.warn('Not enough select fields found.', selects);
      return false;
    }

    const frequencySynced = selectWebflowOption(selects[0], normalizeFrequency(answers.frequency));
    const collectionSizeSynced = selectWebflowOption(selects[1], answers['collection-size']);
    const experienceSynced = selectWebflowOption(selects[2], answers.experience);

    return frequencySynced && collectionSizeSynced && experienceSynced;
  }

  function submitWebflowAddToCart() {
    const hiddenWrap = document.querySelector('.curated-webflow-add-to-cart-wrap');

    if (!hiddenWrap) {
      alert('Hidden Add to Cart wrapper was not found.');
      return;
    }

    const webflowAddButton = hiddenWrap.querySelector(
      '.w-commerce-commerceaddtocartbutton, input[type="submit"], button[type="submit"]'
    );

    if (!webflowAddButton) {
      alert('Add to Cart button was not found.');
      return;
    }

    setTimeout(function () {
      webflowAddButton.click();
    }, 400);
  }

  function fillField(selector, value) {
    const field = document.querySelector(selector);
    if (!field) return;

    field.value = value || '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function submitCuratedPreferenceForm() {
    const formWrap = document.querySelector('.curated-preferences-form-wrap');
    if (!formWrap) return;

    const form = formWrap.querySelector('form');
    const submitButton =
      formWrap.querySelector('.curated-pref-submit') ||
      formWrap.querySelector('input[type="submit"]') ||
      formWrap.querySelector('button[type="submit"]');

    if (!form || !submitButton) return;

    const frequency = normalizeFrequency(answers.frequency);
    const collectionSize = answers['collection-size'];
    const experience = answers.experience;
    const cookingStyle = getJoinedAnswer('cooking-style');
    const preferredCuts = getJoinedAnswer('preferred-cuts');
    const avoidCuts = getJoinedAnswer('avoid');

    const summaryText =
      'Frequency: ' + frequency + '\n' +
      'Collection Size: ' + collectionSize + '\n' +
      'Experience: ' + experience + '\n' +
      'Preferred Style: ' + cookingStyle + '\n' +
      'Preferred Cuts: ' + preferredCuts + '\n' +
      'Avoid: ' + avoidCuts;

    const variantText = frequency + ' / ' + collectionSize + ' / ' + experience;

    fillField('.curated_preferences, .curated-pref-summary', summaryText);
    fillField('.cooking_style, .curated-pref-cooking', cookingStyle);
    fillField('.selected_variant, .curated-pref-variant', variantText);
    fillField('.preferred_cuts', preferredCuts);
    fillField('.avoid_cuts', avoidCuts);
    fillField('.submitted_at, .curated-pref-time', new Date().toLocaleString());

    setTimeout(function () {
      submitButton.click();
    }, 100);
  }

  function resetBuilderSelectionUI() {
    answers.frequency = '';
    answers['collection-size'] = '';
    answers.experience = '';
    answers['cooking-style'] = [];
    answers['preferred-cuts'] = [];
    answers.avoid = [];

    document.querySelectorAll('.curated-option-card').forEach(function (card) {
      card.classList.remove('is-selected');
    });

    steps.forEach(function (step, index) {
      if (index === 0) {
        step.classList.add('is-active');
      } else {
        step.classList.remove('is-active');
      }
    });

    if (review) {
      review.classList.remove('is-active');
    }

    sessionStorage.removeItem(SUBSCRIPTION_ANSWERS_STORAGE);
    sessionStorage.removeItem('hyunCuratedCollectionAnswers');
  }

  function showLimitAlert(question) {
    if (question === 'cooking-style') {
      alert('Please select up to 4 styles.');
    } else if (question === 'preferred-cuts') {
      alert('Please select up to 2 preferred cuts.');
    } else if (question === 'avoid') {
      alert('Please select one item to avoid.');
    }
  }

  function handleMultiSelect(card, question, value) {
    const selected = answers[question];
    const alreadySelected = selected.includes(value);
    const limit = MULTI_LIMITS[question];

    if (question === 'avoid') {
      if (alreadySelected) {
        answers[question] = [];
        card.classList.remove('is-selected');
        return;
      }

      answers[question] = [value];

      document.querySelectorAll('.curated-option-card[data-question="avoid"]').forEach(function (sibling) {
        sibling.classList.remove('is-selected');
      });

      card.classList.add('is-selected');
      return;
    }

    if (alreadySelected) {
      answers[question] = answers[question].filter(function (item) {
        return item !== value;
      });

      card.classList.remove('is-selected');
      return;
    }

    if (answers[question].length >= limit) {
      showLimitAlert(question);
      return;
    }

    answers[question].push(value);
    card.classList.add('is-selected');
  }

  document.querySelectorAll('.curated-option-card').forEach(function (card) {
    card.addEventListener('click', function () {
      const question = card.getAttribute('data-question');
      const value = card.getAttribute('data-value');
      const currentStep = card.closest('.curated-step');

      if (!question || !value || !currentStep) return;

      if (MULTI_LIMITS[question]) {
        handleMultiSelect(card, question, value);
      } else {
        answers[question] = value;

        currentStep.querySelectorAll('.curated-option-card').forEach(function (sibling) {
          sibling.classList.remove('is-selected');
        });

        card.classList.add('is-selected');
      }

      saveAnswers();
      showNextStep(currentStep);
    });
  });

  if (customAddButton) {
    customAddButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (!answers.frequency) {
        alert('Please select your frequency.');
        return;
      }

      if (!answers['collection-size']) {
        alert('Please select your collection size.');
        return;
      }

      if (!answers.experience) {
        alert('Please select your experience.');
        return;
      }

      if (!answers['cooking-style'].length) {
        alert('Please select at least one preferred style.');
        return;
      }

      if (!answers['preferred-cuts'].length) {
        alert('Please select at least one preferred cut.');
        return;
      }

      if (!answers.avoid.length) {
        alert('Please select one avoid preference, or select No Avoidance.');
        return;
      }

      if (subscriptionAlreadyInCart()) {
        alert('You already have a subscription in your collection. To create a new one, please remove the existing subscription from your cart first.');
        window.location.href = '/cart';
        return;
      }

      saveAnswers();

      const synced = syncHiddenWebflowAddToCart();

      if (!synced) {
        alert('Cart connection is not ready yet. Please check the hidden Webflow Add to Cart component.');
        return;
      }

      const currentKey = getCurrentSubscriptionKey();
      saveSubscriptionInCart(currentKey);

      submitCuratedPreferenceForm();

      sessionStorage.setItem('hyunOrderMethod', 'delivery');
      localStorage.setItem('hyunOrderMethod', 'delivery');

      document.body.classList.add('hyun-suppress-cart-popup');

      setTimeout(function () {
        submitWebflowAddToCart();
      }, 500);

      setTimeout(function () {
        window.location.href = '/checkout';
      }, 1800);
    });
  }

  window.addEventListener('pageshow', function () {
    resetBuilderSelectionUI();
  });
});