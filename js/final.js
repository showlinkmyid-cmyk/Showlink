(function(){
'use strict';
const p=new URLSearchParams(location.search);
const slug=p.get('slug')||p.get('code')||'';
const a=document.getElementById('final-open');
const s=document.getElementById('final-status');
const viewEl=document.getElementById('live-view-count');
const cpmEl=document.getElementById('live-cpm');
const estEl=document.getElementById('live-estimated');

let u='';
try{u=(JSON.parse(sessionStorage.getItem('showlink-shortlink-content:'+slug)||'{}')).url||''}catch(e){}
if(u&&!/^https?:\/\//i.test(u))u='https://'+u;

if(u){
  a.href=u;a.classList.add('is-ready');a.removeAttribute('aria-disabled');
  s.textContent='Konten asli siap dibuka.';
}else{
  a.removeAttribute('href');a.classList.add('is-locked');a.setAttribute('aria-disabled','true');
  s.textContent='URL konten asli belum tersedia pada sesi ini.';
}

function money(v){
  const n=Number(v||0);
  return 'Rp '+n.toLocaleString('id-ID',{maximumFractionDigits:2});
}
async function rpc(name,args){
  try{
    const sb=window.supabaseClient||window.supabase;
    if(!sb||typeof sb.rpc!=='function')return null;
    const r=await sb.rpc(name,args||{});
    return r.error?null:r.data;
  }catch(e){return null}
}
async function track(eventName,slot){
  return rpc('track_shortlink_final_event',{
    p_slug:slug,p_event_name:eventName,p_ad_slot:slot||null
  });
}
async function loadStats(){
  const data=await rpc('get_shortlink_final_stats',{p_slug:slug});
  if(!data)return;
  viewEl.textContent=Number(data.views||0).toLocaleString('id-ID');
  cpmEl.textContent=money(data.cpm||0);
  estEl.textContent=money(data.estimated_revenue||0);
}
track('page_view',null).then(loadStats);

document.querySelectorAll('.ad-download').forEach(btn=>{
  btn.addEventListener('click',()=>{track('ad_click',btn.dataset.adSlot).then(loadStats)}, {passive:true});
});
a.addEventListener('click',e=>{
  if(!u){e.preventDefault();return}
  track('original_click',null).then(loadStats);
});

const join=document.getElementById('join-float');
const close=document.getElementById('join-close');
let dismissed=false;
function showJoin(){
  if(dismissed)return;
  join.classList.add('show');
  clearTimeout(window.__joinHide);
  window.__joinHide=setTimeout(()=>join.classList.remove('show'),7000);
}
setTimeout(showJoin,3000);
window.__joinTimer=setInterval(showJoin,3000);
close.addEventListener('click',()=>{dismissed=true;join.classList.remove('show');clearInterval(window.__joinTimer)});

document.getElementById('join-telegram').addEventListener('click',()=>{
  track('telegram_join_click',null);
});
})();