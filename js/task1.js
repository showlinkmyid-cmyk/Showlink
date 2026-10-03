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

  const __current = 1;
  if(__first > __count) {
    location.replace('/final.html?slug='+encodeURIComponent(__slug)+'&plan='+encodeURIComponent(__plan));
  } else if(__current !== __first) {
    location.replace('/task'+__first+'.html?slug='+encodeURIComponent(__slug)+'&plan='+encodeURIComponent(__plan));
  }
})();

const p=new URLSearchParams(location.search),slug=p.get('slug')||p.get('code')||'';
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const n=1,required={free:3,vip:2,premium:1}[plan]||3;
const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};
try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(e){}
if(!Array.isArray(state.completed))state.completed=[];

const en=()=>document.documentElement.lang==='en'||localStorage.getItem('showlink-lang')==='en';
const adUrl=()=>window.SHOWLINK_ADSTERRA_URL||localStorage.getItem('showlink-adsterra-url')||'https://www.profitableratecpmnetwork.com/pkmkxfrmiy?key=5b5750804fb6a29007e75d321e567d75';
const $=id=>document.getElementById(id);

const copy={
 id:{title:'Selesaikan Task 1',intro:'Baca artikel, gunakan tombol akses, lalu lanjutkan ke Task 2.',warning:'Selesaikan kedua tahap download untuk melanjutkan.'},
 en:{title:'Complete Task 1',intro:'Read the article, use the access buttons, then continue to Task 2.',warning:'Complete both download stages to continue.'}
};


function __markTaskComplete(){
  const __params=new URLSearchParams(location.search);
  const __slug=String(__params.get('slug')||'').trim();
  const __key='showlink-shortlink-progress:'+__slug;
  let __d={};
  try{ __d=JSON.parse(sessionStorage.getItem(__key)||'{}')||{}; }catch(_){
    __d={};
  }
  __d[1]=true;
  __d.completed=Array.from(new Set([
    ...(Array.isArray(__d.completed)?__d.completed:[]),
    1
  ])).sort((a,b)=>a-b);
  sessionStorage.setItem(__key,JSON.stringify(__d));
}

function translate(){
 const c=en()?copy.en:copy.id;
 $('task-title').textContent=c.title;
 $('task-intro').textContent=c.intro;
 $('warning-text').textContent=c.warning;
 document.documentElement.lang=en()?'en':'id';
}
function openAd(){
 const u=adUrl();
 if(u) window.open(u,'_blank','noopener,noreferrer');
 else console.warn('[ShowLink] Adsterra URL/code belum dikonfigurasi.');
}
function startGate(buttonId,progressId,textId,seconds,doneId,doneLabel){
 const b=$(buttonId),prog=$(progressId),txt=$(textId),done=$(doneId);
 if(!b||!prog||!done)return;
 // Explicitly keep completion action hidden until countdown is finished.
 done.hidden=true; done.style.display='none';
 b.disabled=true;
 prog.hidden=false; prog.style.display='flex';
 let left=seconds;
 txt.textContent=(en()?'Loading ':'Memuat ')+left+'s';
 const timer=setInterval(()=>{
   left--;
   txt.textContent=(en()?'Loading ':'Memuat ')+Math.max(left,0)+'s';
   if(left<=0){
     clearInterval(timer);
     prog.hidden=true; prog.style.display='none';
     b.hidden=true; b.style.display='none';
     done.querySelector('span').textContent=doneLabel;
     done.hidden=false; done.style.display='flex';
   }
 },1000);
}
function triggerTop(){
 openAd();
 startGate('download-top','progress-top','progress-text-top',7,'click-now-top',en()?'Click Now':'Klik Now');
}
function triggerBottom(){
 openAd();
 startGate('download-bottom','progress-bottom','progress-text-bottom',5,'click-now-bottom',en()?'Click Now':'Klik Now');
}
function setup(){
 translate();
 $('task-count').textContent=n+' / '+required;
 if(!slug){
   $('warning-text').textContent=en()?'Invalid Shortlink.':'Shortlink tidak valid.';
   return;
 }
 if(n>1&&!state.completed.includes(n-1)){
   location.replace('/task'+(n-1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));
   return;
 }
 $('click-now-top').hidden=true;
 $('click-now-top').style.display='none';
 $('click-now-bottom').hidden=true;
 $('click-now-bottom').style.display='none';

 $('download-top').addEventListener('click',triggerTop);
 $('download-image-top').addEventListener('click',triggerTop);
 $('download-image-top').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')triggerTop()});

 $('click-now-top').addEventListener('click',()=>{
   openAd();
   $('click-now-top').hidden=true;
   $('click-now-top').style.display='none';
   document.querySelector('.bottom-download').scrollIntoView({behavior:'smooth',block:'center'});
 });

 $('download-bottom').addEventListener('click',triggerBottom);
 $('download-image-bottom').addEventListener('click',triggerBottom);
 $('download-image-bottom').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')triggerBottom()});

 $('click-now-bottom').addEventListener('click',()=>{
   openAd();
   if(!state.completed.includes(n))state.completed.push(n);
   sessionStorage.setItem(key,JSON.stringify(state));
   __markTaskComplete();
  location.href='/task2.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
window.addEventListener('storage',translate);
window.addEventListener('showlink:languagechange',translate);
})();


/* Bottom-download gate: locked until the upper "Klik Now" action is completed. */
(function(){
  'use strict';
  function initBottomDownloadGate(){
    const bottom = document.getElementById('real-download-bottom');
    const gate = document.getElementById('download-bottom-gate') || document.querySelector('.download-bottom-gate');
    if (!bottom) return;

    bottom.disabled = true;
    bottom.setAttribute('aria-disabled','true');
    bottom.classList.add('locked-bottom');
    if (gate) gate.setAttribute('aria-disabled','true');

    window.ShowLinkUnlockBottomDownload = function(){
      bottom.disabled = false;
      bottom.removeAttribute('aria-disabled');
      bottom.classList.remove('locked-bottom');
      if (gate) gate.setAttribute('aria-disabled','false');
      bottom.innerHTML = '<i class="fa-solid fa-download"></i> Download Asli';
    };

    /* Support the common upper action IDs used by Task 1. */
    const upperSelectors = [
      '#click-now-top',
      '#click-now',
      '#download-click-now',
      '#download-now',
      '.click-now'
    ];
    upperSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.addEventListener('click', function(){
          setTimeout(function(){
            if (typeof window.ShowLinkUnlockBottomDownload === 'function') {
              window.ShowLinkUnlockBottomDownload();
            }
          }, 250);
        }, {once:false});
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBottomDownloadGate);
  } else {
    initBottomDownloadGate();
  }
})();
