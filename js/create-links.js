(() => {
  'use strict';
  const form=document.getElementById('create-link-form'); if(!form) return;
  const type=form.dataset.type, result=document.getElementById('create-result'), btn=form.querySelector('button[type="submit"]');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const parseTasks=()=>{try{const v=JSON.parse(form.querySelector('[name="tasks"]')?.value||'[]');if(!Array.isArray(v))throw 0;return v.filter(x=>x&&x.title).map(x=>({title:String(x.title),description:String(x.description||''),url:String(x.url||'')}));}catch{return null;}};
  form.addEventListener('submit',async e=>{e.preventDefault();btn.disabled=true;result.className='pf-status';result.textContent='Menyimpan…';try{const sb=await window.ShowLinkSupabase.load();const {data:session}=await sb.auth.getSession();const uid=session?.session?.user?.id;if(!uid) throw new Error('Sesi login tidak ditemukan.');
      const fd=new FormData(form);let link;
      if(type==='payment'){
        const {data,error}=await sb.rpc('create_payment_link',{p_title:fd.get('title'),p_description:fd.get('description')||null,p_price:Number(fd.get('price')),p_pastelink_id:null,p_content_html:fd.get('content_html')||null,p_content_text:fd.get('content_text')||null,p_thumbnail_url:fd.get('thumbnail_url')||null});if(error)throw error;link=Array.isArray(data)?data[0]:data;}
      else {
        const tasks=parseTasks(); if(tasks===null) throw new Error('Format Tasks JSON tidak valid.');
        const table=type==='shortlink'?'showlink_shortlinks':'showlink_sub4unlock_links';
        const slug=await makeSlug(sb);
        const {data,error}=await sb.from(table).insert({owner_id:uid,title:String(fd.get('title')),slug,destination_url:String(fd.get('destination_url')),tasks,status:'active'}).select('slug').single();if(error)throw error;link={slug:data.slug};
      }
      const prefix=type==='shortlink'?'/s/':type==='payment'?'/p/':'/u/';const url=`${location.origin}${prefix}${link.slug}`;
      result.className='pf-status success';result.innerHTML=`Berhasil dibuat.<br><strong>${esc(url)}</strong><br><a href="${esc(url)}" target="_blank" rel="noopener">Buka link</a>`;form.reset();
    }catch(err){result.className='pf-status error';result.textContent=err.message||'Gagal membuat link.';}finally{btn.disabled=false;}
  });
  async function makeSlug(sb){for(let i=0;i<8;i++){const s=Math.random().toString(36).slice(2,5);const {data}=await sb.from(type==='shortlink'?'showlink_shortlinks':'showlink_sub4unlock_links').select('id').eq('slug',s).maybeSingle();if(!data)return s;}throw new Error('Gagal membuat kode unik.');}
})();
