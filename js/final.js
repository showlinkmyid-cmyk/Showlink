(function(){
'use strict';
const p=new URLSearchParams(location.search);
const slug=String(p.get('slug')||p.get('code')||'').trim();
const plan=String(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const button=document.getElementById('final-open');
const status=document.getElementById('final-status');
const required={free:3,vip:2,premium:1}[plan]||3;

if(!slug){
  if(status)status.textContent='Shortlink tidak ditemukan.';
  if(button)button.disabled=true;
  return;
}

const key='showlink-shortlink-progress:'+slug;
let state={};
try{state=JSON.parse(sessionStorage.getItem(key)||'{}')||{};}catch(_){}
const done=n=>state[n]===true||state[String(n)]===true||state.completed===n||
  (Array.isArray(state.completed)&&state.completed.includes(n));

for(let i=1;i<=required;i++){
  if(!done(i)){
    location.replace(`/task${i}.html?slug=${encodeURIComponent(slug)}&plan=${encodeURIComponent(plan)}`);
    return;
  }
}

if(status)status.textContent='Semua task berhasil diselesaikan. Buka hasil Shortlink.';

if(button){
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{
      const sb=await window.ShowLinkSupabase.load();
      await sb.rpc('track_shortlink_final_event',{
        p_slug:slug,p_event_name:'original_click',p_ad_slot:null
      });
    }catch(err){console.warn('[ShowLink] Original-click analytics:',err);}
    location.href=`/s/${encodeURIComponent(slug)}?unlocked=1&plan=${encodeURIComponent(plan)}`;
  });
}
})();
