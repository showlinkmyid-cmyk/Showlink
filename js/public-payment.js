(() => {
  'use strict';
  const app=document.getElementById('app');
  const slug=location.pathname.split('/').filter(Boolean)[1]||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(n,c='IDR')=>new Intl.NumberFormat('id-ID',{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(n||0));
  const guestToken=()=>{let t=localStorage.getItem('showlink_guest_token');if(!t){t=crypto.randomUUID();localStorage.setItem('showlink_guest_token',t)}return t};
  async function sessionUser(sb){const {data}=await sb.auth.getUser();return data?.user||null;}
  async function load(){
    try{const sb=await window.ShowLinkSupabase.load();const {data,error}=await sb.rpc('get_payment_link_by_slug',{p_slug:slug});if(error)throw error;if(!data)throw new Error('Payment Link tidak ditemukan atau sudah tidak aktif.');render(data,sb);}catch(e){app.innerHTML=`<div class="pf-body"><div class="pf-loader"><i class="fa-solid fa-circle-exclamation"></i><h2>Payment Link tidak tersedia</h2><p>${esc(e.message||'Terjadi kesalahan.')}</p></div></div>`;}}
  function render(data,sb){const image=data.thumbnail_url||data.thumbnail;app.innerHTML=`${image?`<div class="pf-cover"><img src="${esc(image)}" alt=""></div>`:'<div class="pf-cover"><i class="fa-solid fa-credit-card"></i></div>'}<div class="pf-body"><span class="pf-kicker"><i class="fa-solid fa-lock"></i> PAYMENT LINK</span><h1 class="pf-title">${esc(data.title)}</h1><p class="pf-desc">${esc(data.description||'Konten berbayar ShowLink.')}</p><div class="pf-price">${money(data.price,data.currency||'IDR')}</div><button class="pf-btn" id="buy">Beli & Bayar <i class="fa-solid fa-arrow-right"></i></button><div class="pf-status" id="status">Pembayaran akan diproses otomatis sesuai nominal link.</div></div>`;document.getElementById('buy').addEventListener('click',()=>buy(data,sb));}
  async function buy(data,sb){const btn=document.getElementById('buy'),status=document.getElementById('status');btn.disabled=true;status.textContent='Membuat order pembayaran…';try{const user=await sessionUser(sb);const {data:order,error}=await sb.rpc('create_checkout_order',{p_payment_link_id:data.id,p_guest_access_token:user?null:guestToken()});if(error)throw error;const oid=order?.order_id||order?.id;if(!oid)throw new Error('Order tidak berhasil dibuat.');
      // Cashi must be called server-side. The browser never receives provider secrets.
      const fn=`${window.SHOWLINK_SUPABASE.url}/functions/v1/cashi-create-payment`;
      const resp=await fetch(fn,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${window.SHOWLINK_SUPABASE.anonKey}`},body:JSON.stringify({order_id:oid})});
      const result=await resp.json().catch(()=>({}));
      if(!resp.ok) throw new Error(result.error||'Gateway Cashi belum terhubung.');
      if(result.checkout_url){location.href=result.checkout_url;return;}
      if(result.qr_url){app.innerHTML=`<div class="pf-body"><span class="pf-kicker"><i class="fa-solid fa-qrcode"></i> CASHI</span><h1 class="pf-title">Selesaikan pembayaran</h1><p class="pf-desc">Scan QR pembayaran sesuai nominal.</p><div style="text-align:center"><img src="${esc(result.qr_url)}" alt="QR pembayaran" style="max-width:280px;width:100%;border-radius:18px"></div><div class="pf-status" id="status">Menunggu konfirmasi pembayaran…</div></div>`;pollPaid(sb,oid);return;}
      throw new Error('Cashi tidak mengembalikan halaman pembayaran.');
    }catch(e){btn.disabled=false;status.className='pf-status error';status.textContent=e.message||'Pembayaran gagal dibuat.';}}
  async function pollPaid(sb,orderId){for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,3000));const {data}=await sb.from('orders').select('status').eq('id',orderId).maybeSingle();if(['paid','completed'].includes(data?.status)){location.href=`/content/payment/${encodeURIComponent(slug)}?order=${encodeURIComponent(orderId)}`;return;}}}
  load();
})();
