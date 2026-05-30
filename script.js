/**
 * Green Ledger AI — Landing Page Scripts
 */

(function () {
  'use strict';

  // ---- Sticky header on scroll ----
  const header = document.getElementById('header');

  function handleScroll() {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ---- Mobile navigation toggle ----
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', function () {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('active', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close mobile nav when a link is clicked
  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ---- Waitlist form (Formspree) ----
  const waitlistForm = document.getElementById('waitlistForm');
  const FORMSPREE_ENDPOINT = waitlistForm.getAttribute('action');
  const formSuccess = document.getElementById('formSuccess');
  const formError = document.getElementById('formError');
  const submitBtn = document.getElementById('waitlistSubmit');
  const emailInput = document.getElementById('email');
  const companyInput = document.getElementById('company');

  const submitBtnDefaultText = submitBtn.textContent;

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showError(input) {
    input.classList.add('error');
    input.focus();
  }

  function clearErrors() {
    emailInput.classList.remove('error');
    companyInput.classList.remove('error');
    formError.hidden = true;
  }

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'Joining…' : submitBtnDefaultText;
  }

  waitlistForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    const email = emailInput.value.trim();
    const company = companyInput.value.trim();

    if (!email || !isValidEmail(email)) {
      showError(emailInput);
      return;
    }

    if (!company) {
      showError(companyInput);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email,
          company: company,
          _subject: 'Green Ledger AI — New waitlist signup',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        waitlistForm.hidden = true;
        formSuccess.hidden = false;
        return;
      }

      throw new Error(data.error || 'Submission failed');
    } catch (err) {
      formError.hidden = false;
      setSubmitting(false);
    }
  });

  // Clear error styling on input
  [emailInput, companyInput].forEach(function (input) {
    input.addEventListener('input', function () {
      input.classList.remove('error');
    });
  });

  // ---- Fade-in animation on scroll ----
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  const fadeElements = document.querySelectorAll(
    '.feature-card, .benefits-list li, .testimonial-card, .waitlist-card'
  );

  fadeElements.forEach(function (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  const fadeObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        fadeObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  fadeElements.forEach(function (el, index) {
    el.style.transitionDelay = (index % 3) * 0.1 + 's';
    fadeObserver.observe(el);
  });
})();
