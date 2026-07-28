/* VicThree Defence — master landing site
   Vanilla JS: mobile nav toggle, sticky-header shadow, year stamp. */
(function () {
  'use strict';

  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');

  // --- mobile hamburger ---
  function setOpen(open) {
    if (!nav) return;
    nav.classList.toggle('open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });
  }
  // close the menu after tapping a link (mobile)
  if (links) {
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
  }
  // close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  // --- sticky header shadow on scroll ---
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- footer year ---
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
