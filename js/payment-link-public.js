(() => {
  'use strict';

  const app = document.getElementById('app');
  const parts = window.location.pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'p' && parts[1] ? decodeURIComponent(parts[1]) : '';

  const dbg = window.ShowLinkDebug || {
    log:()=>{}, warn:()=>{}, error:()=>{}
  };
  dbg.log('Payment Link script started', {
    pathname: window.location.pathname,
    slug,
    script: '/js/payment-link-public.js'
  });

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  const money = (n, c='IDR') => new Intl.NumberFormat('id-ID', {
    style:'currency', currency:c, maximumFractionDigits:0
  }).format(Number(n || 0));

  async function load() {
    try {
      if (!slug) throw new Error('Kode Payment Link tidak ditemukan di URL.');

      dbg.log('Loading Supabase client');
      const sb = await window.ShowLinkSupabase.load();
      dbg.log('Supabase client loaded', {
        supabase_url: window.SHOWLINK_SUPABASE?.url ? 'present' : 'missing',
        anon_key: window.SHOWLINK_SUPABASE?.anonKey ? 'present' : 'missing'
      });

      dbg.log('RPC get_payment_link_by_slug START', { p_slug: slug });
      const { data, error } = await sb.rpc('get_payment_link_by_slug', { p_slug: slug });
      dbg.log('RPC get_payment_link_by_slug RESULT', { data, error });
      if (error) throw error;
      if (!data) throw new Error('Payment Link tidak ditemukan atau sudah tidak aktif.');

      let buyerPricing = {
        original_amount: Number(data.price || 0),
        buyer_plan: 'guest',
        buyer_amount: Number(data.price || 0)
      };

      // Pricing is display-only here. Checkout recalculates the authoritative
      // amount after the user explicitly chooses to buy.
      try {
        const { data: pricing } = await sb.rpc('get_payment_link_buyer_price', {
          p_original_amount: data.price,
          p_buyer_id: null
        });
        if (pricing) buyerPricing = Array.isArray(pricing) ? (pricing[0] || buyerPricing) : pricing;
      } catch (_) {}

      dbg.log('Payment Link data valid; rendering public page', {
        id: data.id,
        slug: data.slug,
        title: data.title,
        status: data.status,
        price: data.price
      });
      render(data, buyerPricing);
    } catch (e) {
      dbg.error('PUBLIC PAYMENT LINK LOAD FAILED', e);
      app.innerHTML = `<div class="pf-body"><div class="pf-loader">
        <i class="fa-solid fa-circle-exclamation"></i>
        <h2>Payment Link tidak tersedia</h2>
        <p>${esc(e.message || 'Terjadi kesalahan.')}</p>
      </div></div>`;
    }
  }

  function render(data, pricing) {
    const image = data.thumbnail_url || data.thumbnail;
    const original = Number(pricing.original_amount ?? data.price ?? 0);
    const actual = Number(pricing.buyer_amount ?? original);
    const discounted = actual < original;
    const plan = String(pricing.buyer_plan || 'guest').toUpperCase();

    app.innerHTML = `
      ${image
        ? `<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`
        : '<div class="pf-cover"><i class="fa-solid fa-credit-card"></i></div>'}
      <div class="pf-body">
        <span class="pf-kicker"><i class="fa-solid fa-link"></i> PAYMENT LINK</span>
        <h1 class="pf-title">${esc(data.title)}</h1>
        <p class="pf-desc">${esc(data.description || 'Konten berbayar ShowLink.')}</p>
        ${discounted
          ? `<div class="pf-price"><span style="font-size:.55em;opacity:.6;text-decoration:line-through;display:block">${money(original, data.currency || 'IDR')}</span>${money(actual, data.currency || 'IDR')}</div>
             <div class="pf-status">Harga ${esc(plan)} diterapkan saat checkout.</div>`
          : `<div class="pf-price">${money(actual, data.currency || 'IDR')}</div>`}
        <button class="pf-btn" id="buy">Beli &amp; Bayar <i class="fa-solid fa-arrow-right"></i></button>
        <div class="pf-status">Anda akan diarahkan ke halaman pembayaran setelah menekan tombol di atas.</div>
      </div>`;

    document.getElementById('buy').addEventListener('click', () => {
      const checkoutUrl = `/payment-public?slug=${encodeURIComponent(slug)}`;
      dbg.log('BUY CLICK: navigating to checkout', { checkoutUrl });
      // ONLY NOW do we leave the public /p/{slug} page for checkout.
      window.location.href = checkoutUrl;
    });
  }

  load();
})();