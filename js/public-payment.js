(() => {
  'use strict';

  const app = document.getElementById('app');
  const slug = location.pathname.split('/').filter(Boolean)[1] || '';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
  const money = (n, c='IDR') => new Intl.NumberFormat('id-ID', {
    style:'currency', currency:c, maximumFractionDigits:0
  }).format(Number(n || 0));

  const guestToken = () => {
    let t = localStorage.getItem('showlink_guest_token');
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem('showlink_guest_token', t);
    }
    return t;
  };

  const apiHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${window.SHOWLINK_SUPABASE.anonKey}`,
    'apikey': window.SHOWLINK_SUPABASE.anonKey
  });

  async function sessionUser(sb) {
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  function contentUrl(orderId) {
    return `/content/payment/${encodeURIComponent(slug)}?order=${encodeURIComponent(orderId)}`;
  }

  async function load() {
    try {
      const sb = await window.ShowLinkSupabase.load();
      const { data, error } = await sb.rpc('get_payment_link_by_slug', { p_slug: slug });
      if (error) throw error;
      if (!data) throw new Error('Payment Link tidak ditemukan atau sudah tidak aktif.');

      // Price shown to the buyer is calculated server-side from the current
      // session plan. The database remains authoritative at checkout.
      const { data: pricing, error: pricingError } = await sb.rpc('get_payment_link_buyer_price', {
        p_original_amount: data.price,
        p_buyer_id: null
      });
      if (pricingError) throw pricingError;
      render({ ...data, buyer_pricing: Array.isArray(pricing) ? pricing[0] : pricing }, sb);
    } catch (e) {
      app.innerHTML = `<div class="pf-body"><div class="pf-loader">
        <i class="fa-solid fa-circle-exclamation"></i>
        <h2>Payment Link tidak tersedia</h2>
        <p>${esc(e.message || 'Terjadi kesalahan.')}</p>
      </div></div>`;
    }
  }

  function render(data, sb) {
    const image = data.thumbnail_url || data.thumbnail;
    app.innerHTML = `
      ${image
        ? `<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`
        : '<div class="pf-cover"><i class="fa-solid fa-credit-card"></i></div>'}
      <div class="pf-body">
        <span class="pf-kicker"><i class="fa-solid fa-lock"></i> PAYMENT LINK</span>
        <h1 class="pf-title">${esc(data.title)}</h1>
        <p class="pf-desc">${esc(data.description || 'Konten berbayar ShowLink.')}</p>
        ${(() => {
          const p = data.buyer_pricing || {};
          const original = Number(p.original_amount ?? data.price ?? 0);
          const actual = Number(p.buyer_amount ?? original);
          const discounted = actual < original;
          const plan = String(p.buyer_plan || 'guest').toUpperCase();
          return discounted
            ? `<div class="pf-price"><span style="font-size:.55em;opacity:.6;text-decoration:line-through;display:block">${money(original, data.currency || 'IDR')}</span>${money(actual, data.currency || 'IDR')}</div><div class="pf-status">Harga ${esc(plan)} diterapkan. Nominal checkout dihitung ulang oleh server.</div>`
            : `<div class="pf-price">${money(actual, data.currency || 'IDR')}</div>`;
        })()}
        <button class="pf-btn" id="buy">Beli &amp; Bayar <i class="fa-solid fa-arrow-right"></i></button>
        <div class="pf-status" id="status">Pembayaran akan diproses otomatis sesuai nominal link.</div>
      </div>`;
    document.getElementById('buy').addEventListener('click', () => buy(data, sb));
  }

  async function createCashiPayment(orderId) {
    const fn = `${window.SHOWLINK_SUPABASE.url}/functions/v1/cashi-create-payment`;
    const resp = await fetch(fn, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ order_id: orderId })
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(result.error || 'Gateway Cashi belum terhubung.');
    return result;
  }

  async function buy(data, sb) {
    const btn = document.getElementById('buy');
    const status = document.getElementById('status');
    btn.disabled = true;
    status.textContent = 'Membuat order pembayaran…';

    try {
      const user = await sessionUser(sb);
      const { data: order, error } = await sb.rpc('create_checkout_order', {
        p_payment_link_id: data.id,
        p_guest_access_token: user ? null : guestToken()
      });
      if (error) throw error;

      const oid = order?.order_id || order?.id;
      if (!oid) throw new Error('Order tidak berhasil dibuat.');

      status.textContent = 'Menghubungkan ke Cashi…';
      const result = await createCashiPayment(oid);

      if (result.already_paid) {
        location.href = contentUrl(oid);
        return;
      }

      // Prefer QR mode because the page can remain open and detect the
      // verified Cashi webhook/status automatically.
      if (result.qr_url) {
        app.innerHTML = `
          <div class="pf-body">
            <span class="pf-kicker"><i class="fa-solid fa-qrcode"></i> CASHI</span>
            <h1 class="pf-title">Selesaikan pembayaran</h1>
            <p class="pf-desc">Bayar sesuai nominal Payment Link. Setelah Cashi mengonfirmasi pembayaran, konten akan terbuka otomatis.</p>
            <div style="text-align:center;margin:18px 0">
              <img src="${esc(result.qr_url)}" alt="QR pembayaran Cashi"
                   style="max-width:280px;width:100%;border-radius:18px">
            </div>
            ${result.checkout_url
              ? `<a class="pf-btn" href="${esc(result.checkout_url)}" target="_blank" rel="noopener noreferrer"
                    style="display:flex;text-decoration:none;text-align:center;justify-content:center">
                    Buka halaman Cashi <i class="fa-solid fa-arrow-up-right-from-square"></i>
                 </a>`
              : ''}
            <div class="pf-status" id="status">Menunggu konfirmasi pembayaran…</div>
          </div>`;
        pollPaid(oid);
        return;
      }

      if (result.checkout_url) {
        location.href = result.checkout_url;
        return;
      }

      throw new Error('Cashi tidak mengembalikan halaman pembayaran atau QR.');
    } catch (e) {
      btn.disabled = false;
      if (status) {
        status.className = 'pf-status error';
        status.textContent = e.message || 'Pembayaran gagal dibuat.';
      } else {
        app.innerHTML = `<div class="pf-body"><div class="pf-status error">${esc(e.message || 'Pembayaran gagal dibuat.')}</div></div>`;
      }
    }
  }

  async function pollPaid(orderId) {
    const fn = `${window.SHOWLINK_SUPABASE.url}/functions/v1/cashi-check-status`;
    const status = document.getElementById('status');

    for (let i = 0; i < 100; i++) {
      await new Promise(r => setTimeout(r, 3000));

      try {
        const resp = await fetch(fn, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ order_id: orderId })
        });
        const result = await resp.json().catch(() => ({}));

        if (result.paid === true || result.status === 'SETTLED') {
          if (status) status.textContent = 'Pembayaran berhasil. Membuka konten…';
          location.href = contentUrl(orderId);
          return;
        }

        if (status && result.status) {
          status.textContent = `Status pembayaran: ${result.status}. Menunggu konfirmasi…`;
        }
      } catch (_) {
        // Webhook remains the authoritative path; keep polling quietly.
      }
    }

    if (status) {
      status.textContent = 'Pembayaran belum terkonfirmasi. Silakan cek kembali beberapa saat lagi.';
    }
  }

  load();
})();
