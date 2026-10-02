(function(){
'use strict';
const p=new URLSearchParams(location.search);
const slug=p.get('slug')||p.get('code')||'';
const a=document.getElementById('final-open');
const s=document.getElementById('final-status');

let u='';
try{u=(JSON.parse(sessionStorage.getItem('showlink-shortlink-content:'+slug)||'{}')).url||''}catch(e){}
if(u&&!/^https?:\/\//i.test(u))u='https://'+u;

if(u){
  a.href=u;a.classList.add('is-ready');a.removeAttribute('aria-disabled');
  s.textContent='Silakan pilih tombol download di atas.';
}else{
  a.removeAttribute('href');a.classList.add('is-locked');a.setAttribute('aria-disabled','true');
  s.textContent='Silakan pilih tombol download yang tersedia.';
}

track('page_view',null);

document.querySelectorAll('.ad-download').forEach(btn=>{
  btn.addEventListener('click',()=>{track('ad_click',btn.dataset.adSlot)}, {passive:true});
});
a.addEventListener('click',e=>{
  if(!u){e.preventDefault();return}
  track('original_click',null);
});

const join=document.getElementById('join-float');
const done=document.getElementById('join-done');
let dismissed=false;
function showJoin(){
  if(dismissed)return;
  join.classList.add('show');
}
setTimeout(showJoin,3000);
window.__joinTimer=setInterval(showJoin,3000);
done.addEventListener('click',()=>{dismissed=true;join.classList.remove('show');clearInterval(window.__joinTimer)});
document.getElementById('join-telegram').addEventListener('click',()=>{
  track('telegram_join_click',null);
});
})();
