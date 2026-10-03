(function(){
'use strict';

// FIRST-INCOMPLETE-TASK GUARD
// Direct access to any task always goes to the first task not completed yet.
(function enforceFirstIncompleteTask(){
  const __p = new URLSearchParams(location.search);
  const __slug = String(__p.get('slug') || '').trim();
  const __plan = String(__p.get('plan') || 'free').toLowerCase();
  const __count = __plan === 'premium' ? 1 : (__plan === 'vip' ? 2 : 3);
  const __progressKey = 'showlink-shortlink-progress:' + __slug;

  function __readProgress(){
    try{
      const raw = sessionStorage.getItem(__progressKey);
      if (!raw) return {};
      const d = JSON.parse(raw);
      return d && typeof d === 'object' ? d : {};
    }catch(_){
      return {};
    }
  }

  function __done(d, n){
    return d[n] === true || d[String(n)] === true ||
      d.completed === n || (Array.isArray(d.completed) && d.completed.includes(n));
  }

  const __d = __readProgress();
  let __first = 1;
  for(let i=1;i<=__count;i++){
    if(!__done(__d,i)){
      __first=i;
      break;
    }
    __first=i+1;
  }

  const __current = 2;
  if(__first > __count) {
    location.replace('/final.html?slug='+encodeURIComponent(__slug)+'&plan='+encodeURIComponent(__plan));
  } else if(__current !== __first) {
    location.replace('/task'+__first+'.html?slug='+encodeURIComponent(__slug)+'&plan='+encodeURIComponent(__plan));
  }
})();

const p=new URLSearchParams(location.search),slug=p.get('slug')||p.get('code')||'';
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const n=2,required={free:3,vip:2,premium:1}[plan]||3;
const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(e){}
if(!Array.isArray(state.completed))state.completed=[];
const en=()=>document.documentElement.lang==='en'||localStorage.getItem('showlink-lang')==='en'||localStorage.getItem('showlink-language')==='en';
const adUrl=()=>window.SHOWLINK_ADSTERRA_URL||localStorage.getItem('showlink-adsterra-url')||'https://www.profitableratecpmnetwork.com/pkmkxfrmiy?key=5b5750804fb6a29007e75d321e567d75';
const $=id=>document.getElementById(id);

function __markTaskComplete(){
  const __params=new URLSearchParams(location.search);
  const __slug=String(__params.get('slug')||'').trim();
  const __key='showlink-shortlink-progress:'+__slug;
  let __d={};
  try{ __d=JSON.parse(sessionStorage.getItem(__key)||'{}')||{}; }catch(_){
    __d={};
  }
  __d[2]=true;
  __d.completed=Array.from(new Set([
    ...(Array.isArray(__d.completed)?__d.completed:[]),
    2
  ])).sort((a,b)=>a-b);
  sessionStorage.setItem(__key,JSON.stringify(__d));
}

function openAd(){const u=adUrl();if(u)window.open(u,'_blank','noopener,noreferrer');}
function gate(downloadId,imageId,progressId,textId,doneId,seconds){
 const b=$(downloadId),img=$(imageId),prog=$(progressId),txt=$(textId),done=$(doneId); if(!b||!prog||!done)return;
 const trigger=()=>{if(b.disabled)return;b.disabled=true;openAd();prog.hidden=false;prog.style.display='flex';let left=seconds;txt.textContent=(en()?'Loading ':'Memuat ')+left+'s';const timer=setInterval(()=>{left--;txt.textContent=(en()?'Loading ':'Memuat ')+Math.max(left,0)+'s';if(left<=0){clearInterval(timer);prog.hidden=true;prog.style.display='none';b.hidden=true;b.style.display='none';done.hidden=false;done.style.display='flex';}},1000)};
 b.addEventListener('click',trigger); if(img){img.addEventListener('click',trigger);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')trigger()});}
 done.addEventListener('click',()=>{openAd();done.hidden=true;done.style.display='none';if(downloadId==='download-top'){const bottom=$('bottom-download-unit');bottom&&bottom.scrollIntoView({behavior:'smooth',block:'center'});}else{if(!state.completed.includes(n))state.completed.push(n);sessionStorage.setItem(key,JSON.stringify(state));__markTaskComplete();
  location.href='/task'+(n+1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);}});
}
function setup(){
 $('task-title').textContent=en()?'Complete Task 2':'Selesaikan Task 2';$('task-count').textContent=n+' / '+required;
 if(!slug){$('task-next').disabled=true;return;}
 if(n>1&&!state.completed.includes(n-1)){location.replace('/task'+(n-1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));return;}
 const next=$('task-next');if(next)next.style.display='none';
 gate('download-top','download-image-top','progress-top','progress-text-top','click-now-top',7);
 gate('download-bottom','download-image-bottom','progress-bottom','progress-text-bottom','click-now-bottom',5);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();