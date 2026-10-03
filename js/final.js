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
    const raw = String(value || '').trim();
    if (!raw) return '';
    const candidate = /^www\./i.test(raw) ? 'https://' + raw : raw;
    if (!/^https?:\/\//i.test(candidate)) return '';
    try {
      const u = new URL(candidate);
      return /^https?:$/i.test(u.protocol) ? u.href : '';
    } catch (_) { return ''; }
  }

  function readStoredContent() {
    if (!slug) return '';
    const keys = ['showlink-shortlink-content:' + slug];
    for (const key of keys) {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const raw = storage.getItem(key);
          if (!raw) continue;
          const item = JSON.parse(raw);
          const content = String(item?.content_text || '').trim();
          if (content) return content;
        } catch (_) {}
      }
    }
    return '';
  }

  async function readSupabaseContent() {
    if (!slug || !window.ShowLinkSupabase?.load) return '';
    try {
      const sb = await window.ShowLinkSupabase.load();
      const result = await sb.rpc('get_public_shortlink', { p_slug: slug });
      if (result?.error) return '';
      let data = result.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) {} }
      if (Array.isArray(data)) data = data[0] || null;
      if (!data || data.ok === false) return '';
      const content = String(data.content_text || '').trim();
      if (!content) return '';
      try { sessionStorage.setItem('showlink-shortlink-content:' + slug, JSON.stringify({content_text:content,destination_url:data.destination_url || ''})); } catch (_) {}
      try { localStorage.setItem('showlink-shortlink-content:' + slug, JSON.stringify({content_text:content,destination_url:data.destination_url || ''})); } catch (_) {}
      return content;
    } catch (_) { return ''; }
  }

  function renderOriginalContent(content) {
    const box = document.getElementById('original-content');
    if (box) {
      box.hidden = false;
      box.querySelector('.original-content-value').textContent = content;
    }
  }

  async function resolveContent() {
    let content = String(contentParam || '').trim();
    if (!content) content = readStoredContent();
    if (!content) content = await readSupabaseContent();
    return content;
  }

  async function resolve() {
    const content = await resolveContent();
    if (content) {
      renderOriginalContent(content);
      const url = normalizeUrl(content);
      if (url) setOriginalUrl(url);
      return url;
    }
    // Backward compatibility for older records that only contain destination_url.
    const url = normalizeUrl(targetParam);
    if (url) setOriginalUrl(url);
    return url;
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
    const content = await resolveContent();
    if (!content) { setStatus('Konten asli belum dapat dimuat.'); return; }
    const destination = normalizeUrl(content);
    if (destination) { track('original_click', destination); window.location.assign(destination); return; }
    const blob = new Blob([content], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (slug || 'showlink-content') + '.txt';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    setStatus('Konten asli berhasil disiapkan.');
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
