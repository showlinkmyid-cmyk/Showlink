(() => {
  'use strict';

  const app = document.getElementById('app');
  const parts = window.location.pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'p' && parts[1] ? decodeURIComponent(parts[1]) : '';
  const qs = new URLSearchParams(window.location.search);
  const incomingGuestToken = qs.get('guest_token') || '';
  const dbg = window.ShowLinkDebug || { log:()=>{}, warn:()=>{}, error:()=>{} };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[c]));
  const money = (n, currency='IDR') => new Intl.NumberFormat('id-ID', {
    style:'currency', currency, maximumFractionDigits:0
  }).format(Number(n || 0));

  function guestToken() {
    let t = incomingGuestToken || localStorage.getItem('showlink_guest_token');
    if (!t) {
      try { t = crypto.randomUUID(); }
      catch (_) { t = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      localStorage.setItem('showlink_guest_token', t);
    }
    return t;
  }

  function currentGuestToken() {
    return incomingGuestToken || localStorage.getItem('showlink_guest_token') || '';
  }

  function renderError(message) {
    app.innerHTML = `<div class="pf-body">
      <div class="pf-loader">
        <i class="fa-solid fa-circle-exclamation"></i>
        <h2>Payment Link tidak tersedia</h2>
        <p>${esc(message || 'Payment Link tidak ditemukan atau sudah tidak aktif.')}</p>
      </div>
    </div>`;
  }

  function renderLocked(data) {
    const image = data.thumbnail_url;
    app.innerHTML = `
      ${image
        ? `<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`
        : `<div class="pf-cover"><i class="fa-solid fa-credit-card"></i></div>`}
      <div class="pf-body">
        <span class="pf-kicker"><i class="fa-solid fa-credit-card"></i> PAYMENT LINK</span>
        <h1 class="pf-title">${esc(data.title || 'Payment Link')}</h1>
        ${data.description ? `<p class="pf-desc">${esc(data.description)}</p>` : ''}
        <div class="pf-status" style="margin:18px 0">
          <i class="fa-solid fa-lock"></i>
          Konten terkunci. Lakukan pembayaran untuk membuka konten.
        </div>
        <div class="pf-price">${money(data.price, data.currency || 'IDR')}</div>
        <button class="pf-btn" id="buy">
          Beli &amp; Bayar <i class="fa-solid fa-arrow-right"></i>
        </button>
        <div class="pf-status">Setelah pembayaran berhasil diverifikasi, konten akan terbuka di halaman ini.</div>
      </div>`;

    document.getElementById('buy').addEventListener('click', () => {
      const token = guestToken();
      const url = `/payment-public?slug=${encodeURIComponent(slug)}&guest_token=${encodeURIComponent(token)}`;
      dbg.log('PAYMENT LINK BUY CLICK', { slug, url });
      window.location.href = url;
    });
  }

  function renderUnlocked(data) {
    const content = data.content_html ||
      (data.content_text
        ? `<pre class="pf-content-text">${esc(data.content_text)}</pre>`
        : `<div class="pf-status">Konten kosong.</div>`);

    app.innerHTML = `
      ${data.thumbnail_url
        ? `<div class="pf-cover"><img src="${esc(data.thumbnail_url)}" alt=""></div>`
        : `<div class="pf-cover"><i class="fa-solid fa-unlock"></i></div>`}
      <div class="pf-body">
        <span class="pf-kicker"><i class="fa-solid fa-circle-check"></i> PAYMENT VERIFIED</span>
        <h1 class="pf-title">${esc(data.title || 'Payment Link')}</h1>
        ${data.description ? `<p class="pf-desc">${esc(data.description)}</p>` : ''}
        <div class="pf-status" style="margin:16px 0">
          <i class="fa-solid fa-unlock"></i>
          Pembayaran terverifikasi. Konten sudah terbuka.
        </div>
        <div class="pf-content">${content}</div>
      </div>`;
  }

  async function load() {
    try {
      if (!slug) throw new Error('Kode Payment Link tidak ditemukan di URL.');

      dbg.log('PAYMENT LINK PUBLIC LOAD', { slug, pathname: window.location.pathname });
      const sb = await window.ShowLinkSupabase.load();

      const { data, error } = await sb.rpc('get_payment_link_by_slug', { p_slug: slug });
      dbg.log('PAYMENT LINK LOOKUP', { slug, data, error });

      if (error) throw error;
      if (!data) throw new Error('Payment Link tidak ditemukan atau sudah tidak aktif.');

      // The public page is the Payment Link landing page. Only after payment
      // access is granted do we expose content_html/content_text.
      const token = currentGuestToken();
      const { data: access, error: accessError } = await sb.rpc('get_paid_content', {
        p_payment_link_slug: slug,
        p_guest_access_token: token || null
      });
      dbg.log('PAYMENT LINK ACCESS', { access, accessError });

      if (accessError) throw accessError;

      if (access?.unlocked === true) {
        renderUnlocked({ ...data, ...access });
        return;
      }

      renderLocked(data);
    } catch (error) {
      dbg.error('PAYMENT LINK PUBLIC LOAD FAILED', error);
      renderError(error?.message);
    }
  }

  load();
})();
