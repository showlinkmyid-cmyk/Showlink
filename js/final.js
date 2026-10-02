(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const slug = (params.get('slug') || params.get('code') || '').trim();
  const button = document.getElementById('final-open');
  const status = document.getElementById('final-status');

  if (!button) return;

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
    } catch (_) { return ''; }
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setOriginalUrl(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      button.removeAttribute('href');
      button.classList.add('is-locked');
      button.classList.remove('is-ready');
      button.setAttribute('aria-disabled', 'true');
      setStatus('Silakan pilih tombol download yang tersedia.');
      return false;
    }

    button.href = normalized;
    button.classList.remove('is-locked');
    button.classList.add('is-ready');
    button.removeAttribute('aria-disabled');
    button.removeAttribute('tabindex');
    setStatus('Silakan pilih tombol download di atas.');
    return true;
  }

  function readSavedDestination() {
    if (!slug) return '';

    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i) || '';
        if (!key.startsWith('showlink-shortlink-choice:')) continue;

        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        const item = JSON.parse(raw);

        if (String(item?.slug || '').trim() !== slug) continue;

        const destination = item?.destination_url || item?.url || item?.destinationUrl || '';
        if (destination) {
          try {
            sessionStorage.setItem(
              'showlink-shortlink-content:' + slug,
              JSON.stringify({ url: destination })
            );
          } catch (_) {}
          return destination;
        }
      }
    } catch (_) {}

    try {
      const old = JSON.parse(
        sessionStorage.getItem('showlink-shortlink-content:' + slug) || '{}'
      );
      return old?.url || old?.destination_url || '';
    } catch (_) {
      return '';
    }
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

      const destination = data.destination_url || data.destinationUrl || '';
      if (!destination) return '';

      try {
        sessionStorage.setItem(
          'showlink-shortlink-content:' + slug,
          JSON.stringify({ url: destination })
        );
      } catch (_) {}

      return destination;
    } catch (_) {
      return '';
    }
  }

  async function init() {
    let destination = readSavedDestination();
    if (!destination) destination = await fetchDestinationFromSupabase();

    const ready = setOriginalUrl(destination);
    track('page_view', null);

    document.querySelectorAll('.ad-download').forEach(function (adButton) {
      adButton.addEventListener('click', function () {
        track('ad_click', adButton.dataset.adSlot || null);
      }, { passive: true });
    });

    button.addEventListener('click', function (event) {
      if (!ready || !button.href || button.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        return;
      }
      track('original_click', null);
    });
  }

  init();

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
