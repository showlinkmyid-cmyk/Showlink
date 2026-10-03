(function(){
'use strict';
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

if(button){
  button.addEventListener('click',function(){
    location.href='/shortlink-result.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);
  });
}
})();