/**
 * Florida MMJ Landing — page interactions + dataLayer pushes.
 *
 * Pushes are intentionally PII-free at the landing page layer.
 * Patient identifiers (booking_id, etc.) are emitted ONLY from the
 * server-rendered thank-you page — see Task 2 GA4 spec.
 */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];

  // ----- FAQ accordion (single-open, ARIA-correct) -----
  var faqButtons = document.querySelectorAll('.vh-fl-lp .faq-q');
  faqButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var isOpen = btn.getAttribute('aria-expanded') === 'true';
      faqButtons.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) {
        window.dataLayer.push({
          event: 'faq_open',
          faq_question: btn.querySelector('span') ? btn.querySelector('span').innerText : ''
        });
      }
    });
  });

  // ----- CTA click tracking -----
  document.querySelectorAll('.vh-fl-lp [data-cta], .vh-mob-cta [data-cta]').forEach(function (el) {
    el.addEventListener('click', function () {
      window.dataLayer.push({
        event: 'cta_click',
        cta_id: el.dataset.cta,
        cta_text: (el.innerText || '').trim(),
        cta_destination: el.getAttribute('href') || ''
      });
    });
  });

  // ----- Scroll depth (25/50/75/100) — fires once each, rAF-throttled -----
  (function () {
    var fired = {};
    var thresholds = [25, 50, 75, 100];
    var raf;
    function check() {
      var doc = document.documentElement;
      var scrolled = (doc.scrollTop + window.innerHeight) / doc.scrollHeight * 100;
      thresholds.forEach(function (t) {
        if (scrolled >= t && !fired[t]) {
          fired[t] = true;
          window.dataLayer.push({ event: 'scroll_depth', scroll_pct: t });
        }
      });
    }
    window.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    }, { passive: true });
  })();
})();
