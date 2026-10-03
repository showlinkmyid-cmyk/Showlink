(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const slug = (params.get('slug') || params.get('code') || '').trim();
  const targetParam = (params.get('target') || '').trim();
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
    } catch (_) { return ''; }
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setOriginalUrl(value) {
    const url = normalizeUrl(value);
    if (!url) return false;
    resolvedUrl = url;
    button.setAttribute('href', url);
    button.removeAttribute('aria-disabled');
    button.removeAttribute('tabindex');
    button.classList.remove('is-locked');
    button.classList.add('is-ready');
    setStatus('Konten asli siap dibuka.');
    return true;
  }

  function readStored() {
    if (!slug) return '';
    const key = 'showlink-shortlink-content:' + slug;

    for (const storage of [sessionStorage, localStorage]) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const item = JSON.parse(raw);
        const url = normalizeUrl(item?.destination_url || item?.url || item?.destinationUrl || '');
        if (url) return url;
      } catch (_) {}
    }

    try {
      for (const storage of [sessionStorage, localStorage]) {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i) || '';
          if (!k.startsWith('showlink-shortlink-choice:')) continue;
          try {
            const item = JSON.parse(storage.getItem(k) || '{}');
            if (String(item?.slug || '').trim() !== slug) continue;
            const url = normalizeUrl(item?.destination_url || item?.url || '');
            if (url) return url;
          } catch (_) {}
        }
      }
    } catch (_) {}
    return '';
  }

  async function readSupabase() {
    if (!slug || !window.ShowLinkSupabase?.load) return '';
    try {
      const sb = await window.ShowLinkSupabase.load();
      const result = await sb.rpc('get_public_shortlink', { p_slug: slug });
      if (result?.error) return '';
      let data = result.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_) {}
      }
      if (Array.isArray(data)) data = data[0] || null;
      if (!data || data.ok === false) return '';
      const url = normalizeUrl(data.destination_url || data.destinationUrl || '');
      if (!url) return '';
      const payload = JSON.stringify({url:url,destination_url:url});
      try { sessionStorage.setItem('showlink-shortlink-content:' + slug, payload); } catch (_) {}
      try { localStorage.setItem('showlink-shortlink-content:' + slug, payload); } catch (_) {}
      return url;
    } catch (_) { return ''; }
  }

  async function resolve() {
    if (setOriginalUrl(targetParam)) return resolvedUrl;
    const stored = readStored();
    if (setOriginalUrl(stored)) return resolvedUrl;
    const remote = await readSupabase();
    if (setOriginalUrl(remote)) return resolvedUrl;
    return '';
  }

  button.removeAttribute('aria-disabled');
  button.removeAttribute('tabindex');
  button.classList.remove('is-locked');
  button.classList.add('is-ready');

  resolve();
  track('page_view', null);

  document.querySelectorAll('.ad-download').forEach(function (adButton) {
    adButton.addEventListener('click', function () {
      track('ad_click', adButton.dataset.adSlot || null);
    });
  });

  button.addEventListener('click', async function (event) {
    const current = normalizeUrl(button.getAttribute('href') || resolvedUrl);
    if (current) {
      track('original_click', current);
      return;
    }

    event.preventDefault();
    setStatus('Menyiapkan konten...');
    const destination = await resolve();
    if (destination) {
      track('original_click', destination);
      window.location.assign(destination);
      return;
    }
    setStatus('Konten asli belum dapat dimuat.');
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
