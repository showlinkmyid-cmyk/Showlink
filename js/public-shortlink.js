(() => {
  'use strict';
  const app = document.getElementById('app');
  const slug = location.pathname.split('/').filter(Boolean)[1] || '';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const tasks = raw => Array.isArray(raw) ? raw : [];
  const taskHtml = (task, i, done) => `<div class="pf-task ${done?'done':''}" data-task="${i}"><div class="pf-task-no">${done?'✓':i+1}</div><div><h3>${esc(task.title || `Task ${i+1}`)}</h3><p>${esc(task.description || 'Selesaikan task ini sebelum lanjut.')}</p>${task.url ? `<a href="${esc(task.url)}" target="_blank" rel="noopener noreferrer" data-open-task="${i}">Buka task <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:''}</div></div>`;
  async function load(){
    try {
      const sb = await window.ShowLinkSupabase.load();
      const {data,error} = await sb.rpc('get_public_shortlink',{p_slug:slug});
      if(error) throw error;
      if(!data?.ok) throw new Error('Shortlink tidak ditemukan atau sudah tidak aktif.');
      const list = tasks(data.tasks);
      const state = {completed:new Set(JSON.parse(sessionStorage.getItem(`sl_tasks_${data.id}`)||'[]'))};
      render(data,list,state);
    } catch(e) { app.innerHTML = `<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Shortlink tidak tersedia</h2><p>${esc(e.message || 'Terjadi kesalahan.')}</p></div>`; }
  }
  function render(data,list,state){
    app.innerHTML = `<span class="pf-kicker"><i class="fa-solid fa-link"></i> SHORTLINK</span><h1 class="pf-title">${esc(data.title)}</h1><p class="pf-desc">Selesaikan semua task untuk membuka konten asli.</p><div id="tasks">${list.length ? list.map((t,i)=>taskHtml(t,i,state.completed.has(i))).join('') : '<div class="pf-status">Belum ada task yang dikonfigurasi. Kamu bisa lanjut ke konten.</div>'}</div><div class="pf-final"><button class="pf-btn" id="continue" ${list.length && state.completed.size<list.length?'disabled':''}>Lanjut ke konten asli <i class="fa-solid fa-arrow-right"></i></button><div class="pf-status" id="status">${list.length?'Selesaikan semua task terlebih dahulu.':'Siap membuka konten.'}</div></div>`;
    list.forEach((task,i)=>document.querySelector(`[data-open-task="${i}"]`)?.addEventListener('click',()=>{ state.completed.add(i); sessionStorage.setItem(`sl_tasks_${data.id}`,JSON.stringify([...state.completed])); setTimeout(()=>render(data,list,state),150); }));
    document.getElementById('continue').addEventListener('click',()=>{
      if(list.length && state.completed.size<list.length) return;
      location.href=`/content/shortlink/${encodeURIComponent(data.slug)}`;
    });
  }
  load();
})();
