(function(){
'use strict';

const p = new URLSearchParams(location.search);
const slug = p.get('slug') || p.get('code') || '';
const plan = (p.get('plan') || localStorage.getItem('showlink-plan') || 'free').toLowerCase();
const button = document.getElementById('final-open');
const status = document.getElementById('final-status');

if (!slug) {
  if (status) status.textContent = 'Shortlink tidak ditemukan.';
  if (button) button.disabled = true;
  return;
}

const progressKey = 'showlink-shortlink-progress:' + slug;
let state = {completed:[]};
try {
  state = JSON.parse(sessionStorage.getItem(progressKey) || '{"completed":[]}');
} catch (_) {}
if (!Array.isArray(state.completed)) state.completed = [];

const required = {free:3, vip:2, premium:1}[plan] || 3;

// Final is only reachable after the required task count.
const allDone = [];
for (let i=1; i<=required; i++) allDone.push(i);
const complete = allDone.every(n => state.completed.includes(n));

if (!complete) {
  const firstMissing = allDone.find(n => !state.completed.includes(n)) || 1;
  location.replace('/task' + firstMissing + '.html?slug=' +
    encodeURIComponent(slug) + '&plan=' + encodeURIComponent(plan));
  return;
}

if (button) {
  button.addEventListener('click', function(){
    // Do NOT expose content here. Result page is responsible for fetching
    // and rendering the protected content only after the task flow is complete.
    location.href = '/shortlink-result.html?slug=' +
      encodeURIComponent(slug) + '&plan=' + encodeURIComponent(plan);
  });
}
})();