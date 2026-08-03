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

  // --- gallery marquee: auto-scroll + manual drag/swipe ---
  var marquee = document.querySelector('.marquee');
  var track = marquee && marquee.querySelector('.marquee-track');
  if (marquee && track) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var half = 0;
    function measure() { half = track.scrollWidth / 2; }
    measure();
    window.addEventListener('load', measure);
    window.addEventListener('resize', measure);
    // re-measure as images finish loading (layout can shift)
    Array.prototype.forEach.call(track.querySelectorAll('img'), function (im) {
      if (!im.complete) im.addEventListener('load', measure, { once: true });
    });

    // keep the scroll position inside one set so the loop is seamless
    function wrapHigh() { if (half > 0 && marquee.scrollLeft >= half) marquee.scrollLeft -= half; }

    var paused = false, resumeTimer = null, last = null;
    function pause() { paused = true; if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; } }
    function resumeSoon() {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () { paused = false; last = null; }, 1400);
    }

    // auto-scroll: cover one full set in ~100s, matching the old marquee pace
    function step(ts) {
      if (last == null) last = ts;
      var dt = (ts - last) / 1000; last = ts;
      if (dt > 0.1) dt = 0.016; // tab was backgrounded — avoid a big jump
      if (!paused && half > 0) {
        marquee.scrollLeft += (half / 100) * dt;
        wrapHigh();
      }
      requestAnimationFrame(step);
    }
    if (!reduce) requestAnimationFrame(step);

    // pause while the user interacts, resume a moment after
    marquee.addEventListener('wheel', function () { pause(); resumeSoon(); }, { passive: true });
    marquee.addEventListener('touchstart', pause, { passive: true });
    marquee.addEventListener('touchend', resumeSoon, { passive: true });
    marquee.addEventListener('scroll', wrapHigh, { passive: true });

    // mouse drag-to-scroll (touch is handled by native scrolling)
    var down = false, startX = 0, startLeft = 0;
    marquee.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      down = true; startX = e.clientX; startLeft = marquee.scrollLeft; pause();
      marquee.classList.add('dragging');
      try { marquee.setPointerCapture(e.pointerId); } catch (_) {}
    });
    marquee.addEventListener('pointermove', function (e) {
      if (!down) return;
      var target = startLeft - (e.clientX - startX);
      if (half > 0) { // wrap both directions so drag feels endless
        if (target < 0) { target += half; startLeft += half; }
        else if (target >= half) { target -= half; startLeft -= half; }
      }
      marquee.scrollLeft = target;
    });
    function endDrag() { if (!down) return; down = false; marquee.classList.remove('dragging'); resumeSoon(); }
    marquee.addEventListener('pointerup', endDrag);
    marquee.addEventListener('pointercancel', endDrag);
  }

  // --- comparison table: one-time nudge so people notice it scrolls right ---
  var ctable = document.querySelector('.ctable-wrap');
  if (ctable && 'IntersectionObserver' in window) {
    var nudged = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || nudged) return;
        if (ctable.scrollWidth <= ctable.clientWidth + 10) return; // nothing hidden
        nudged = true;
        io.disconnect();
        try {
          ctable.scrollTo({ left: 72, behavior: 'smooth' });
          setTimeout(function () { ctable.scrollTo({ left: 0, behavior: 'smooth' }); }, 700);
        } catch (_) {
          ctable.scrollLeft = 72;
          setTimeout(function () { ctable.scrollLeft = 0; }, 700);
        }
      });
    }, { threshold: 0.45 });
    io.observe(ctable);
  }
})();
