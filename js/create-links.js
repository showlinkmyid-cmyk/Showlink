(() => {
  'use strict';
  const form=document.getElementById('create-link-form');
  if(!form) return;
  const type=form.dataset.type;
  const result=document.getElementById('create-result');
  const btn=form.querySelector('button[type="submit"]');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    btn.disabled=true;
    result.className='pf-status';
    result.textContent='Menyimpan…';
    try{
      const sb=await window.ShowLinkSupabase.load();
      const {data:session}=await sb.auth.getSession();
      const uid=session?.session?.user?.id;
      if(!uid) throw new Error('Sesi login tidak ditemukan.');
      const fd=new FormData(form);
      let link;

      if(type==='payment'){
        const {data,error}=await sb.rpc('create_payment_link',{
          p_title:fd.get('title'),p_description:fd.get('description')||null,
          p_price:Number(fd.get('price')),p_pastelink_id:null,
          p_content_html:fd.get('content_html')||null,p_content_text:fd.get('content_text')||null,
          p_thumbnail_url:fd.get('thumbnail_url')||null
        });
        if(error) throw error;
        link=Array.isArray(data)?data[0]:data;
      }else if(type==='shortlink'){
        const content=String(fd.get('content_text')||'').trim();
        if(!content) throw new Error('Isi konten wajib diisi.');
        // CONTENT is the source of truth. destination_url is only a compatibility
        // field and must never contain title/description/bot success messages.
        const destination = '';
        const slug=await makeSlug(sb,'showlink_shortlinks');
        const {data,error}=await sb.from('showlink_shortlinks').insert({
          owner_id:uid,slug,title:String(fd.get('title')||'').trim(),
          description:String(fd.get('description')||'').trim(),
          content_text:content,destination_url:destination,
          tasks:[],payment_link_id: await resolvePaymentLinkId(sb, form),status:'active'
        }).select('slug').single();
        if(error) throw error;
        link={slug:data.slug};
      }else{
        const destination=String(fd.get('destination_url')||'').trim();
        const tasks=[];
        const {data,error}=await sb.from('showlink_sub4unlock_links').insert({
          owner_id:uid,title:String(fd.get('title')),slug:await makeSlug(sb,'showlink_sub4unlock_links'),
          destination_url:destination,tasks,status:'active'
        }).select('slug').single();
        if(error) throw error;
        link={slug:data.slug};
      }

      const prefix=type==='shortlink'?'/s/':type==='payment'?'/p/':'/u/';
      const url=`${location.origin}${prefix}${link.slug}`;
      result.className='pf-status success';
      result.innerHTML=`Berhasil dibuat.<br><strong>${esc(url)}</strong><br><a href="${esc(url)}" target="_blank" rel="noopener">Buka link</a>`;
      form.reset();
    }catch(err){
      result.className='pf-status error';
      result.textContent=err.message||'Gagal membuat link.';
    }finally{btn.disabled=false;}
  });

  // Resolve an optional Payment Link relation without changing the existing form flow.
  async function resolvePaymentLinkId(sb, form) {
    const el =
      form?.querySelector('[name="payment_link_id"]') ||
      form?.querySelector('#payment_link_id') ||
      document.querySelector('[name="payment_link_id"]') ||
      document.querySelector('#payment_link_id');

    const raw = String(el?.value || '').trim();
    if (!raw) return null;

    // Accept UUID directly.
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(raw)) return raw;

    // Otherwise allow a Payment Link slug.
    const { data, error } = await sb
      .from('payment_links')
      .select('id')
      .eq('slug', raw)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    return data?.id || null;
  }

  async function makeSlug(sb,table){
    for(let i=0;i<10;i++){
      const s=Math.random().toString(36).slice(2,6);
      const {data}=await sb.from(table).select('id').eq('slug',s).maybeSingle();
      if(!data) return s;
    }
    throw new Error('Gagal membuat kode unik.');
  }
})();