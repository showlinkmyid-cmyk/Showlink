(function(){
'use strict';
const p=new URLSearchParams(location.search),slug=p.get('slug')||p.get('code')||'';
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const n=1,required={free:3,vip:2,premium:1}[plan]||3;
const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(e){}
if(!Array.isArray(state.completed))state.completed=[];
document.getElementById('task-title').textContent=(localStorage.getItem('showlink-lang')==='en'?'Complete Task ':'Selesaikan Task ')+n;
document.getElementById('task-count').textContent=n+' / '+required;
if(!slug){document.getElementById('task-next').disabled=true;return}
if(n>1&&!state.completed.includes(n-1)){location.replace('/task'+(n-1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));return}
document.getElementById('task-next').addEventListener('click',function(){
if(!state.completed.includes(n))state.completed.push(n);sessionStorage.setItem(key,JSON.stringify(state));
if(n<required)location.href='/task'+(n+1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);
else location.href='/final.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);
});
})();