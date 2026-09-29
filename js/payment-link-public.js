(() => {
  'use strict';

  const app = document.getElementById('app');
  const parts = window.location.pathname.split('/').filter(Boolean);
  const routeSlug = parts[0] === 'p' && parts[1] ? (() => { try { return decodeURIComponent(parts[1]); } catch (_) { return ''; } })() : '';
  const qs = new URLSearchParams(window.location.search);
  const injectedSlug = String(window.__SHOWLINK_PAYMENT_SLUG || '').trim();
  const slug = injectedSlug || routeSlug || String(qs.get('slug') || '').trim();
  const incomingGuestToken = qs.get('guest_token') || '';
  let currentView = '';
  let currentData = null;
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

  function rerenderCurrent(){
    if (!currentData) return;
    if (currentView === 'locked') renderLocked(currentData);
    else if (currentView === 'unlocked') renderUnlocked(currentData);
    else if (currentView === 'payment') {
      const d = currentData;
      if (d?.paymentResult && d?.orderId) {
        // Rebuild the QR screen in the new language without creating a new order.
        renderQrPayment(d.paymentResult, d, null, d.orderId, false);
      }
    }
    else if (currentView === 'error') renderError(currentData);
  }

  function renderError(message) {
    currentView = 'error';
    currentData = message || '';
    app.innerHTML = `<div class="pf-body">
      <div class="pl-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <h2>${esc(t('notAvailable'))}</h2>
        <p>${esc(message || t('notFound'))}</p>
      </div>
    </div>`;
  }

  const I18N = {
    id: {
      kicker:'PAYMENT LINK', locked:'Konten terkunci. Lakukan pembayaran untuk membuka konten.',
      buy:'Beli & Bayar', verified:'Pembayaran terverifikasi. Konten sudah terbuka.',
      titleLabel:'Judul', priceLabel:'Harga', empty:'Konten kosong.',
      notAvailable:'Payment Link tidak tersedia',
      notFound:'Payment Link tidak ditemukan atau sudah tidak aktif.',
      loadError:'Kode Payment Link tidak ditemukan di URL.',
      loading:'Memuat Payment Link…',
      verifiedKicker:'PEMBAYARAN TERVERIFIKASI', themeLabel:'Tema', languageLabel:'Bahasa',
      warningTitle:'Peringatan penting',
      warning:'Utamakan cek dahulu sebelum membayar. Jangan meninggalkan halaman setelah QR tampil. Hargai platform agar pembayaran gagal dapat diminimalkan.',
      how:'Cara pembayaran',
      steps:[
        'Utamakan cek link dan judul terlebih dahulu.',
        'Klik Beli & Bayar.',
        'Saat QR sudah tampil, screenshot atau tangkap layar gambar QR tersebut.',
        'Masuk ke Bank/e-Wallet, lalu pilih Scan QR.',
        'Masukkan gambar atau screenshot QR tersebut, lalu pilih Bayar.',
        'Tunggu beberapa detik. Jika pembayaran sudah sukses, klik Cek Pembayaran. Jangan keluar halaman sebelum verifikasi berhasil.',
        'Berhasil. Setelah pembayaran terverifikasi, link atau konten otomatis akan muncul.'
      ],
      support:'Mendukung pembayaran melalui bank dan e-wallet yang tersedia pada gateway pembayaran.',
      creatingOrder:'Membuat order pembayaran…', connectingGateway:'Menghubungkan ke Cashi…',
      paymentTitle:'Selesaikan pembayaran', paymentDesc:'Bayar sesuai nominal Payment Link. QR pembayaran muncul di halaman ini.',
      waitingPayment:'Menunggu konfirmasi pembayaran…', checkPayment:'Cek Pembayaran',
      checkingPayment:'Memeriksa pembayaran…', paid:'Pembayaran berhasil. Membuka konten…',
      alreadyPaid:'Akses sudah tersedia. Membuka konten…', paymentError:'Pembayaran gagal dibuat.',
      openCashi:'Buka halaman Cashi'
    },
    en: {
      kicker:'PAYMENT LINK', locked:'Content is locked. Complete payment to unlock it.',
      buy:'Buy & Pay', verified:'Payment verified. Content is now unlocked.',
      titleLabel:'Title', priceLabel:'Price', empty:'Content is empty.',
      notAvailable:'Payment Link unavailable',
      notFound:'Payment Link was not found or is no longer active.',
      loadError:'Payment Link code was not found in the URL.',
      loading:'Loading Payment Link…',
      verifiedKicker:'PAYMENT VERIFIED', themeLabel:'Theme', languageLabel:'Language',
      warningTitle:'Important notice',
      warning:'Please check the link before paying. Do not leave the page after the QR appears. Respect the platform so failed payments can be minimized.',
      how:'How to pay',
      steps:[
        'Check the link and title first.',
        'Click Buy & Pay.',
        'When the QR appears, screenshot or capture the QR image.',
        'Open your bank/e-wallet and choose Scan QR.',
        'Select the saved QR screenshot/image, then tap Pay.',
        'Wait a few seconds. When payment succeeds, click Check Payment. Do not leave the page before verification succeeds.',
        'Done. After payment is verified, the link or content will appear automatically.'
      ],
      support:'Supports bank and e-wallet payment methods available through the payment gateway.',
      creatingOrder:'Creating payment order…', connectingGateway:'Connecting to Cashi…',
      paymentTitle:'Complete your payment', paymentDesc:'Pay the Payment Link amount. The payment QR appears on this page.',
      waitingPayment:'Waiting for payment confirmation…', checkPayment:'Check Payment',
      checkingPayment:'Checking payment…', paid:'Payment successful. Opening content…',
      alreadyPaid:'Access is already available. Opening content…', paymentError:'Payment could not be created.',
      openCashi:'Open Cashi page'
    }
  };

  const banks = ['BCA','BRI','BNI','Mandiri','BSI','CIMB Niaga','Danamon','Permata','BTN','OCBC','UOB','Maybank','Bank Jago','SeaBank','Jenius','DBS','HSBC'];
  const wallets = ['GoPay','OVO','DANA','ShopeePay','LinkAja','iSaku','Sakuku','PayPal','Apple Pay','Google Pay','Alipay','WeChat Pay','GrabPay','Wise'];

  function currentLang(){
    try { return localStorage.getItem('showlink-language') === 'en' ? 'en' : 'id'; } catch (_) { return 'id'; }
  }
  function t(k){ return I18N[currentLang()][k] || I18N.id[k] || k; }
  function renderPaymentGuidance(){
    const steps = I18N[currentLang()].steps;
    return `<div class="pl-warning">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div><strong>${t('warningTitle')}</strong><div>${t('warning')}</div></div>
    </div>
    <div class="pl-how">
      <h2><i class="fa-solid fa-list-check"></i> ${t('how')}</h2>
      <ol class="pl-steps">${steps.map((s,i)=>`<li class="pl-step"><span class="pl-num">${i+1}</span><span>${esc(s)}</span></li>`).join('')}</ol>
    </div>
    <div class="pl-support">
      <div>${t('support')}</div>
      <div class="pl-marquee">${banks.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      <div class="pl-marquee reverse">${wallets.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
    </div>`;
  }

  function renderLocked(data) {
    currentView = 'locked';
    currentData = data;
    const image = data.thumbnail_url;
    app.innerHTML = `
      ${image ? `<div class="pl-cover"><img src="${esc(image)}" alt=""></div>` : `<div class="pl-cover"><i class="fa-solid fa-credit-card"></i></div>`}
      <div class="pl-body">
        <span class="pl-kicker"><i class="fa-solid fa-credit-card"></i> ${t('kicker')}</span>
        <h1 class="pl-title">${esc(data.title || 'Payment Link')}</h1>
        ${data.description ? `<p class="pl-desc">${esc(data.description)}</p>` : ''}
        <div class="pl-meta">
          <div class="pl-meta-box"><span class="pl-meta-label">${esc(t('titleLabel'))}</span><span class="pl-meta-value">${esc(data.title || 'Payment Link')}</span></div>
          <div class="pl-meta-box"><span class="pl-meta-label">${esc(t('priceLabel'))}</span><span class="pl-meta-value">${money(data.price, data.currency || 'IDR')}</span></div>
        </div>
        <div class="pl-price">${money(data.price, data.currency || 'IDR')}</div>
        <button class="pl-buy" id="buy"><i class="fa-solid fa-lock-open"></i> ${t('buy')}</button>
        ${renderPaymentGuidance()}
      </div>`;

    document.getElementById('buy').addEventListener('click', () => {
      dbg.log('PAYMENT LINK BUY CLICK', { slug, payment_link_id: data.id });
      startPayment(data);
    });
  }


  async function apiHeaders(sb) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': window.SHOWLINK_SUPABASE.anonKey
    };
    try {
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (_) {}
    return headers;
  }

  async function sessionUser(sb) {
    try {
      const { data } = await sb.auth.getUser();
      return data?.user || null;
    } catch (_) {
      return null;
    }
  }

  async function createCashiPayment(orderId, sb, guestAccessToken) {
    const fn = `${window.SHOWLINK_SUPABASE.url}/functions/v1/cashi-create-payment`;
    const resp = await fetch(fn, {
      method: 'POST',
      headers: await apiHeaders(sb),
      body: JSON.stringify({
        order_id: orderId,
        guest_access_token: guestAccessToken || undefined
      })
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(result.error || 'Gateway Cashi belum terhubung.');
    return result;
  }

  function renderQrPayment(result, data, sb, orderId, resumePolling = true) {
    currentView = 'payment';
    currentData = { ...data, paymentResult: result, orderId };
    const qr = result.qr_url || result.qrUrl;
    const checkout = result.checkout_url || '';
    app.innerHTML = `
      <div class="pl-body">
        <span class="pl-kicker"><i class="fa-solid fa-qrcode"></i> CASHI</span>
        <h1 class="pl-title">${esc(t('paymentTitle'))}</h1>
        <p class="pl-desc">${esc(t('paymentDesc'))}</p>
        <div class="pl-meta">
          <div class="pl-meta-box"><span class="pl-meta-label">${esc(t('titleLabel'))}</span><span class="pl-meta-value">${esc(data.title || 'Payment Link')}</span></div>
          <div class="pl-meta-box"><span class="pl-meta-label">${esc(t('priceLabel'))}</span><span class="pl-meta-value">${money(result.amount || data.price, data.currency || 'IDR')}</span></div>
        </div>
        <div style="display:flex;justify-content:center;margin:22px 0">
          <div style="padding:14px;background:#fff;border-radius:20px;box-shadow:0 12px 35px rgba(0,0,0,.12)">
            <img src="${esc(qr)}" alt="QR pembayaran Cashi" style="display:block;max-width:min(320px,78vw);width:100%;height:auto;border-radius:10px">
          </div>
        </div>
        <div class="pl-status" id="payment-status"><i class="fa-solid fa-hourglass-half"></i> ${esc(t('waitingPayment'))}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="pl-buy" id="check-payment" type="button"><i class="fa-solid fa-rotate"></i> ${esc(t('checkPayment'))}</button>
          ${checkout ? `<a class="pl-buy" href="${esc(checkout)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;text-decoration:none;align-items:center;justify-content:center;background:var(--surface2);color:var(--text)"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${esc(t('openCashi'))}</a>` : ''}
        </div>
        ${renderPaymentGuidance()}
      </div>`;
    if (sb) {
      document.getElementById('check-payment')?.addEventListener('click', () => checkPayment(orderId, sb, data));
      if (resumePolling) pollPaid(orderId, sb, data);
    }
  }

  async function checkPayment(orderId, sb, data) {
    const status = document.getElementById('payment-status');
    if (status) status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esc(t('checkingPayment'))}`;
    const fn = `${window.SHOWLINK_SUPABASE.url}/functions/v1/cashi-check-status`;
    try {
      const user = await sessionUser(sb);
      const resp = await fetch(fn, {
        method: 'POST',
        headers: await apiHeaders(sb),
        body: JSON.stringify({
          order_id: orderId,
          guest_access_token: user ? undefined : currentGuestToken()
        })
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(result.error || 'Gagal mengecek pembayaran.');
      if (result.paid === true || result.status === 'SETTLED') {
        if (status) status.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${esc(t('paid'))}`;
        setTimeout(() => load(), 350);
        return true;
      }
      if (status) status.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${esc(t('waitingPayment'))}`;
      return false;
    } catch (e) {
      if (status) status.textContent = e.message || 'Gagal mengecek pembayaran.';
      return false;
    }
  }

  async function pollPaid(orderId, sb, data) {
    for (let i = 0; i < 100; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const paid = await checkPayment(orderId, sb, data);
      if (paid) return;
    }
  }

  async function startPayment(data) {
    const btn = document.getElementById('buy');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esc(t('creatingOrder'))}`;
    }
    try {
      const sb = await window.ShowLinkSupabase.load();
      const user = await sessionUser(sb);
      const token = user ? null : guestToken();

      const { data: order, error } = await sb.rpc('create_checkout_order', {
        p_payment_link_id: data.id,
        p_guest_access_token: token
      });
      if (error) throw error;

      if (order?.already_accessible === true) {
        await load();
        return;
      }

      const orderId = order?.order_id || order?.id;
      if (!orderId) throw new Error('Order tidak berhasil dibuat.');

      if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esc(t('connectingGateway'))}`;
      const result = await createCashiPayment(orderId, sb, token);

      if (result.already_paid) {
        await load();
        return;
      }

      const qr = result.qr_url || result.qrUrl;
      if (!qr) throw new Error('Cashi tidak mengembalikan QR pembayaran.');

      renderQrPayment(result, data, sb, orderId);
    } catch (e) {
      dbg.error('PAYMENT LINK INLINE CHECKOUT FAILED', e);
      renderError(e?.message || t('paymentError'));
    }
  }

  function renderUnlocked(data) {
    currentView = 'unlocked';
    currentData = data;
    const content = data.content_html ||
      (data.content_text ? `<pre class="pl-content-text">${esc(data.content_text)}</pre>` : `<div class="pl-status">${esc(t('empty'))}</div>`);
    app.innerHTML = `
      ${data.thumbnail_url ? `<div class="pl-cover"><img src="${esc(data.thumbnail_url)}" alt=""></div>` : `<div class="pl-cover"><i class="fa-solid fa-unlock"></i></div>`}
      <div class="pl-body">
        <span class="pl-kicker"><i class="fa-solid fa-circle-check"></i> ${t('verifiedKicker')}</span>
        <h1 class="pl-title">${esc(data.title || 'Payment Link')}</h1>
        ${data.description ? `<p class="pl-desc">${esc(data.description)}</p>` : ''}
        <div class="pl-status"><i class="fa-solid fa-unlock"></i> ${t('verified')}</div>
        <div class="pl-content">${content}</div>
      </div>`;
  }

  function syncDocumentLanguage(){
    const lang = currentLang();
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? 'Payment Link — ShowLink' : 'Payment Link — ShowLink';
    const loading = document.querySelector('[data-i18n="loading"]');
    if (loading) loading.textContent = t('loading');
    const theme = document.getElementById('pl-theme');
    const langButton = document.getElementById('pl-lang');
    if (theme) theme.setAttribute('aria-label', t('themeLabel'));
    if (langButton) langButton.setAttribute('aria-label', t('languageLabel'));
  }

  function setupControls(){
    const theme=document.getElementById('pl-theme');
    const lang=document.getElementById('pl-lang');
    const sync=()=>{
      const dark=document.documentElement.dataset.theme==='dark';
      if(theme) theme.innerHTML=dark?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';
      if(lang) lang.textContent=currentLang()==='en'?'ID':'EN';
    };
    theme?.addEventListener('click',()=>{
      const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
      document.documentElement.dataset.theme=next;
      document.documentElement.style.colorScheme=next;
      try{localStorage.setItem('showlink-theme',next);}catch(_){}
      sync();
      syncDocumentLanguage();
    });
    lang?.addEventListener('click',()=>{
      try{localStorage.setItem('showlink-language',currentLang()==='en'?'id':'en');}catch(_){}
      sync();
      syncDocumentLanguage();
      rerenderCurrent();
    });
    sync();
    syncDocumentLanguage();
  }

  async function load() {
    try {
      if (!slug) throw new Error(t('loadError'));

      dbg.log('PAYMENT LINK PUBLIC LOAD', {
        slug,
        pathname: window.location.pathname,
        routeSlug,
        injectedSlug,
        querySlug: qs.get('slug') || ''
      });
      const sb = await window.ShowLinkSupabase.load();

      const { data, error } = await sb.rpc('get_payment_link_by_slug', { p_slug: slug });
      dbg.log('PAYMENT LINK LOOKUP', { slug, data, error });

      if (error) throw error;
      if (!data) throw new Error(t('notFound'));

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

  // The shared ShowLink language control changes localStorage and then
  // broadcasts this event.  Payment Link must react immediately without
  // reloading the page or fetching the link again.
  window.addEventListener('showlink:language-change', () => {
    syncDocumentLanguage();
    rerenderCurrent();
    const lang = document.getElementById('pl-lang');
    if (lang) lang.textContent = currentLang() === 'en' ? 'ID' : 'EN';
  });

  // Also react to language changes made by another same-page component.
  window.addEventListener('storage', (event) => {
    if (event.key !== 'showlink-language') return;
    syncDocumentLanguage();
    rerenderCurrent();
  });

  setupControls();
  load();
})();
