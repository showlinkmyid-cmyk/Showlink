(function(){
'use strict';

// FIRST-INCOMPLETE-FINAL-GUARD
// Direct access to Final is allowed only when every required task is completed.
(function enforceFinalGuard(){
  const p = new URLSearchParams(location.search);
  const slug = String(p.get('slug') || '').trim();
  const plan = String(p.get('plan') || 'free').toLowerCase();
  const count = plan === 'premium' ? 1 : (plan === 'vip' ? 2 : 3);
  const key = 'showlink-shortlink-progress:' + slug;
  let d = {};
  try { d = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch (_) {}

  const done = n => d[n] === true || d[String(n)] === true ||
    d.completed === n || (Array.isArray(d.completed) && d.completed.includes(n));

  let first = 0;
  for (let i=1;i<=count;i++) {
    if (!done(i)) { first=i; break; }
  }
  if (first) {
    location.replace('/task'+first+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));
  }
})();

const p=new URLSearchParams(location.search);
const slug=p.get('slug')||p.get('code')||'';
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const button=document.getElementById('final-open');
const status=document.getElementById('final-status');

if(!slug){
  if(status) status.textContent='Shortlink tidak ditemukan.';
  if(button) button.disabled=true;
  return;
}

const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};
try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(_){}
if(!Array.isArray(state.completed))state.completed=[];

const required={free:3,vip:2,premium:1}[plan]||3;
const done=Array.from({length:required},(_,i)=>i+1).every(n=>state.completed.includes(n));

if(!done){
  const missing=Array.from({length:required},(_,i)=>i+1).find(n=>!state.completed.includes(n))||1;
  location.replace('/task'+missing+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));
  return;
}

async function recordFinalViewOnce(){
  const viewKey='showlink-shortlink-final-view:'+slug;
  try{
    if(sessionStorage.getItem(viewKey)==='1') return;
  }catch(_){}

  try{
    const sb=await window.ShowLinkSupabase.load();
    const {data,error}=await sb.rpc('track_shortlink_final_event',{
      p_slug:slug,
      p_event_name:'page_view',
      p_ad_slot:null
    });
    if(error) throw error;
    if(data?.ok===false) throw new Error(data.error||'Analytics gagal');
    try{sessionStorage.setItem(viewKey,'1')}catch(_){}
    if(status){
      const cpm=Number(data?.cpm||0);
      const views=Number(data?.views||0);
      status.dataset.analyticsRecorded='1';
      status.dataset.views=String(views);
      status.dataset.cpm=String(cpm);
    }
  }catch(err){
    // Do not block access to the unlocked content if analytics is temporarily unavailable.
    console.warn('[ShowLink] Final analytics:',err);
  }
}

// Record one valid Final view after all required tasks have passed.
// The RPC is the existing database-side source used by the Dashboard.
recordFinalViewOnce();

if(button){
  button.addEventListener('click',async function(){
    // Count the actual content-open event separately.
    try{
      const sb=await window.ShowLinkSupabase.load();
      await sb.rpc('track_shortlink_final_event',{
        p_slug:slug,
        p_event_name:'original_click',
        p_ad_slot:null
      });
    }catch(err){
      console.warn('[ShowLink] Original-click analytics:',err);
    }
    location.href = '/s/' + encodeURIComponent(slug) + '?unlocked=1&plan=' + encodeURIComponent(plan);
  });
}
})();