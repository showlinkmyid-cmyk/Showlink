(() => {
  'use strict';
  const app=document.getElementById('app');
  const slug=location.pathname.split('/').filter(Boolean)[1]||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const listify=v=>Array.isArray(v)?v:[];
  async function load(){
    try{
      const sb=await window.ShowLinkSupabase.load();
      const {data,error}=await sb.rpc('get_public_sub4unlock',{p_slug:slug});
      if(error)throw error;if(!data?.ok)throw new Error('Sub4unlock tidak ditemukan atau sudah tidak aktif.');
      const list=listify(data.tasks), key=`s4u_tasks_${data.id}`, state=new Set(JSON.parse(sessionStorage.getItem(key)||'[]'));
      render(data,list,state,key);
    }catch(e){app.innerHTML=`<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Sub4unlock tidak tersedia</h2><p>${esc(e.message||'Terjadi kesalahan.')}</p></div>`;}
  }
  function render(data,list,state,key){
    app.innerHTML=`<span class="pf-kicker"><i class="fa-solid fa-unlock-keyhole"></i> SUB4UNLOCK</span><h1 class="pf-title">${esc(data.title)}</h1><p class="pf-desc">Selesaikan task Sub4Sub untuk membuka konten asli.</p><div>${list.length?list.map((t,i)=>`<div class="pf-task ${state.has(i)?'done':''}"><div class="pf-task-no">${state.has(i)?'✓':i+1}</div><div><h3>${esc(t.title||`Task ${i+1}`)}</h3><p>${esc(t.description||'Selesaikan task ini.')}</p>${t.url?`<a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" data-task="${i}">Buka task <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:''}</div></div>`).join(''):'<div class="pf-status">Belum ada task yang dikonfigurasi.</div>'}</div><div class="pf-final"><button class="pf-btn" id="continue" ${list.length&&state.size<list.length?'disabled':''}>Buka konten asli <i class="fa-solid fa-unlock"></i></button><div class="pf-status">${list.length?'Semua task harus selesai sebelum lanjut.':'Siap membuka konten.'}</div></div>`;
    document.querySelectorAll('[data-task]').forEach(a=>a.addEventListener('click',()=>{const i=Number(a.dataset.task);state.add(i);sessionStorage.setItem(key,JSON.stringify([...state]));setTimeout(()=>render(data,list,state,key),150);}));
    document.getElementById('continue').addEventListener('click',()=>{if(list.length&&state.size<list.length)return;location.href=`/content/sub4unlock/${encodeURIComponent(data.slug)}`;});
  }
  load();
})();
