(function () {
  'use strict';

  /*
   * SHORTLINK FINAL
   * Final is the last task. The original content must stay hidden until
   * the user explicitly clicks "Download (Asli)".
   *
   * Important:
   * - content_text is the source of truth.
   * - destination_url is only used when the ENTIRE content is one URL.
   * - multiline content is never converted into a fake URL.
   * - content is fetched at click time, following the same locked/unlocked
   *   principle used by the Payment Link flow.
   */

  const params = new URLSearchParams(window.location.search);
  const slug = (params.get('slug') || params.get('code') || '').trim();

  const button = document.getElementById('final-open');
  const status = document.getElementById('final-status');
  const contentBox = document.getElementById('original-content');
  const contentValue = contentBox?.querySelector('.original-content-value');

  if (!button) return;

  function track(eventName, value) {
    try {
      if (typeof window.showlinkTrack === 'function') {
        window.showlinkTrack(eventName, value);
      } else if (typeof window.track === 'function') {
        window.track(eventName, value);
      }
    } catch (_) {}
  }

  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || /\s/.test(raw)) return '';

    const candidate = /^www\./i.test(raw) ? 'https://' + raw : raw;
    if (!/^https?:\/\//i.test(candidate)) return '';

    try {
      const u = new URL(candidate);
      return /^https?:$/i.test(u.protocol) ? u.href : '';
    } catch (_) {
      return '';
    }
  }

  function wholeContentUrl(content) {
    return normalizeUrl(String(content || '').trim());
  }

  function revealContent(content) {
    if (!contentBox || !contentValue) return;

    contentValue.textContent = '';

    const text = String(content || '');
    const re = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

    let last = 0;
    let match;

    while ((match = re.exec(text))) {
      contentValue.appendChild(
        document.createTextNode(text.slice(last, match.index))
      );

      const raw = match[0];
      const href = /^www\./i.test(raw) ? 'https://' + raw : raw;

      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = raw;

      contentValue.appendChild(a);
      last = match.index + raw.length;
    }

    contentValue.appendChild(
      document.createTextNode(text.slice(last))
    );

    // This is the ONLY point where the original content becomes visible.
    contentBox.hidden = false;
  }

  async function fetchContent() {
    if (!slug) throw new Error('Shortlink tidak valid.');

    if (!window.ShowLinkSupabase?.load) {
      throw new Error('Koneksi ShowLink belum siap.');
    }

    const sb = await window.ShowLinkSupabase.load();
    const result = await sb.rpc('get_public_shortlink', {
      p_slug: slug
    });

    if (result?.error) throw result.error;

    let data = result?.data;

    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) {}
    }

    if (Array.isArray(data)) {
      data = data[0] || null;
    }

    if (!data || data.ok === false) {
      throw new Error('Shortlink tidak ditemukan atau sudah tidak aktif.');
    }

    const content = String(data.content_text ?? '').trim();

    if (!content) {
      throw new Error('Konten asli belum tersedia.');
    }

    return content;
  }

  async function openOriginal() {
    if (button.dataset.busy === '1') return;

    button.dataset.busy = '1';
    button.setAttribute('aria-busy', 'true');
    button.classList.add('is-loading');

    const oldHtml = button.innerHTML;
    button.innerHTML =
      '<span><i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...</span>' +
      '<small>Konten asli</small>';

    if (status) {
      status.textContent = 'Menyiapkan konten asli...';
    }

    try {
      const content = await fetchContent();

      // Reveal only after explicit click.
      revealContent(content);

      const directUrl = wholeContentUrl(content);

      if (directUrl) {
        /*
         * URL-only content:
         * show the exact original URL in the revealed content box,
         * then open the destination in a new tab.
         */
        if (status) {
          status.textContent = 'Konten asli sudah dibuka.';
        }

        track('original_click', directUrl);

        window.open(directUrl, '_blank', 'noopener,noreferrer');
      } else {
        /*
         * Multiline/raw content:
         * preserve it exactly and download it as TXT.
         */
        const blob = new Blob([content], {
          type: 'text/plain;charset=utf-8'
        });

        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = objectUrl;
        a.download = (slug || 'showlink-content') + '.txt';

        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        if (status) {
          status.textContent =
            'Konten asli sudah muncul dan file TXT sedang diunduh.';
        }

        track('original_click', 'text-content');
      }

      button.classList.remove('is-loading');
      button.classList.add('is-ready');
      button.innerHTML =
        '<span><i class="fa-solid fa-file-arrow-down"></i> Download (Asli)</span>' +
        '<small>Konten asli</small>';

    } catch (err) {
      console.error('[ShowLink] Final content error:', err);

      if (status) {
        status.textContent =
          err?.message || 'Konten asli belum dapat dimuat.';
      }

      button.classList.remove('is-loading');
      button.innerHTML = oldHtml;
    } finally {
      button.dataset.busy = '0';
      button.removeAttribute('aria-busy');
    }
  }

  // No content fetch here.
  // Final loads with the original content completely hidden.
  button.addEventListener('click', function (event) {
    event.preventDefault();
    openOriginal();
  });

  document.querySelectorAll('.ad-download').forEach(function (adButton) {
    adButton.addEventListener('click', function () {
      track('ad_click', adButton.dataset.adSlot || null);
    });
  });

  // Optional Telegram notification popup.
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
