(() => {
  'use strict';
  const app=document.getElementById('app');
  const parts=location.pathname.split('/').filter(Boolean);
  const type=parts[1]||'';const slug=parts[2]||'';const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const guestToken=()=>localStorage.getItem('showlink_guest_token')||'';
  const safeUrl=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:null}catch{return null}};
  async function load(){
    try{const sb=await window.ShowLinkSupabase.load();if(type==='payment'){await payment(sb);return}const rpc=type==='shortlink'?'get_public_shortlink':'get_public_sub4unlock';const {data,error}=await sb.rpc(rpc,{p_slug:slug});if(error)throw error;if(!data?.ok)throw new Error('Konten tidak ditemukan.');showDestination(data);}
    catch(e){app.innerHTML=`<div class="pf-loader"><i class="fa-solid fa-lock"></i><h2>Akses konten gagal</h2><p>${esc(e.message||'Konten tidak tersedia.')}</p></div>`;}}
  function showDestination(data){const u=safeUrl(data.destination_url);app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-unlock"></i> CONTENT UNLOCKED</span><h1 class="pf-title">${esc(data.title||'Konten Asli')}</h1><p class="pf-desc">Akses berhasil melewati proses ${type==='shortlink'?'Shortlink':'Sub4unlock'}.</p>${u?`<a class="pf-btn" style="display:block;text-align:center;text-decoration:none" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Buka Konten Asli <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:`<div class="pf-status">Konten tidak memiliki URL yang valid.</div>`}`;}
  async function payment(sb){const q=new URLSearchParams(location.search);const {data,error}=await sb.rpc('get_paid_content',{p_payment_link_slug:slug,p_guest_access_token:guestToken()||null});if(error)throw error;if(!data||data.requires_payment){location.replace(`/p/${encodeURIComponent(slug)}`);return}app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-unlock"></i> PAID CONTENT</span><h1 class="pf-title">${esc(data.title||'Konten Asli')}</h1><div class="pf-content">${data.content_html||data.content_text? (data.content_html||`<pre>${esc(data.content_text)}</pre>`) : '<div class="pf-status">Konten kosong.</div>'}</div>`;}
  load();
})();
