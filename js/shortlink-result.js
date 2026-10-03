(function(){
'use strict';

const p = new URLSearchParams(location.search);
const slug = p.get('slug') || p.get('code') || '';
const plan = (p.get('plan') || 'free').toLowerCase();
const app = document.getElementById('result-app');

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

function linkify(text){
  const safe = esc(text);
  return safe.replace(
    /((?:https?:\/\/|www\.)[^\s<]+)/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

function render(data){
  const title = data.title || 'Shortlink';
  const description = data.description || '';
  const content = data.content_text || data.content || '';

  app.innerHTML =
    '<span class="pf-kicker"><i class="fa-solid fa-circle-check"></i> SHOWLINK · HASIL</span>' +
    '<h1 class="pf-title">' + esc(title) + '</h1>' +
    (description ? '<p class="pf-desc">' + linkify(description) + '</p>' : '') +
    '<div class="result-unlocked">' +
      '<div class="result-badge"><i class="fa-solid fa-lock-open"></i> Konten Asli</div>' +
      '<div class="result-content">' + linkify(content).replace(/\n/g,'<br>') + '</div>' +
    '</div>';
}

async function load(){
  if (!slug){
    app.innerHTML =
      '<div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i>' +
      '<h2>Shortlink tidak tersedia</h2><p>Slug tidak ditemukan.</p></div>';
    return;
  }

  // First try the canonical RPC. This is intentionally called only on the
  // protected result page, never on the public landing/task pages.
  try{
    const sb = window.supabaseClient || window.supabase;
    if (!sb || !sb.rpc) throw new Error('Supabase client unavailable');

    const {data: raw, error} = await sb.rpc('get_public_shortlink', {p_slug: slug});
    if (error) throw error;

    let data = raw;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) {}
    }
    if (Array.isArray(data)) data = data[0] || null;

    if (!data || data.ok === false) throw new Error('Shortlink tidak ditemukan');

    render(data);
  }catch(e){
    app.innerHTML =
      '<div class="pf-loader">' +
      '<i class="fa-solid fa-circle-exclamation"></i>' +
      '<h2>Konten belum dapat dimuat</h2>' +
      '<p>Silakan ulangi proses Shortlink.</p>' +
      '</div>';
  }
}

load();
})();