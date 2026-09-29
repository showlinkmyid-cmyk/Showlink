(() => {
  'use strict';
  const app=document.getElementById('app');
  const slug=location.pathname.split('/').filter(Boolean)[1]||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const urlize=s=>esc(s).replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,m=>{
    const href=m.toLowerCase().startsWith('www.')?'https://'+m:m;
    return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${m}</a>`;
  });
  const getPlan=async sb=>{
    try{
      const {data}=await sb.auth.getSession();
      const uid=data?.session?.user?.id;
      if(!uid) return 'free';
      const {data:p}=await sb.from('profiles').select('plan').eq('id',uid).maybeSingle();
      return ['vip','premium'].includes(p?.plan)?p.plan:'free';
    }catch(_){return 'free'}
  };
  const taskCount=plan=>plan==='premium'?1:plan==='vip'?2:3;
  const tr={
    id:{k:'SHORTLINK',free:'Lanjut dengan FREE',direct:'Lanjut dengan Langsung Akses',mission:'Misi akses gratis',final:'FINAL',open:'Buka Task',done:'Saya sudah selesai',next:'Lanjut ke tahap berikutnya',content:'Konten asli',payment:'Pembayaran',noPay:'Payment Link belum dikonfigurasi.',warning:'Selesaikan semua tahap sesuai paket akun kamu sebelum membuka konten asli.',guest:'FREE · 3 Task',vip:'VIP · 2 Task',premium:'PREMIUM · 1 Task'},
    en:{k:'SHORTLINK',free:'Continue with FREE',direct:'Continue with Direct Access',mission:'Free access missions',final:'FINAL',open:'Open Task',done:'I have completed it',next:'Continue to next step',content:'Original content',payment:'Payment',noPay:'Payment Link is not configured.',warning:'Complete all steps required by your account plan before opening the original content.',guest:'FREE · 3 Tasks',vip:'VIP · 2 Tasks',premium:'PREMIUM · 1 Task'}
  };
  const lang=()=>localStorage.getItem('showlink-language')==='en'?'en':'id';
  const planLabel=p=>tr[lang()][p==='premium'?'premium':p==='vip'?'vip':'guest'];
  const stateKey=id=>`sl_flow_${id}`;
  function stateFor(id){
    try{return JSON.parse(sessionStorage.getItem(stateKey(id))||'{"mode":null,"step":0,"final":false}')}catch(_){return {mode:null,step:0,final:false}}
  }
  function save(id,s){sessionStorage.setItem(stateKey(id),JSON.stringify(s))}
  function renderChoice(data,plan){
    const x=tr[lang()];
    app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-link"></i> ${x.k}</span>
      <h1 class="pf-title">${esc(data.title)}</h1>
      ${data.description?`<p class="pf-desc">${urlize(data.description)}</p>`:''}
      <div class="pf-short-info">${planLabel(plan)}</div>
      <div class="pf-content-preview">${urlize(data.content_text||data.destination_url||'')}</div>
      <div class="pf-warning"><i class="fa-solid fa-triangle-exclamation"></i><span>${x.warning}</span></div>
      <div class="pf-choice-grid">
        <button class="pf-btn" id="free"><i class="fa-solid fa-list-check"></i>${x.free}</button>
        ${data.payment_url?`<button class="pf-btn alt" id="direct"><i class="fa-solid fa-bolt"></i>${x.direct}</button>`:`<div class="pf-status">${x.noPay}</div>`}
      </div>`;
    document.getElementById('free').onclick=()=>startFree(data,plan);
    document.getElementById('direct')?.addEventListener('click',()=>location.href=data.payment_url);
  }
  function renderFree(data,plan){
    const x=tr[lang()], count=taskCount(plan), list=Array.isArray(data.tasks)?data.tasks.slice(0,count):[];
    const s=stateFor(data.id);
    if(s.mode!=='free'){s.mode='free';s.step=0;s.final=false;save(data.id,s)}
    if(s.final) return renderContent(data);
    if(s.step>=count) return renderFinal(data);
    const i=s.step, task=list[i]||{title:`Task ${i+1}`,description:'Selesaikan task ini.',url:''};
    app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-list-check"></i> ${x.mission}</span>
      <h1 class="pf-title">${esc(data.title)}</h1>
      <div class="pf-progress"><span style="width:${Math.round((i/(count+1))*100)}%"></span></div>
      <div class="pf-short-info">${planLabel(plan)} · ${i+1}/${count}</div>
      <div class="pf-task"><div class="pf-task-no">${i+1}</div><div><h3>${esc(task.title||`Task ${i+1}`)}</h3><p>${esc(task.description||'')}</p>${task.url?`<a class="pf-task-open" href="${esc(task.url)}" target="_blank" rel="noopener">${x.open} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:''}</div></div>
      <button class="pf-btn" id="done"><i class="fa-solid fa-check"></i>${x.done}</button>`;
    document.getElementById('done').onclick=()=>{s.step++;save(data.id,s);renderFree(data,plan)};
  }
  function renderFinal(data){
    const x=tr[lang()];
    app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-flag-checkered"></i> ${x.final}</span>
      <h1 class="pf-title">${esc(data.title)}</h1>
      <p class="pf-desc">${x.warning}</p>
      <button class="pf-btn" id="final"><i class="fa-solid fa-unlock"></i>${x.next}</button>`;
    document.getElementById('final').onclick=()=>{const s=stateFor(data.id);s.final=true;save(data.id,s);renderContent(data)};
  }
  function renderContent(data){
    const x=tr[lang()];
    const content=data.content_text||data.destination_url||'';
    app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-circle-check"></i> ${x.content}</span>
      <h1 class="pf-title">${esc(data.title)}</h1>
      <div class="pf-content">${urlize(content)}</div>`;
  }
  async function startFree(data,plan){renderFree(data,plan)}
  async function load(){
    try{
      const sb=await window.ShowLinkSupabase.load();
      const {data,error}=await sb.rpc('get_public_shortlink',{p_slug:slug});
      if(error) throw error;
      if(!data?.ok) throw new Error(data?.error||'Shortlink tidak tersedia.');
      const plan=await getPlan(sb);
      renderChoice(data,plan);
    }catch(e){app.innerHTML=`<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Shortlink tidak tersedia</h2><p>${esc(e.message||'Terjadi kesalahan.')}</p></div>`}
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-lang-option]'))setTimeout(load,30)});
  document.addEventListener('DOMContentLoaded',load);
})();