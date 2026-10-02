(function(){
'use strict';
const p=new URLSearchParams(location.search),slug=p.get('slug')||p.get('code')||'';
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const n=3,required={free:3,vip:2,premium:1}[plan]||3;
const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(e){}
if(!Array.isArray(state.completed))state.completed=[];

const $=id=>document.getElementById(id);
const title=$('task-title'),count=$('task-count'),next=$('task-next');
const top=$('sponsor-top'),bottom=$('download-bottom-button'),topStatus=$('top-status'),bottomStatus=$('bottom-status'),help=$('bottom-help');
if(title)title.textContent=(localStorage.getItem('showlink-lang')==='en'?'Complete Task ':'Selesaikan Task ')+n;
if(count)count.textContent=n+' / '+required;

function unlockBottom(){
  if(!bottom)return;
  bottom.classList.remove('locked');bottom.removeAttribute('aria-disabled');
  bottomStatus.textContent='✓ Aktif — sponsor gate selesai';
  help.textContent='Download kedua sudah terbuka. Buka sponsor sekali lalu kembali ke halaman ini.';
}
function enableNext(){
  if(!next)return;
  next.disabled=false;
  next.innerHTML='<i class="fa-solid fa-arrow-right"></i> Saya sudah selesai — Lanjut ke Final';
}
if(!slug){if(next)next.disabled=true;return;}
if(n>1&&!state.completed.includes(n-1)){location.replace('/task'+(n-1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));return;}

if(top){
 top.addEventListener('click',function(){
   topStatus.textContent='✓ Sponsor dibuka — kembali ke halaman ini setelah selesai.';
   setTimeout(unlockBottom,900);
 });
}
if(bottom){
 bottom.addEventListener('click',function(){
   if(bottom.classList.contains('locked'))return;
   bottomStatus.textContent='✓ Sponsor kedua dibuka — kembali ke halaman ini.';
   setTimeout(enableNext,900);
 });
}
if(state.completed.includes(n)){unlockBottom();enableNext();}
if(next)next.addEventListener('click',function(){
 if(next.disabled)return;
 if(!state.completed.includes(n))state.completed.push(n);
 sessionStorage.setItem(key,JSON.stringify(state));
 location.href='/final.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);
});
})();