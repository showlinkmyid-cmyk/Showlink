(function(){
'use strict';
const p=new URLSearchParams(location.search),slug=p.get('slug')||p.get('code')||'';
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const n=2,required={free:3,vip:2,premium:1}[plan]||3;
const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(e){}
if(!Array.isArray(state.completed))state.completed=[];
document.getElementById('task-title').textContent=(localStorage.getItem('showlink-lang')||localStorage.getItem('showlink-language')==='en'?'Complete Task ':'Selesaikan Task ')+n;
document.getElementById('task-count').textContent=n+' / '+required;
if(!slug){document.getElementById('task-next').disabled=true;return}
if(n>1&&!state.completed.includes(n-1)){location.replace('/task'+(n-1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));return}
const taskNext=document.getElementById('task-next');
const topDownload=document.getElementById('real-download-top');
const continueDownload=document.getElementById('continue-download');
const status=document.getElementById('download-status');
const bottomDownload=document.getElementById('real-download-bottom');
if(taskNext) taskNext.disabled=true;
let unlocked=false;
function unlockAfterDownload(){
  unlocked=true;
  if(taskNext){taskNext.disabled=false;taskNext.classList.add('ready');}
  if(bottomDownload){bottomDownload.disabled=false;bottomDownload.innerHTML='<i class="fa-solid fa-download"></i> Download Asli';}
  if(continueDownload)continueDownload.hidden=false;
  if(status)status.textContent='Download Asli siap. Kamu bisa melanjutkan.';
}
if(topDownload) topDownload.addEventListener('click',function(){
  if(status)status.textContent='Menyiapkan download…';
  window.open('about:blank','_blank','noopener');
  setTimeout(unlockAfterDownload,1200);
});
if(continueDownload) continueDownload.addEventListener('click',function(){window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});});
if(bottomDownload) bottomDownload.addEventListener('click',function(){
  if(!unlocked)return;
  status && (status.textContent='Download Asli siap.');
});
taskNext.addEventListener('click',function(){
if(!state.completed.includes(n))state.completed.push(n);sessionStorage.setItem(key,JSON.stringify(state));
if(n<required)location.href='/task'+(n+1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);
else location.href='/final.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);
});
})();