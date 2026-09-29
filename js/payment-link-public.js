(() => {
  'use strict';
  const app = document.getElementById('app');
  const parts = window.location.pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'p' && parts[1] ? decodeURIComponent(parts[1]) : '';
  const dbg = window.ShowLinkDebug || {log:()=>{},warn:()=>{},error:()=>{}};
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
  const guestToken = () => {
    let t=localStorage.getItem('showlink_guest_token');
    if(!t){ try{t=crypto.randomUUID()}catch(_){t='guest-'+Date.now()+'-'+Math.random().toString(36).slice(2)} localStorage.setItem('showlink_guest_token',t); }
    return t;
  };
  const currentGuestToken=()=>localStorage.getItem('showlink_guest_token')||'';
  function renderError(m){app.innerHTML=`<div class="pf-body"><div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>PasteLink tidak tersedia</h2><p>${esc(m||'Kode PasteLink tidak ditemukan atau sudah tidak aktif.')}</p></div></div>`;}
  function renderFree(data){
    const image=data.thumbnail_url;
    const content=data.content_html||(data.content_text?`<pre class="pf-content-text">${esc(data.content_text)}</pre>`:'<div class="pf-status">Konten kosong.</div>');
    app.innerHTML=`${image?`<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`:''}<div class="pf-body"><span class="pf-kicker"><i class="fa-solid fa-link"></i> PASTELINK</span><h1 class="pf-title">${esc(data.title||'PasteLink')}</h1>${data.description?`<p class="pf-desc">${esc(data.description)}</p>`:''}<div class="pf-content">${content}</div></div>`;
  }
  function renderLocked(data){
    const image=data.thumbnail_url;
    app.innerHTML=`${image?`<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`:'<div class="pf-cover"><i class="fa-solid fa-lock"></i></div>'}<div class="pf-body"><span class="pf-kicker"><i class="fa-solid fa-lock"></i> PAID PASTELINK</span><h1 class="pf-title">${esc(data.title||'Konten Premium')}</h1>${data.description?`<p class="pf-desc">${esc(data.description)}</p>`:''}<div class="pf-status" style="margin:18px 0"><i class="fa-solid fa-shield-halved"></i> Konten ini terkunci. Bayar untuk membuka akses.</div><div class="pf-price">${money(data.price)}</div><button class="pf-btn" id="buy">Beli &amp; Buka Konten <i class="fa-solid fa-arrow-right"></i></button><div class="pf-status">Setelah pembayaran berhasil diverifikasi, halaman ini akan terbuka otomatis.</div></div>`;
    document.getElementById('buy').onclick=()=>{const token=guestToken();const u=`/payment-public?slug=${encodeURIComponent(data.payment_link_slug)}&return_slug=${encodeURIComponent(slug)}&guest_token=${encodeURIComponent(token)}`;dbg.log('BUY CLICK',u);location.href=u;};
  }
  function renderUnlocked(data){
    const image=data.thumbnail_url;
    const content=data.content_html||(data.content_text?`<pre class="pf-content-text">${esc(data.content_text)}</pre>`:'<div class="pf-status">Konten kosong.</div>');
    app.innerHTML=`${image?`<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`:''}<div class="pf-body"><span class="pf-kicker"><i class="fa-solid fa-unlock"></i> CONTENT UNLOCKED</span><h1 class="pf-title">${esc(data.title||'Konten Premium')}</h1>${data.description?`<p class="pf-desc">${esc(data.description)}</p>`:''}<div class="pf-status" style="margin:16px 0"><i class="fa-solid fa-circle-check"></i> Pembayaran terverifikasi. Konten sudah terbuka.</div><div class="pf-content">${content}</div></div>`;
  }
  async function load(){
    try{
      if(!slug) throw new Error('Kode PasteLink tidak ditemukan di URL.');
      const sb=await window.ShowLinkSupabase.load();
      const {data,error}=await sb.rpc('get_pastelink_by_slug',{p_slug:slug});
      dbg.log('PASTELINK LOOKUP',{slug,data,error});
      if(error) throw error;
      if(!data) throw new Error('Kode PasteLink tidak ditemukan atau sudah tidak aktif.');
      if(!data.is_paid){renderFree(data);return;}
      const token=currentGuestToken();
      const {data:access,error:accessError}=await sb.rpc('get_paid_content',{p_payment_link_slug:data.payment_link_slug,p_guest_access_token:token||null});
      dbg.log('PAID ACCESS',{access,accessError});
      if(accessError) throw accessError;
      if(access?.unlocked===true){renderUnlocked({...data,...access});return;}
      renderLocked(data);
    }catch(e){dbg.error('PASTELINK LOAD FAILED',e);renderError(e.message);}
  }
  load();
})();
