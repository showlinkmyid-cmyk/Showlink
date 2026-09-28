(() => {
  'use strict';

  const app = document.getElementById('app');
  const parts = window.location.pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'p' && parts[1] ? decodeURIComponent(parts[1]) : '';

  const dbg = window.ShowLinkDebug || { log:()=>{}, warn:()=>{}, error:()=>{} };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  const money = (n, c='IDR') => new Intl.NumberFormat('id-ID', {
    style:'currency', currency:c, maximumFractionDigits:0
  }).format(Number(n || 0));

  function guestToken() {
    let t = localStorage.getItem('showlink_guest_token');
    if (!t) {
      try { t = crypto.randomUUID(); }
      catch (_) { t = 'guest-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
      localStorage.setItem('showlink_guest_token', t);
    }
    return t;
  }

  function currentGuestToken() {
    return localStorage.getItem('showlink_guest_token') || '';
  }

  function renderError(message) {
    app.innerHTML = `<div class="pf-body"><div class="pf-loader">
      <i class="fa-solid fa-circle-exclamation"></i>
      <h2>PasteLink tidak tersedia</h2>
      <p>${esc(message || 'Terjadi kesalahan.')}</p>
    </div></div>`;
  }

  function renderLocked(data, pricing) {
    const image = data.thumbnail_url || data.thumbnail;
    const original = Number(pricing?.original_amount ?? data.price ?? 0);
    const actual = Number(pricing?.buyer_amount ?? original);
    const discounted = actual < original;
    const plan = String(pricing?.buyer_plan || 'guest').toUpperCase();

    app.innerHTML = `
      ${image
        ? `<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`
        : '<div class="pf-cover"><i class="fa-solid fa-lock"></i></div>'}
      <div class="pf-body">
        <span class="pf-kicker"><i class="fa-solid fa-lock"></i> PAID PASTELINK</span>
        <h1 class="pf-title">${esc(data.title || 'Konten Premium')}</h1>
        <p class="pf-desc">${esc(data.description || 'Konten berbayar ShowLink.')}</p>

        <div class="pf-status" style="margin:18px 0">
          <i class="fa-solid fa-shield-halved"></i>
          Konten ini terkunci. Bayar untuk membuka akses.
        </div>

        ${discounted
          ? `<div class="pf-price">
               <span style="font-size:.55em;opacity:.6;text-decoration:line-through;display:block">
                 ${money(original, data.currency || 'IDR')}
               </span>
               ${money(actual, data.currency || 'IDR')}
             </div>
             <div class="pf-status">Harga ${esc(plan)} diterapkan saat checkout.</div>`
          : `<div class="pf-price">${money(actual, data.currency || 'IDR')}</div>`}

        <button class="pf-btn" id="buy">
          Beli &amp; Buka Konten <i class="fa-solid fa-arrow-right"></i>
        </button>

        <div class="pf-status">
          Setelah pembayaran berhasil diverifikasi, halaman ini akan terbuka otomatis.
        </div>
      </div>`;

    document.getElementById('buy').addEventListener('click', () => {
      const token = guestToken();
      const checkoutUrl = `/payment-public?slug=${encodeURIComponent(slug)}`;
      dbg.log('BUY CLICK: creating checkout flow', {
        checkoutUrl, slug, guest_token_present: !!token
      });
      window.location.href = checkoutUrl;
    });
  }

  function renderUnlocked(data) {
    const image = data.thumbnail_url || data.thumbnail;
    const content = data.content_html ||
      (data.content_text
        ? `<pre class="pf-content-text">${esc(data.content_text)}</pre>`
        : '<div class="pf-status">Konten kosong.</div>');

    app.innerHTML = `
      ${image
        ? `<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`
        : ''}
      <div class="pf-body">
        <span class="pf-kicker"><i class="fa-solid fa-unlock"></i> CONTENT UNLOCKED</span>
        <h1 class="pf-title">${esc(data.title || 'Konten Premium')}</h1>
        ${data.description
          ? `<p class="pf-desc">${esc(data.description)}</p>`
          : ''}
        <div class="pf-status" style="margin:16px 0">
          <i class="fa-solid fa-circle-check"></i>
          Pembayaran terverifikasi. Konten sudah terbuka.
        </div>
        <div class="pf-content">${content}</div>
      </div>`;
  }

  async function load() {
    try {
      if (!slug) throw new Error('Kode PasteLink tidak ditemukan di URL.');

      dbg.log('PASTELINK PUBLIC: loading Supabase', { slug });
      const sb = await window.ShowLinkSupabase.load();

      // The public page is always /p/{slug}. We ask the server whether
      // this visitor already has access. The RPC never returns paid content
      // unless the account/guest token is authorized.
      const token = currentGuestToken();
      const { data, error } = await sb.rpc('get_paid_content', {
        p_payment_link_slug: slug,
        p_guest_access_token: token || null
      });

      dbg.log('PASTELINK PUBLIC: get_paid_content RESULT', { data, error });

      if (error) throw error;
      if (!data) throw new Error('Konten tidak ditemukan atau sudah tidak aktif.');

      if (data.unlocked === true && data.requires_payment === true) {
        renderUnlocked(data);
        return;
      }

      if (data.requires_payment === true) {
        let pricing = {
          original_amount: Number(data.price || 0),
          buyer_plan: 'guest',
          buyer_amount: Number(data.price || 0)
        };

        // Display-only pricing. The checkout RPC remains authoritative.
        try {
          const { data: p } = await sb.rpc('get_payment_link_buyer_price', {
            p_original_amount: data.price,
            p_buyer_id: null
          });
          if (p) pricing = Array.isArray(p) ? (p[0] || pricing) : p;
        } catch (_) {}

        renderLocked(data, pricing);
        return;
      }

      throw new Error('Status konten tidak valid.');
    } catch (e) {
      dbg.error('PASTELINK PUBLIC LOAD FAILED', e);
      renderError(e.message || 'Terjadi kesalahan.');
    }
  }

  load();
})();
