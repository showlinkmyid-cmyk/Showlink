(() => {
  'use strict';
  const app=document.getElementById('app');
  const pathParts=location.pathname.split('/').filter(Boolean);
  const params=new URLSearchParams(location.search);
  const slug=String(window.__SHOWLINK_SHORTLINK_SLUG||pathParts[1]||params.get('slug')||'').trim();
  const unlocked=params.get('unlocked')==='1';

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const urlize=s=>esc(s).replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,m=>{
    const href=m.toLowerCase().startsWith('www.')?'https://'+m:m;
    return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${m}</a>`;
  });
  const getPlan=async sb=>{
    try{
      const {data}=await sb.auth.getSession(); const uid=data?.session?.user?.id;
      if(!uid)return 'free';
      const {data:p}=await sb.from('profiles').select('plan').eq('id',uid).maybeSingle();
      return ['vip','premium'].includes(p?.plan)?p.plan:'free';
    }catch(_){return 'free';}
  };
  const taskCount=plan=>plan==='premium'?1:plan==='vip'?2:3;
  const tr={
    id:{k:'SHORTLINK',choose:'Pilih Untuk Membukanya',free:'Buka Gratis (iklan)',
      direct:'Buka Langsung (no iklan)',
      freeDetail:'Selesaikan Task sesuai paket akun. FREE: Task 1 → Task 2 → Task 3 → FINAL.',
      vipDetail:'Tanpa alur FREE. VIP: Task 1 → Task 2 → FINAL.',
      premiumDetail:'Tanpa alur FREE. PREMIUM: Task 1 → FINAL.',
      warningTitle:'Peringatan',
      warning:'Periksa judul dan pilihan akses sebelum melanjutkan. Jangan menutup halaman saat proses Task berlangsung.',
      paymentMissing:'Buka Langsung belum dikonfigurasi untuk Shortlink ini.',
      task:'Task',noAds:'Tanpa iklan',ads:'Dengan iklan'},
    en:{k:'SHORTLINK',choose:'Choose How to Open',free:'Open Free (ads)',
      direct:'Open Directly (no ads)',
      freeDetail:'Complete the tasks required by your account. FREE: Task 1 → Task 2 → Task 3 → FINAL.',
      vipDetail:'No FREE flow. VIP: Task 1 → Task 2 → FINAL.',
      premiumDetail:'No FREE flow. PREMIUM: Task 1 → FINAL.',
      warningTitle:'Warning',
      warning:'Check the title and access option before continuing. Do not close the page while completing tasks.',
      paymentMissing:'Direct access has not been configured for this Shortlink.',
      task:'Task',noAds:'No ads',ads:'With ads'}
  };
  const lang=()=>localStorage.getItem('showlink-language')==='en'||localStorage.getItem('showlink-lang')==='en'?'en':'id';

  function saveFlow(data,plan){
    try{
      const payload={slug:data.slug,title:data.title,description:data.description||'',plan};
      if(data.id!=null)sessionStorage.setItem(`showlink-shortlink-choice:${data.id}`,JSON.stringify(payload));
    }catch(_){}
  }

  async function recordFinalViewOnce(sb){
    const k='showlink-shortlink-final-view:'+slug;
    try{if(sessionStorage.getItem(k)==='1')return;}catch(_){}
    try{
      const {data,error}=await sb.rpc('track_shortlink_final_event',{
        p_slug:slug,p_event_name:'page_view',p_ad_slot:null
      });
      if(error)throw error;
      if(data?.ok===false)throw new Error(data.error||'Analytics gagal');
      try{sessionStorage.setItem(k,'1')}catch(_){}
    }catch(err){console.warn('[ShowLink] Final analytics:',err);}
  }

  function renderUnlocked(data){
    const title=data.title||'Shortlink',description=data.description||'',content=data.content_text??'';
    app.dataset.showlinkShortlinkState='unlocked';
    app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-circle-check"></i> SHORTLINK TERBUKA</span>
      <h1 class="pf-title">${esc(title)}</h1>
      ${description?`<p class="pf-desc">${urlize(description)}</p>`:''}
      <div class="showlink-unlocked-content">
        <div class="showlink-unlocked-badge"><i class="fa-solid fa-circle-check"></i> Konten berhasil dibuka</div>
        <div class="showlink-content-text">${urlize(content)}</div>
      </div>`;
  }

  function renderChoice(data,plan){
    const x=tr[lang()],count=taskCount(plan);
    const planText=plan==='premium'?'PREMIUM':plan==='vip'?'VIP':'FREE';
    const detail=plan==='premium'?x.premiumDetail:plan==='vip'?x.vipDetail:x.freeDetail;
    app.dataset.showlinkShortlinkState='locked';
    app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-link"></i> ${x.k}</span>
      <h1 class="pf-title">${esc(data.title)}</h1>
      ${data.description?`<p class="pf-desc">${urlize(data.description)}</p>`:''}
      <div class="pf-short-info"><strong>${esc(planText)}</strong> · ${x.task} ${count}</div>
      <div class="pf-choice-heading">${x.choose}</div>
      <div class="pf-choice-card free-choice">
        <div class="pf-choice-icon"><i class="fa-solid fa-list-check"></i></div>
        <div class="pf-choice-copy"><h3>${x.free}</h3><p>${detail}</p><span>${x.ads}</span></div>
        <button class="pf-btn" id="free" type="button"><i class="fa-solid fa-arrow-right"></i>${x.free}</button>
      </div>
      <div class="pf-choice-card direct-choice ${data.payment_url?'':'disabled'}">
        <div class="pf-choice-icon"><i class="fa-solid fa-bolt"></i></div>
        <div class="pf-choice-copy"><h3>${x.direct}</h3><p>${data.payment_url?x.noAds:x.paymentMissing}</p>${data.payment_url?`<span>${x.noAds}</span>`:''}</div>
        ${data.payment_url?`<button class="pf-btn alt" id="direct" type="button"><i class="fa-solid fa-bolt"></i>${x.direct}</button>`:''}
      </div>
      <div class="pf-warning"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>${x.warningTitle}</strong><p>${x.warning}</p></div></div>`;
    document.getElementById('free').onclick=()=>{
      saveFlow(data,plan);
      location.href=`/task1.html?slug=${encodeURIComponent(data.slug)}&plan=${encodeURIComponent(plan)}`;
    };
    document.getElementById('direct')?.addEventListener('click',()=>{location.href=data.payment_url;});
  }

  async function load(){
    if(!slug){app.innerHTML=`<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Shortlink tidak tersedia</h2><p>Slug Shortlink tidak ditemukan.</p></div>`;return;}
    try{
      const sb=await window.ShowLinkSupabase.load();
      const {data:rpcData,error}=await sb.rpc('get_public_shortlink',{p_slug:slug});
      if(error)throw error;
      let data=rpcData;
      if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){}}
      if(Array.isArray(data))data=data[0]||null;
      if(!data)throw new Error('Shortlink tidak tersedia.');
      if(data.ok===false)throw new Error(data.error||'Shortlink tidak tersedia.');
      const paymentUrl=String(data.payment_url??data.paymentUrl??data.direct_url??data.direct_url_no_ads??data.no_ads_url??'').trim();
      data={...data,payment_url:paymentUrl};
      if(!data.slug&&!data.id)throw new Error('Data Shortlink tidak lengkap.');

      if(unlocked){
        const {data:contentData,error:contentError}=await sb.rpc('get_public_shortlink_content',{p_slug:slug});
        if(contentError)throw contentError;
        let unlockedData=contentData;
        if(typeof unlockedData==='string'){try{unlockedData=JSON.parse(unlockedData);}catch(_){}}
        if(Array.isArray(unlockedData))unlockedData=unlockedData[0]||null;
        if(!unlockedData?.ok)throw new Error(unlockedData?.error||'Konten Shortlink tidak tersedia.');
        await recordFinalViewOnce(sb);
        renderUnlocked(unlockedData);
        return;
      }
      renderChoice(data,await getPlan(sb));
    }catch(e){
      app.innerHTML=`<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Shortlink tidak tersedia</h2><p>${esc(e.message||'Terjadi kesalahan.')}</p></div>`;
    }
  }

  document.addEventListener('click',e=>{if(e.target.closest('[data-lang-option]'))setTimeout(load,50);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
