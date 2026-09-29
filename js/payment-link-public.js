(() => {
  'use strict';

  const app = document.getElementById('app');
  const parts = window.location.pathname.split('/').filter(Boolean);
  const routeSlug = parts[0] === 'p' && parts[1] ? (() => { try { return decodeURIComponent(parts[1]); } catch (_) { return ''; } })() : '';
  const qs = new URLSearchParams(window.location.search);
  const injectedSlug = String(window.__SHOWLINK_PAYMENT_SLUG || '').trim();
  const slug = injectedSlug || routeSlug || String(qs.get('slug') || '').trim();
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

  const I18N = {
    id: {
      kicker:'PAYMENT LINK', locked:'Konten terkunci. Lakukan pembayaran untuk membuka konten.',
      buy:'Beli & Bayar', verified:'Pembayaran terverifikasi. Konten sudah terbuka.',
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
    const image = data.thumbnail_url;
    app.innerHTML = `
      ${image ? `<div class="pl-cover"><img src="${esc(image)}" alt=""></div>` : `<div class="pl-cover"><i class="fa-solid fa-credit-card"></i></div>`}
      <div class="pl-body">
        <span class="pl-kicker"><i class="fa-solid fa-credit-card"></i> ${t('kicker')}</span>
        <h1 class="pl-title">${esc(data.title || 'Payment Link')}</h1>
        ${data.description ? `<p class="pl-desc">${esc(data.description)}</p>` : ''}
        <div class="pl-meta">
          <div class="pl-meta-box"><span class="pl-meta-label">Judul / Title</span><span class="pl-meta-value">${esc(data.title || 'Payment Link')}</span></div>
          <div class="pl-meta-box"><span class="pl-meta-label">Harga / Price</span><span class="pl-meta-value">${money(data.price, data.currency || 'IDR')}</span></div>
        </div>
        <div class="pl-price">${money(data.price, data.currency || 'IDR')}</div>
        <button class="pl-buy" id="buy"><i class="fa-solid fa-lock-open"></i> ${t('buy')}</button>
        ${renderPaymentGuidance()}
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
      (data.content_text ? `<pre class="pl-content-text">${esc(data.content_text)}</pre>` : `<div class="pl-status">Konten kosong.</div>`);
    app.innerHTML = `
      ${data.thumbnail_url ? `<div class="pl-cover"><img src="${esc(data.thumbnail_url)}" alt=""></div>` : `<div class="pl-cover"><i class="fa-solid fa-unlock"></i></div>`}
      <div class="pl-body">
        <span class="pl-kicker"><i class="fa-solid fa-circle-check"></i> ${currentLang()==='en'?'PAYMENT VERIFIED':'PEMBAYARAN TERVERIFIKASI'}</span>
        <h1 class="pl-title">${esc(data.title || 'Payment Link')}</h1>
        ${data.description ? `<p class="pl-desc">${esc(data.description)}</p>` : ''}
        <div class="pl-status"><i class="fa-solid fa-unlock"></i> ${t('verified')}</div>
        <div class="pl-content">${content}</div>
      </div>`;
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
      load();
    });
    lang?.addEventListener('click',()=>{
      try{localStorage.setItem('showlink-language',currentLang()==='en'?'id':'en');}catch(_){}
      sync(); load();
    });
    sync();
  }

  async function load() {
    try {
      if (!slug) throw new Error('Kode Payment Link tidak ditemukan di URL.');

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

  setupControls();
  load();
})();
