(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const slug = (params.get('slug') || params.get('code') || '').trim();
  const contentParam = params.get('content') || '';
  const targetParam = (params.get('target') || '').trim();

  const button = document.getElementById('final-open');
  const status = document.getElementById('final-status');
  if (!button) return;

  let resolvedContent = '';

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

  // Only treat the ENTIRE content as a direct destination when the whole
  // content is one URL. Multiline content such as:
  // "Group\nhttps://t.me/...\n\nCode\n..." is NOT a URL.
  function wholeContentUrl(content) {
    const value = String(content || '').trim();
    if (!value || /\s/.test(value)) return '';
    return normalizeUrl(value);
  }

  function linkifyContent(content) {
    const box = document.getElementById('original-content');
    const value = document.querySelector('#original-content .original-content-value');
    if (!box || !value) return;

    box.hidden = false;
    value.textContent = '';

    const text = String(content || '');
    const re = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    let last = 0;
    let match;

    while ((match = re.exec(text))) {
      value.appendChild(document.createTextNode(text.slice(last, match.index)));
      const raw = match[0];
      const href = /^www\./i.test(raw) ? 'https://' + raw : raw;
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = raw;
      value.appendChild(a);
      last = match.index + raw.length;
    }

    value.appendChild(document.createTextNode(text.slice(last)));
  }

  function readStoredContent() {
    if (!slug) return '';

    const keys = [
      'showlink-shortlink-content:' + slug
    ];

    for (const key of keys) {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const raw = storage.getItem(key);
          if (!raw) continue;
          const item = JSON.parse(raw);
          const content = String(
            item?.content_text ??
            item?.content ??
            ''
          ).trim();
          if (content) return content;
        } catch (_) {}
      }
    }

    // Backward compatibility with the old choice:<id> payload.
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i) || '';
        if (!key.startsWith('showlink-shortlink-choice:')) continue;
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        const item = JSON.parse(raw);
        const itemSlug = String(item?.slug || '').trim();
        if (itemSlug !== slug) continue;
        const content = String(item?.content_text ?? '').trim();
        if (content) return content;
      }
    } catch (_) {}

    return '';
  }

  async function readSupabaseContent() {
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

      const content = String(
        data.content_text ??
        data.content ??
        ''
      ).trim();

      if (!content) return '';

      const payload = JSON.stringify({
        slug: data.slug || slug,
        title: data.title || '',
        description: data.description || '',
        content_text: content,
        // Kept only as legacy compatibility; it is NEVER used to replace
        // multiline content.
        destination_url: data.destination_url || ''
      });

      try {
        sessionStorage.setItem('showlink-shortlink-content:' + slug, payload);
      } catch (_) {}
      try {
        localStorage.setItem('showlink-shortlink-content:' + slug, payload);
      } catch (_) {}

      return content;
    } catch (_) {
      return '';
    }
  }

  async function resolveContent() {
    let content = String(contentParam || '').trim();
    if (!content) content = readStoredContent();
    if (!content) content = await readSupabaseContent();
    return content;
  }

  function setOriginalDownloadMode(content) {
    const directUrl = wholeContentUrl(content);

    button.removeAttribute('aria-disabled');
    button.removeAttribute('tabindex');
    button.classList.remove('is-locked');
    button.classList.add('is-ready');

    if (directUrl) {
      button.href = directUrl;
      button.target = '_blank';
      button.rel = 'noopener noreferrer';
    } else {
      // Multiline/raw content is downloaded as a text file. The content box
      // above remains the human-readable source of truth.
      button.removeAttribute('href');
      button.removeAttribute('target');
      button.removeAttribute('rel');
    }

    return directUrl;
  }

  async function resolve() {
    const content = await resolveContent();

    if (content) {
      resolvedContent = content;
      linkifyContent(content);
      const directUrl = setOriginalDownloadMode(content);
      if (status) {
        status.textContent = directUrl
          ? 'Konten asli siap dibuka.'
          : 'Konten asli siap. Semua isi ditampilkan persis seperti yang dibuat.';
      }
      return directUrl;
    }

    // Legacy fallback only when there is genuinely no content_text.
    const legacyUrl = wholeContentUrl(targetParam);
    if (legacyUrl) {
      button.href = legacyUrl;
      button.target = '_blank';
      button.rel = 'noopener noreferrer';
      if (status) status.textContent = 'Konten asli siap dibuka.';
      return legacyUrl;
    }

    if (status) status.textContent = 'Konten asli belum dapat dimuat.';
    return '';
  }

  resolve();
  track('page_view', null);

  document.querySelectorAll('.ad-download').forEach(function (adButton) {
    adButton.addEventListener('click', function () {
      track('ad_click', adButton.dataset.adSlot || null);
    });
  });

  button.addEventListener('click', async function (event) {
    const current = wholeContentUrl(resolvedContent);

    if (current) {
      track('original_click', current);
      return; // Let the native <a> open the Telegram/web URL.
    }

    event.preventDefault();

    const content = resolvedContent || await resolveContent();
    if (!content) {
      if (status) status.textContent = 'Konten asli belum dapat dimuat.';
      return;
    }

    // If the content is multiline, Download (Asli) downloads the EXACT raw
    // content instead of incorrectly treating it as a URL.
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = (slug || 'showlink-content') + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);

    if (status) status.textContent = 'Konten asli berhasil disiapkan.';
    track('original_click', 'text-content');
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
