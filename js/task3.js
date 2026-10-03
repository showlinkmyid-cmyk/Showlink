(function(){
'use strict';
const p=new URLSearchParams(location.search),slug=p.get('slug')||p.get('code')||'',target=p.get('target')||'';
const flowContent=(()=>{try{return new URLSearchParams(location.search).get('content')||''}catch(e){return ''}})();
try{
  if(flowContent&&slug){
    const payload=JSON.stringify({content_text:flowContent});
    sessionStorage.setItem('showlink-shortlink-content:'+slug,payload);
    localStorage.setItem('showlink-shortlink-content:'+slug,payload);
  }
}catch(e){}
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const n=3,required={free:3,vip:2,premium:1}[plan]||3;
const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(e){}
if(!Array.isArray(state.completed))state.completed=[];
const $=id=>document.getElementById(id);
const title=$('task-title'),count=$('task-count'),next=$('task-next');
const top=$('sponsor-top'),bottom=$('download-bottom-button');
const topStatus=$('top-status'),bottomStatus=$('bottom-status'),help=$('bottom-help');
const s2=$('sponsor-stage-2-button'),s2Status=$('stage2-status'),s2Help=$('stage2-help');
const s3=$('sponsor-stage-3-button'),s3Status=$('stage3-status'),s3Help=$('stage3-help');
const stage2=$('sponsor-stage-2'),stage3=$('sponsor-stage-3');
const loader=$('task-loader'),loaderBar=$('loader-progress-bar'),loaderTime=$('loader-time'),loaderTitle=$('loader-title'),loaderSub=$('loader-subtitle');
const notice=$('notification-gate'),noticeBtn=$('notification-button');
let loaded=false,notified=false;
if(title)title.textContent=(localStorage.getItem('showlink-lang')==='en'?'Complete Task ':'Selesaikan Task ')+n;
if(count)count.textContent=n+' / '+required;
if(!slug){if(next)next.disabled=true;return;}
if(n>1&&!state.completed.includes(n-1)){location.replace('/task'+(n-1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan)+'&target='+encodeURIComponent(target));return;}

function unlockLink(el,status,helpEl,message){
 if(!el)return;
 el.classList.remove('locked');el.removeAttribute('aria-disabled');
 if(status)status.textContent='✓ Aktif — sponsor siap dibuka';
 if(helpEl)helpEl.textContent=message;
}
function markStage(el,status){
 if(status)status.textContent='✓ Sponsor dibuka — kembali ke halaman ini setelah selesai.';
 if(el)el.classList.add('opened');
}
function enableNext(){if(!next)return;next.disabled=false;next.innerHTML='<i class="fa-solid fa-arrow-right"></i> Saya sudah selesai — Lanjut ke Final';}
function startLoader(){
 let pct=0;const started=Date.now(),duration=10000;
 const timer=setInterval(()=>{
   pct=Math.min(100,Math.round(((Date.now()-started)/duration)*100));
   if(loaderBar)loaderBar.style.width=pct+'%';if(loaderTime)loaderTime.textContent=pct+'%';
   if(pct<40){if(loaderTitle)loaderTitle.textContent='Menyiapkan Task 3...';if(loaderSub)loaderSub.textContent='Memuat konten dan sponsor';}
   else if(pct<80){if(loaderTitle)loaderTitle.textContent='Menyiapkan tombol...';if(loaderSub)loaderSub.textContent='Harap tunggu sebentar';}
   else if(pct<100){if(loaderTitle)loaderTitle.textContent='Hampir selesai...';if(loaderSub)loaderSub.textContent='Menyiapkan notifikasi';}
   else{clearInterval(timer);loaded=true;if(loaderTitle)loaderTitle.textContent='Task siap';if(loaderSub)loaderSub.textContent='Loading selesai';if(notice){notice.hidden=false;notice.classList.add('show');}}
 },100);
}
function revealAfterNotification(){
 if(!loaded||notified)return;notified=true;
 if(notice){notice.classList.add('confirmed');noticeBtn.innerHTML='<i class="fa-solid fa-check"></i> Notifikasi Dibuka';}
 document.body.classList.add('task-ready');
}
if(noticeBtn)noticeBtn.addEventListener('click',revealAfterNotification);
startLoader();

// Stage 1 -> Stage 2
if(top)top.addEventListener('click',function(){
 if(!notified)return;
 markStage(top,topStatus);
 setTimeout(()=>unlockLink(s2,s2Status,s2Help,'Stage 2 sudah aktif. Buka sponsor sekali lalu kembali ke halaman ini.'),900);
});
// Stage 2 -> Stage 3
if(s2)s2.addEventListener('click',function(){
 if(s2.classList.contains('locked'))return;
 markStage(s2,s2Status);
 setTimeout(()=>unlockLink(s3,s3Status,s3Help,'Stage 3 sudah aktif. Buka sponsor sekali lalu kembali ke halaman ini.'),900);
});
// Stage 3 -> bottom download gate
if(s3)s3.addEventListener('click',function(){
 if(s3.classList.contains('locked'))return;
 markStage(s3,s3Status);
 setTimeout(()=>unlockLink(bottom,bottomStatus,help,'Download berikutnya sudah aktif. Setelah selesai, tombol Lanjut ke Final akan terbuka.'),900);
});
if(bottom)bottom.addEventListener('click',function(){
 if(bottom.classList.contains('locked'))return;
 bottomStatus.textContent='✓ Sponsor terakhir dibuka — kembali ke halaman ini.';
 setTimeout(enableNext,900);
});
if(state.completed.includes(n)){
 unlockLink(s2,s2Status,s2Help,'Stage 2 sudah aktif.');
 unlockLink(s3,s3Status,s3Help,'Stage 3 sudah aktif.');
 unlockLink(bottom,bottomStatus,help,'Download berikutnya sudah aktif.');
 enableNext();
}
if(next)next.addEventListener('click',function(){
 if(next.disabled)return;
 if(!state.completed.includes(n))state.completed.push(n);
 sessionStorage.setItem(key,JSON.stringify(state));
 location.href='/final.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan)+'&target='+encodeURIComponent(target);
});
})();
