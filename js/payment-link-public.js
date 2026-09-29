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
    else if (currentView === 'payment') renderCashiPayment(
      currentData.data, currentData.result, currentData.sb,
      currentData.orderId, currentData.token, currentData.isUser
    );
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
      support:'Mendukung pembayaran melalui bank dan e-wallet yang tersedia pada gateway pembayaran.'
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
      support:'Supports bank and e-wallet payment methods available through the payment gateway.'
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
      startPayment(data).catch(error => {
        dbg.error('PAYMENT LINK INLINE PAYMENT FAILED', error);
        renderPaymentError(error?.message || 'Pembayaran gagal dibuat.');
      });
    });
  }


  async function apiHeaders(sb) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': window.SHOWLINK_SUPABASE.anonKey
    };
    const { data } = await sb.auth.getSession();
    const accessToken = data?.session?.access_token;
    // Supabase Edge Functions may still enforce the JWT gateway when an
    // older deployment has not picked up config.toml yet.  Always provide a
    // valid Supabase JWT in Authorization; for guests this is the public anon
    // key, while logged-in users use their real access-token.
    headers.Authorization = `Bearer ${accessToken || window.SHOWLINK_SUPABASE.anonKey}`;
    return headers;
  }

  async function sessionUser(sb) {
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  async function createCashiPayment(orderId, sb, token, isUser) {
    const fn = `${window.SHOWLINK_SUPABASE.url}/functions/v1/cashi-create-payment`;
    const resp = await fetch(fn, {
      method: 'POST',
      headers: await apiHeaders(sb),
      body: JSON.stringify({
        order_id: orderId,
        guest_access_token: isUser ? undefined : token
      })
    });
    const raw = await resp.text();
    let result = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch (_) {
      result = { message: raw };
    }
    if (!resp.ok) {
      const detail = result.error || result.message || result.msg ||
        result.code || `HTTP ${resp.status}`;
      throw new Error(`Cashi create payment gagal (${resp.status}): ${detail}`);
    }
    if (result.success === false) {
      throw new Error(result.error || result.message || 'Cashi menolak pembuatan pembayaran.');
    }
    return result;
  }

  function renderPaymentError(message) {
    currentView = 'error';
    currentData = message || '';
    app.innerHTML = `<div class="pl-body">
      <div class="pl-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <h2>${esc(t('notAvailable'))}</h2>
        <p>${esc(message || 'Pembayaran gagal dibuat.')}</p>
        <button class="pl-buy" id="retry-payment" type="button"><i class="fa-solid fa-rotate-right"></i> ${esc(currentLang()==='en'?'Try again':'Coba lagi')}</button>
      </div>
    </div>`;
    document.getElementById('retry-payment')?.addEventListener('click', () => {
      if (currentData && typeof currentData === 'object') startPayment(currentData);
      else load();
    });
  }

  function renderCashiPayment(data, result, sb, orderId, token, isUser) {
    currentView = 'payment';
    currentData = { data, result, sb, orderId, token, isUser };
    const amount = Number(result.amount ?? data.price ?? 0);
    const qr = result.qr_url || result.qrUrl || '';
    const checkout = result.checkout_url || '';
    app.innerHTML = `
      ${data.thumbnail_url ? `<div class="pl-cover"><img src="${esc(data.thumbnail_url)}" alt=""></div>` : `<div class="pl-cover"><i class="fa-solid fa-qrcode"></i></div>`}
      <div class="pl-body">
        <span class="pl-kicker"><i class="fa-solid fa-qrcode"></i> CASHI</span>
        <h1 class="pl-title">${esc(currentLang()==='en'?'Complete payment':'Selesaikan pembayaran')}</h1>
        <p class="pl-desc">${esc(currentLang()==='en'
          ? 'Scan the QR and complete the payment. Stay on this page until verification is successful.'
          : 'Scan QR dan selesaikan pembayaran. Tetap di halaman ini sampai verifikasi berhasil.')}</p>
        <div class="pl-meta">
          <div class="pl-meta-box"><span class="pl-meta-label">${esc(t('titleLabel'))}</span><span class="pl-meta-value">${esc(data.title || 'Payment Link')}</span></div>
          <div class="pl-meta-box"><span class="pl-meta-label">${esc(t('priceLabel'))}</span><span class="pl-meta-value">${money(amount, data.currency || 'IDR')}</span></div>
        </div>
        ${qr ? `<div style="text-align:center;margin:22px 0">
          <img src="${esc(qr)}" alt="QR pembayaran Cashi" style="display:block;max-width:320px;width:100%;margin:auto;border-radius:18px;background:#fff;padding:10px;box-sizing:border-box">
        </div>` : ''}
        ${checkout ? `<a class="pl-buy" href="${esc(checkout)}" target="_blank" rel="noopener noreferrer" style="display:flex;text-decoration:none;justify-content:center;align-items:center;gap:8px">
          ${esc(currentLang()==='en'?'Open Cashi':'Buka Cashi')} <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>` : ''}
        <button class="pl-buy" id="check-payment" type="button" style="margin-top:10px">
          <i class="fa-solid fa-circle-check"></i> ${esc(currentLang()==='en'?'Check Payment':'Cek Pembayaran')}
        </button>
        <div class="pl-status" id="payment-status">${esc(currentLang()==='en'?'Waiting for payment confirmation…':'Menunggu konfirmasi pembayaran…')}</div>
        ${renderPaymentGuidance()}
      </div>`;

    document.getElementById('check-payment')?.addEventListener('click', () => {
      checkCashiPayment(orderId, sb, token, isUser);
    });

    pollCashiPayment(orderId, sb, token, isUser);
  }

  async function unlockAfterPayment(sb, token) {
    const { data: access, error } = await sb.rpc('get_paid_content', {
      p_payment_link_slug: slug,
      p_guest_access_token: token || null
    });
    if (error) throw error;
    if (!access?.unlocked) throw new Error(currentLang()==='en'
      ? 'Payment is verified, but content access is not ready yet. Please check payment again.'
      : 'Pembayaran sudah terverifikasi, tetapi akses konten belum siap. Silakan cek pembayaran lagi.');
    renderUnlocked({ ...(currentData?.data || currentData || {}), ...access });
  }

  async function checkCashiPayment(orderId, sb, token, isUser) {
    const status = document.getElementById('payment-status');
    if (status) status.textContent = currentLang()==='en' ? 'Checking payment…' : 'Memeriksa pembayaran…';

    try {
      const fn = `${window.SHOWLINK_SUPABASE.url}/functions/v1/cashi-check-status`;
      const resp = await fetch(fn, {
        method: 'POST',
        headers: await apiHeaders(sb),
        body: JSON.stringify({
          order_id: orderId,
          guest_access_token: isUser ? undefined : token
        })
      });
      const raw = await resp.text();
      let result = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch (_) {
        result = { message: raw };
      }
      if (!resp.ok) {
        const detail = result.error || result.message || result.msg ||
          result.code || `HTTP ${resp.status}`;
        throw new Error(`Cek Cashi gagal (${resp.status}): ${detail}`);
      }
      if (result.success === false) {
        throw new Error(result.error || result.message || 'Cashi belum mengonfirmasi pembayaran.');
      }

      if (result.paid === true || String(result.status || '').toUpperCase() === 'SETTLED') {
        if (status) status.textContent = currentLang()==='en' ? 'Payment verified. Unlocking content…' : 'Pembayaran berhasil. Membuka konten…';
        await unlockAfterPayment(sb, token);
        return true;
      }

      if (status) status.textContent = `${currentLang()==='en'?'Payment status':'Status pembayaran'}: ${result.status || 'PENDING'}. ${currentLang()==='en'?'Waiting for confirmation…':'Menunggu konfirmasi…'}`;
      return false;
    } catch (error) {
      if (status) {
        status.className = 'pl-status error';
        status.textContent = error?.message || (currentLang()==='en' ? 'Payment check failed.' : 'Cek pembayaran gagal.');
      }
      return false;
    }
  }

  async function pollCashiPayment(orderId, sb, token, isUser) {
    // Poll gently while keeping the user on /p/{slug}. Manual "Cek Pembayaran"
    // remains available and uses the same authoritative Edge Function.
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (currentView !== 'payment') return;
      const done = await checkCashiPayment(orderId, sb, token, isUser);
      if (done) return;
    }
  }

  async function startPayment(data) {
    const btn = document.getElementById('buy');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esc(currentLang()==='en'?'Creating payment…':'Membuat pembayaran…')}`;
    }

    try {
      const sb = await window.ShowLinkSupabase.load();
      const user = await sessionUser(sb);
      const token = user ? '' : guestToken();

      const { data: order, error } = await sb.rpc('create_checkout_order', {
        p_payment_link_id: data.id,
        p_guest_access_token: user ? null : token
      });
      if (error) throw error;

      if (order?.already_accessible === true) {
        await unlockAfterPayment(sb, token);
        return;
      }

      const orderId = order?.order_id || order?.id;
      if (!orderId) throw new Error('Order tidak berhasil dibuat.');

      const result = await createCashiPayment(orderId, sb, token, !!user);
      if (result.already_paid) {
        await unlockAfterPayment(sb, token);
        return;
      }

      if (!result.qr_url && !result.qrUrl && !result.checkout_url) {
        throw new Error('Cashi tidak mengembalikan QR atau halaman pembayaran.');
      }

      renderCashiPayment(data, result, sb, orderId, token, !!user);
    } catch (error) {
      dbg.error('INLINE CASHI PAYMENT FAILED', error);
      renderPaymentError(error?.message || 'Pembayaran gagal dibuat.');
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
