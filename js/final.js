(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  let slug = (params.get('slug') || params.get('code') || '').trim();

  // Extra fallback: if a browser/proxy dropped the query string, try the
  // previous page URL when it contains a shortlink slug.
  if (!slug) {
    try {
      const ref = document.referrer || '';
      const m = ref.match(/\/s\/([^/?#]+)/i);
      if (m) slug = decodeURIComponent(m[1]);
    } catch (_) {}
  }

  const button = document.getElementById('final-open');
  const status = document.getElementById('final-status');
  if (!button) return;

  let resolvedUrl = '';

  function track(eventName, value) {
    try {
      if (typeof window.showlinkTrack === 'function') window.showlinkTrack(eventName, value);
      else if (typeof window.track === 'function') window.track(eventName, value);
    } catch (_) {}
  }

  function normalizeUrl(value) {
    let url = String(value || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      const parsed = new URL(url);
      return /^https?:$/i.test(parsed.protocol) ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  // IMPORTANT: never permanently disable the original button.
  // The click handler below can resolve the destination if it was not ready
  // when the page first loaded.
  function setOriginalUrl(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) return false;

    resolvedUrl = normalized;
    button.href = normalized;
    button.classList.remove('is-locked');
    button.classList.add('is-ready');
    button.removeAttribute('aria-disabled');
    button.removeAttribute('tabindex');
    return true;
  }

  function readObject(raw) {
    try {
      const item = JSON.parse(raw || '{}');
      return normalizeUrl(
        item?.destination_url ||
        item?.url ||
        item?.destinationUrl ||
        ''
      );
    } catch (_) {
      return '';
    }
  }

  function readSavedDestination() {
    if (!slug) return '';

    const keys = [
      'showlink-shortlink-content:' + slug
    ];

    for (const key of keys) {
      try {
        const v = readObject(sessionStorage.getItem(key));
        if (v) return v;
      } catch (_) {}
      try {
        const v = readObject(localStorage.getItem(key));
        if (v) return v;
      } catch (_) {}
    }

    // Backward compatibility with choice:<id>.
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i) || '';
        if (!key.startsWith('showlink-shortlink-choice:')) continue;
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const item = JSON.parse(raw);
          if (String(item?.slug || '').trim() !== slug) continue;
          const v = normalizeUrl(item?.destination_url || item?.url || '');
          if (v) return v;
        } catch (_) {}
      }
    } catch (_) {}

    return '';
  }

  async function fetchDestinationFromSupabase() {
    if (!slug || !window.ShowLinkSupabase?.load) return '';

    try {
      const sb = await window.ShowLinkSupabase.load();
      const result = await sb.rpc('get_public_shortlink', { p_slug: slug });
      if (result?.error) return '';

      let data = result?.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_) {}
      }
      if (Array.isArray(data)) data = data[0] || null;
      if (!data || data.ok === false) return '';

      const destination = normalizeUrl(
        data.destination_url ||
        data.destinationUrl ||
        ''
      );
      if (!destination) return '';

      const payload = JSON.stringify({
        url: destination,
        destination_url: destination
      });

      try { sessionStorage.setItem('showlink-shortlink-content:' + slug, payload); } catch (_) {}
      try { localStorage.setItem('showlink-shortlink-content:' + slug, payload); } catch (_) {}

      return destination;
    } catch (_) {
      return '';
    }
  }

  async function resolveDestination() {
    let destination = readSavedDestination();
    if (!destination) destination = await fetchDestinationFromSupabase();
    if (destination) setOriginalUrl(destination);
    return destination;
  }

  // Start active by default. This prevents an initialization race from
  // producing the grey "locked" button seen on mobile.
  button.classList.remove('is-locked');
  button.classList.add('is-ready');
  button.removeAttribute('aria-disabled');

  // Resolve in background.
  resolveDestination();
  track('page_view', null);

  document.querySelectorAll('.ad-download').forEach(function (adButton) {
    adButton.addEventListener('click', function () {
      track('ad_click', adButton.dataset.adSlot || null);
    }, { passive: true });
  });

  button.addEventListener('click', async function (event) {
    const current = normalizeUrl(resolvedUrl || button.getAttribute('href') || '');

    if (current) {
      event.preventDefault();
      track('original_click', null);
      window.location.assign(current);
      return;
    }

    // Resolve on the actual click. This is the final fallback and does not
    // depend on sessionStorage being available.
    event.preventDefault();
    button.classList.remove('is-locked');
    button.classList.add('is-ready');
    setStatus('Menyiapkan konten...');

    const destination = await resolveDestination();
    if (destination) {
      track('original_click', null);
      window.location.assign(destination);
      return;
    }

    setStatus('Konten asli belum dapat dimuat. Coba tekan lagi.');
  });

  const join = document.getElementById('join-float');
  const done = document.getElementById('join-done');
  const telegram = document.getElementById('join-telegram');
  let dismissed = false;

  function showJoin() {
    if (join && !dismissed) join.classList.add('show');
  }

  if (join) {
    setTimeout(showJoin, 3000);
    window.__joinTimer = setInterval(showJoin, 3000);
  }

  if (done) {
    done.addEventListener('click', function () {
      dismissed = true;
      if (join) join.classList.remove('show');
      if (window.__joinTimer) clearInterval(window.__joinTimer);
    });
  }

  if (telegram) {
    telegram.addEventListener('click', function () {
      track('telegram_join_click', null);
    });
  }
})();
