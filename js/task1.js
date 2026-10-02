(function(){
'use strict';
const p=new URLSearchParams(location.search),slug=p.get('slug')||p.get('code')||'';
const plan=(p.get('plan')||localStorage.getItem('showlink-plan')||'free').toLowerCase();
const n=1,required={free:3,vip:2,premium:1}[plan]||3;
const key='showlink-shortlink-progress:'+slug;
let state={completed:[]};try{state=JSON.parse(sessionStorage.getItem(key)||'{"completed":[]}')}catch(e){}
if(!Array.isArray(state.completed))state.completed=[];

const en=()=>document.documentElement.lang==='en'||localStorage.getItem('showlink-lang')==='en';
const adUrl=()=>window.SHOWLINK_ADSTERRA_URL||localStorage.getItem('showlink-adsterra-url')||'';
const $=id=>document.getElementById(id);

const copy={
 id:{title:'Selesaikan Task 1',intro:'Baca artikel, ikuti tombol akses, lalu lanjutkan ke Task 2.',h1:'1. Utamakan pola makan yang beragam',h2:'2. Bergerak secara rutin',h3:'3. Tidur dan istirahat yang cukup',h4:'4. Perhatikan hidrasi dan kebersihan',warning:'Selesaikan kedua tombol download untuk melanjutkan.'},
 en:{title:'Complete Task 1',intro:'Read the article, use the access buttons, then continue to Task 2.',h1:'1. Choose a varied diet',h2:'2. Stay physically active',h3:'3. Get enough sleep and rest',h4:'4. Stay hydrated and maintain hygiene',warning:'Complete both download buttons to continue.'}
};
function translate(){const c=en()?copy.en:copy.id; $('task-title').textContent=c.title;$('task-intro').textContent=c.intro;$('h1').textContent=c.h1;$('h2').textContent=c.h2;$('h3').textContent=c.h3;$('h4').textContent=c.h4;$('warning-text').textContent=c.warning;$('task-progress-label').textContent=en()?'Task 1':'Task 1';}
function openAd(){const u=adUrl();if(u){window.open(u,'_blank','noopener,noreferrer');}else{console.warn('[ShowLink] Adsterra URL/code belum dikonfigurasi.');}}
function startGate(buttonId,progressId,textId,seconds,doneId,doneLabel){
 const b=$(buttonId),prog=$(progressId),txt=$(textId),done=$(doneId); if(!b||!prog||!done)return;
 b.disabled=true;prog.hidden=false;let left=seconds;txt.textContent=(en()?'Loading ':'Memuat ')+left+'s';
 const timer=setInterval(()=>{left--;txt.textContent=(en()?'Loading ':'Memuat ')+Math.max(left,0)+'s';if(left<=0){clearInterval(timer);prog.hidden=true;done.hidden=false;b.hidden=true;done.querySelector('span').textContent=doneLabel;}},1000);
}
function setup(){
 translate();
 $('task-count').textContent=n+' / '+required;
 if(!slug){$('warning-text').textContent=en()?'Invalid Shortlink.':'Shortlink tidak valid.';return;}
 if(n>1&&!state.completed.includes(n-1)){location.replace('/task'+(n-1)+'.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan));return;}
 const top=$('download-top'),topImg=$('download-image-top'),topNow=$('click-now-top');
 const bottom=$('download-bottom'),bottomImg=$('download-image-bottom'),bottomNow=$('click-now-bottom');
 [top,topImg].forEach(el=>el&&el.addEventListener('click',()=>{openAd();startGate('download-top','progress-top','progress-text-top',7,'click-now-top',en()?'Click Now':'Klik Now');}));
 topNow.addEventListener('click',()=>{topNow.hidden=true;document.querySelector('.bottom-download').scrollIntoView({behavior:'smooth',block:'center'});});
 [bottom,bottomImg].forEach(el=>el&&el.addEventListener('click',()=>{openAd();startGate('download-bottom','progress-bottom','progress-text-bottom',5,'click-now-bottom',en()?'Click Now':'Klik Now');}));
 bottomNow.addEventListener('click',()=>{if(!state.completed.includes(n))state.completed.push(n);sessionStorage.setItem(key,JSON.stringify(state));location.href='/task2.html?slug='+encodeURIComponent(slug)+'&plan='+encodeURIComponent(plan);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
window.addEventListener('storage',translate);
})();
