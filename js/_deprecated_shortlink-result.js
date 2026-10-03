(function(){
'use strict';

const p = new URLSearchParams(location.search);
const slug = p.get('slug') || p.get('code') || '';
const app = document.getElementById('result-app');

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g,function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

function linkify(text){
  return esc(text).replace(
    /((?:https?:\/\/|www\.)[^\s<]+)/gi,
    function(_,u){
      const href=/^www\./i.test(u)?'https://'+u:u;
      return '<a href="'+href+'" target="_blank" rel="noopener noreferrer">'+u+'</a>';
    }
  );
}

function unwrap(raw){
  let d=raw;
  if(Array.isArray(d)) d=d[0]||null;
  if(d&&d.data&&!d.content_text&&!d.content) d=d.data;
  if(typeof d==='string'){try{d=JSON.parse(d)}catch(_){}}
  if(Array.isArray(d)) d=d[0]||null;
  return d;
}

function render(data){
  const title=data.title||'Shortlink';
  const description=data.description||'';
  const content=data.content_text??data.content??'';

  app.innerHTML=
    '<span class="pf-kicker"><i class="fa-solid fa-circle-check"></i> SHORTLINK TERBUKA</span>'+
    '<h1 class="pf-title">'+esc(title)+'</h1>'+
    (description?'<p class="pf-desc">'+linkify(description)+'</p>':'')+
    '<div class="result-unlocked">'+
      '<div class="result-badge"><i class="fa-solid fa-circle-check"></i> Konten berhasil dibuka</div>'+
      '<div class="result-content">'+linkify(content)+'</div>'+
    '</div>';
}

function getSaved(){
  const keys=[
    'showlink-shortlink-choice:'+slug,
    'showlink-shortlink-result:'+slug,
    'showlink-shortlink-content:'+slug
  ];
  for(const key of keys){
    try{
      const raw=sessionStorage.getItem(key)||localStorage.getItem(key);
      if(!raw) continue;
      const d=JSON.parse(raw);
      if(d&&(d.content_text||d.content||d.title)) return d;
    }catch(_){}
  }
  return null;
}

async function rpc(){
  const sb=window.supabaseClient||window.supabase||window.sb;
  if(!sb||!sb.rpc) throw new Error('Supabase client unavailable');
  const res=await sb.rpc('get_public_shortlink',{p_slug:slug});
  if(res&&res.error) throw res.error;
  const d=unwrap(res&&res.data!==undefined?res.data:res);
  if(!d||d.ok===false) throw new Error('Shortlink not found');
  return d;
}

async function load(){
  if(!slug){
    app.innerHTML='<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Shortlink tidak tersedia</h2><p>Slug tidak ditemukan.</p></div>';
    return;
  }
  const saved=getSaved();
  if(saved&&(saved.content_text||saved.content)){
    render(saved);
    return;
  }
  try{
    const data=await rpc();
    if(!('content_text' in data)&&!('content' in data)) throw new Error('Content not returned');
    render(data);
  }catch(err){
    console.error('[ShowLink Result]',err);
    app.innerHTML='<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Konten belum dapat dimuat</h2><p>Data Shortlink ditemukan, tetapi konten asli belum tersedia.</p><button class="pf-btn" type="button" onclick="location.reload()"><i class="fa-solid fa-rotate-right"></i> Coba Lagi</button></div>';
  }
}
load();
})();
