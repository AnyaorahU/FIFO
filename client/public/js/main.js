(function () {
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---- Mega menus (click for touch/keyboard, CSS handles hover) ----
  $$('[data-mega]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var li = btn.parentElement;
      var open = !li.classList.contains('open');
      $$('.has-mega.open').forEach(function (o) { o.classList.remove('open'); o.querySelector('[data-mega]').setAttribute('aria-expanded', 'false'); });
      if (open) { li.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-mega')) $$('.has-mega.open').forEach(function (o) { o.classList.remove('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $$('.has-mega.open').forEach(function (o) { o.classList.remove('open'); });
  });

  // ---- Admin sidebar (mobile) ----
  $$('[data-nav-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var nav = $('[data-nav]');
      if (nav) btn.setAttribute('aria-expanded', String(nav.classList.toggle('open')));
    });
  });
  document.addEventListener('click', function (e) {
    var nav = $('.admin-side.open');
    if (nav && !nav.contains(e.target)) nav.classList.remove('open');
  });

  // ---- Mobile menu ----
  var mobile = $('[data-mobile-menu]');
  $$('[data-menu-toggle]').forEach(function (b) {
    b.addEventListener('click', function () { if (mobile) { mobile.hidden = false; document.body.style.overflow = 'hidden'; } });
  });
  $$('[data-menu-close]').forEach(function (b) {
    b.addEventListener('click', function () { mobile.hidden = true; document.body.style.overflow = ''; });
  });

  // ---- Rails (horizontal carousels) ----
  $$('[data-rail]').forEach(function (rail) {
    var track = $('.rail-track', rail);
    var prev = $('[data-rail-prev]', rail), next = $('[data-rail-next]', rail);
    function step() { var c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 36 : 300; }
    function update() {
      if (prev) prev.disabled = track.scrollLeft < 8;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // ---- Opportunities: category chips filter the job cards ----
  var opp = $('[data-opportunities]');
  if (opp) {
    var chips = $('[data-chips]', opp);
    var slots = $$('.job-slot', opp);
    var none = $('[data-no-jobs]', opp);
    var all = $('[data-all-jobs]', opp);
    var visible = parseInt(opp.getAttribute('data-visible'), 10) || 4;
    $$('[data-chip]', opp).forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('[data-chip]', opp).forEach(function (c) { c.classList.toggle('on', c === chip); });
        var sector = chip.getAttribute('data-chip');
        var shown = 0;
        slots.forEach(function (s) {
          var match = !sector || s.getAttribute('data-sector') === sector;
          var show = match && shown < visible;
          s.classList.toggle('is-hidden', !show);
          if (show) shown++;
        });
        none.hidden = shown > 0;
        all.href = sector ? '/jobs?sector=' + encodeURIComponent(sector) : '/jobs';
      });
    });
    var cp = $('[data-chips-prev]', opp), cn = $('[data-chips-next]', opp);
    if (cp) cp.addEventListener('click', function () { chips.scrollBy({ left: -240, behavior: 'smooth' }); });
    if (cn) cn.addEventListener('click', function () { chips.scrollBy({ left: 240, behavior: 'smooth' }); });
  }

  // ---- Saved jobs (stored on this device) ----
  var KEY = 'savedJobs';
  function readSaved() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function writeSaved(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ } }
  function paintSaved() {
    var saved = readSaved();
    $$('[data-save]').forEach(function (b) {
      var on = saved.indexOf(Number(b.getAttribute('data-save'))) !== -1;
      b.setAttribute('aria-pressed', String(on));
      var label = $('span', b);
      if (label) label.textContent = on ? 'Saved' : 'Save job';
    });
    $$('[data-saved-count]').forEach(function (el) { el.textContent = saved.length; el.hidden = !saved.length; });
    $$('[data-saved-link]').forEach(function (a) { a.href = '/jobs/saved' + (saved.length ? '?ids=' + saved.join(',') : ''); });
  }
  $$('[data-save]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = Number(b.getAttribute('data-save'));
      var saved = readSaved();
      var i = saved.indexOf(id);
      if (i === -1) saved.unshift(id); else saved.splice(i, 1);
      writeSaved(saved.slice(0, 50));
      paintSaved();
    });
  });
  paintSaved();
  var savedPage = $('[data-saved-page="load"]');
  if (savedPage) {
    var ids = readSaved();
    if (ids.length) location.replace('/jobs/saved?ids=' + ids.join(','));
  }

  // ---- Job alerts dialog ----
  var dialog = $('#job-alerts');
  $$('[data-open-alerts]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      if (!dialog || !dialog.showModal) return;
      e.preventDefault();
      if (mobile) { mobile.hidden = true; document.body.style.overflow = ''; }
      dialog.showModal();
    });
  });
  $$('[data-close-alerts]').forEach(function (b) { b.addEventListener('click', function () { dialog.close(); }); });
  if (dialog) dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

  // ---- Simple sliders (testimonials, mission) ----
  $$('[data-slider]').forEach(function (s) {
    var slides = $$('[data-slide]', s), i = 0;
    var count = $('[data-slide-count]', s);
    function go(k) {
      i = (k + slides.length) % slides.length;
      slides.forEach(function (el, j) { el.classList.toggle('on', j === i); });
      if (count) count.textContent = (i + 1) + '/' + slides.length;
    }
    $('[data-slide-prev]', s).addEventListener('click', function () { go(i - 1); });
    $('[data-slide-next]', s).addEventListener('click', function () { go(i + 1); });
  });

  // ---- Forms ----
  $$('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) { if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault(); });
  });
  $$('[data-file-input]').forEach(function (input) {
    var zone = input.closest('.dropzone');
    var label = $('[data-file-label]', zone);
    input.addEventListener('change', function () {
      var n = input.files.length;
      if (n) { label.textContent = n > 1 ? n + ' files selected' : input.files[0].name; zone.classList.add('has-file'); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) { zone.addEventListener(ev, function () { zone.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { zone.addEventListener(ev, function () { zone.classList.remove('drag'); }); });
  });
  $$('form.upload-form').forEach(function (form) {
    form.addEventListener('submit', function () {
      var b = $('button[type=submit]', form);
      if (b) { b.disabled = true; b.textContent = 'Uploading…'; }
    });
  });
  // Stop double-taps from sending a form twice (a second login request would undo the first one).
  $$('form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return;
      if (form.getAttribute('data-submitting')) { e.preventDefault(); return; }
      form.setAttribute('data-submitting', '1');
      $$('button[type=submit]', form).forEach(function (b) { b.disabled = true; });
      setTimeout(function () {
        form.removeAttribute('data-submitting');
        $$('button[type=submit]', form).forEach(function (b) { b.disabled = false; });
      }, 8000);
    });
  });
  // Never reuse a page restored from the back/forward cache: its security token may be out of date.
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  var pre = $('select[data-preselect]');
  if (pre && !pre.value) {
    var s = new URLSearchParams(location.search).get('sector');
    if (s) pre.value = s;
  }
  var rights = $('[data-work-rights]'), visa = $('[data-visa-field]');
  if (rights && visa) {
    var syncVisa = function () { visa.hidden = !(rights.value === 'visa' || rights.value === 'sponsorship'); };
    rights.addEventListener('change', syncVisa);
    syncVisa();
  }

  // ---- Job search criteria ----
  var searchForm = $('#job-search');
  if (searchForm) {
    var submitSearch = function () { if (searchForm.requestSubmit) searchForm.requestSubmit(); else searchForm.submit(); };
    // Keep URLs tidy: drop empty fields (q=&listed=&min=) from the query string.
    searchForm.addEventListener('formdata', function (e) {
      var empty = [];
      e.formData.forEach(function (v, k) { if (v === '') empty.push(k); });
      empty.forEach(function (k) { e.formData.delete(k); });
    });
    // Selects apply immediately.
    $$('[data-autosubmit]').forEach(function (sel) { sel.addEventListener('change', submitSearch); });
    // Multi-select dropdowns apply when they close, if something changed.
    var dropdowns = $$('[data-ms]');
    dropdowns.forEach(function (d) {
      var snapshot = '';
      var state = function () { return $$('input:checked', d).map(function (i) { return i.value; }).join('|'); };
      d.addEventListener('toggle', function () {
        if (d.open) {
          snapshot = state();
          dropdowns.forEach(function (o) { if (o !== d) o.open = false; });
        } else if (state() !== snapshot) {
          submitSearch();
        }
      });
    });
    document.addEventListener('click', function (e) {
      dropdowns.forEach(function (d) { if (d.open && !d.contains(e.target)) d.open = false; });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') dropdowns.forEach(function (d) { d.open = false; });
    });
    // The criteria panel is always open on desktop and collapsible on small screens.
    var box = $('[data-criteria]');
    var mq = window.matchMedia('(max-width: 1040px)');
    var syncBox = function () { box.open = !mq.matches; };
    syncBox();
    if (mq.addEventListener) mq.addEventListener('change', syncBox);
    $('summary', box).addEventListener('click', function (e) { if (!mq.matches) e.preventDefault(); });
  }

  // ---- Branch map (Leaflet + tile server from data attributes, loaded with defer) ----
  window.addEventListener('load', function () {
    var el = $('[data-map]');
    if (!el || !window.L) return;
    var branches = JSON.parse(el.getAttribute('data-branches') || '[]');
    var map = L.map(el, { scrollWheelZoom: false, attributionControl: true }).setView([-27, 134], 4);
    L.tileLayer(el.getAttribute('data-tiles'), {
      maxZoom: 18,
      attribution: el.getAttribute('data-attribution'),
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(map);
    var pin = L.divIcon({
      className: 'map-pin',
      html: '<svg viewBox="0 0 26 34"><path d="M13 0C5.8 0 0 5.6 0 12.6 0 22 13 34 13 34s13-12 13-21.4C26 5.6 20.2 0 13 0z" fill="#fb7a05"/><circle cx="13" cy="12.5" r="4.5" fill="#0b1f4d"/></svg>',
      iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -30],
    });
    var bounds = [];
    branches.forEach(function (b) {
      var m = L.marker([b.lat, b.lng], { icon: pin }).addTo(map);
      var popup = document.createElement('div');
      var strong = document.createElement('strong'); strong.textContent = b.city;
      popup.appendChild(strong); popup.appendChild(document.createTextNode(', ' + b.state));
      m.bindPopup(popup);
      bounds.push([b.lat, b.lng]);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    else if (bounds.length === 1) map.setView(bounds[0], 10);
  });
})();
