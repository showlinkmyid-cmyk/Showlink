(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let sb=null, currentUser=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0));
const toast=(m,bad=false)=>{const a=$("#admin-alert");a.innerHTML=`<div class="toast">${esc(m)}</div>`;setTimeout(()=>a.innerHTML="",3200)};
async function init(){
 try{sb=await window.ShowLinkSupabase.load(); const {data,error}=await sb.auth.getUser(); if(error||!data.user) return location.replace("/login.html"); currentUser=data.user;
   $("#admin-email").textContent=data.user.email||"Admin";
   await sb.rpc("bootstrap_showlink_admin");
   const {data:ok,error:e}=await sb.rpc("is_current_user_admin"); if(e||ok!==true) throw new Error("Akun ini bukan admin.");
   bind(); await loadStats(); await loadSettings();
 }catch(e){document.body.innerHTML=`<main style="padding:40px;font-family:Inter"><h2>Akses Admin Ditolak</h2><p>${esc(e.message)}</p><a href="/dashboard.html">Kembali</a></main>`}
}
function bind(){
 $$("[data-tab]").forEach(b=>b.onclick=()=>{ $$("[data-tab]").forEach(x=>x.classList.toggle("active",x===b)); $$(".admin-tab").forEach(x=>x.classList.remove("active")); $("#tab-"+b.dataset.tab).classList.add("active");
 if(b.dataset.tab==="users")loadUsers(); if(b.dataset.tab==="content")loadContent(); if(b.dataset.tab==="withdrawals")loadWithdrawals();});
 $("#admin-logout").onclick=async()=>{await sb.auth.signOut();location.replace("/login.html")};
 $("#refresh-all").onclick=()=>loadStats(); $("#load-users").onclick=()=>loadUsers(); $("#load-content").onclick=()=>loadContent(); $("#load-withdrawals").onclick=()=>loadWithdrawals();
 $$(".save-settings").forEach(b=>b.onclick=saveSettings);
 $("#send-ann").onclick=sendAnnouncement;
}
async function rpc(name,args={}){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
async function loadStats(){
 try{const s=await rpc("admin_stats"); const cards=[
 ["fa-users","Total User",s.total_users],["fa-user-plus","User Baru / 7 Hari",s.new_users_7d],["fa-bolt","Aktif / 7 Hari",s.active_users_7d],["fa-clock","Jarang Aktif / 8–30 Hari",s.rare_active_8_30d],
 ["fa-user-slash","Tidak Aktif >30 Hari",s.inactive_30d_plus],["fa-ban","Banned",s.banned_users],["fa-wallet","Total Saldo",money(s.total_balance)],["fa-money-bill-transfer","Withdraw Pending",s.pending_withdrawals]];
 $("#stats-grid").innerHTML=cards.map(x=>`<div class="stat"><i class="fa-solid ${x[0]}"></i><span>${x[1]}</span><strong>${esc(x[2])}</strong></div>`).join("");
 $("#quick-summary").innerHTML=[["Shortlink",s.shortlinks],["PasteLink",s.pastelinks],["Payment Link",s.payment_links],["Pending Withdraw",money(s.pending_withdrawal_amount)]].map(x=>`<div class="quick"><b>${esc(x[1])}</b><span>${x[0]}</span></div>`).join("");
 }catch(e){toast(e.message,true)}
}
async function loadUsers(){
 try{const arr=await rpc("admin_users",{p_search:$("#user-search").value.trim(),p_plan:$("#user-plan").value,p_limit:100,p_offset:0});$("#users-body").innerHTML=arr.map(u=>{
 const last=u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString("id-ID"):"Belum login";
 const plan=u.plan||"free"; const status=u.is_banned?"banned":"active";
 return `<tr><td><span class="user-name">${esc(u.username)}</span><span class="sub">${esc(u.email||u.auth_email||"")}</span></td><td><span class="chip ${plan}">${plan.toUpperCase()}</span></td><td><span class="chip ${status}">${status}</span></td><td>${esc(last)}</td><td>${money(u.balance)}</td><td><div class="row-actions">
 <button class="mini" data-user-edit="${u.id}">Edit</button><button class="mini" data-user-plan="${u.id}">Plan</button><button class="mini" data-user-ban="${u.id}" data-banned="${u.is_banned}">${u.is_banned?"Unban":"Ban"}</button><button class="mini" data-user-pass="${u.id}">Password</button><button class="mini" data-user-delete="${u.id}">Hapus</button></div></td></tr>`}).join("");
 $$("[data-user-edit]").forEach(b=>b.onclick=()=>userEdit(b.dataset.userEdit));
 $$("[data-user-plan]").forEach(b=>b.onclick=()=>userPlan(b.dataset.userPlan));
 $$("[data-user-ban]").forEach(b=>b.onclick=()=>userBan(b.dataset.userBan,b.dataset.banned==="true"));
 $$("[data-user-pass]").forEach(b=>b.onclick=()=>userPassword(b.dataset.userPass));
 $$("[data-user-delete]").forEach(b=>b.onclick=()=>userDelete(b.dataset.userDelete));
 }catch(e){toast(e.message,true)}
}
async function userEdit(id){
 const v=prompt("Masukkan saldo baru (angka):"); if(v===null)return; const n=Number(v);if(!Number.isFinite(n)||n<0)return toast("Saldo tidak valid",true);
 try{await rpc("admin_set_user",{p_user_id:id,p_balance:n});toast("Saldo diperbarui");loadUsers();loadStats()}catch(e){toast(e.message,true)}
}
async function userPlan(id){const p=prompt("Plan: free / vip / premium","vip");if(!p)return;if(!["free","vip","premium"].includes(p))return toast("Plan tidak valid",true);try{await rpc("admin_set_user",{p_user_id:id,p_plan:p});toast("Plan diperbarui");loadUsers()}catch(e){toast(e.message,true)}}
async function userBan(id,b){try{await edgeAction(b?"unban_user":"ban_user",{user_id:id});toast(b?"User di-unban":"User dibanned");loadUsers();loadStats();}catch(e){toast(e.message,true)}}
async function userDelete(id){if(!confirm("Hapus profile user ini? Auth user juga akan dihapus lewat Admin Function jika dikonfigurasi."))return;try{await rpc("admin_delete_user_profile",{p_user_id:id});await edgeAction("delete_user",{user_id:id});toast("User dihapus");loadUsers();loadStats()}catch(e){toast(e.message,true)}}
async function userPassword(id){const p=prompt("Password baru (min 6 karakter):");if(!p||p.length<6)return toast("Password minimal 6 karakter",true);try{await edgeAction("set_password",{user_id:id,password:p});toast("Password user berhasil diganti")}catch(e){toast(e.message,true)}}
async function edgeAction(action,body={}){const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${window.SHOWLINK_SUPABASE.url}/functions/v1/admin-user-action`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`,"apikey":window.SHOWLINK_SUPABASE.anonKey},body:JSON.stringify({action,...body})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Admin function gagal");return j}
async function loadContent(){
 try{const arr=await rpc("admin_content",{p_type:$("#content-type").value,p_search:$("#content-search").value.trim(),p_status:"all",p_limit:300,p_offset:0});$("#content-body").innerHTML=arr.map(x=>`<tr><td><span class="chip">${esc(x.type)}</span></td><td><span class="user-name">${esc(x.title||x.slug)}</span><span class="sub">/${esc(x.slug)}</span></td><td><span class="chip ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.views??0)}</td><td>${new Date(x.created_at).toLocaleString("id-ID")}</td><td><div class="row-actions"><button class="mini" data-content-edit="${x.type}:${x.id}">Edit</button><button class="mini" data-content-status="${x.type}:${x.id}">Status</button><button class="mini" data-content-del="${x.type}:${x.id}">Hapus</button></div></td></tr>`).join("");
 $$("[data-content-edit]").forEach(b=>b.onclick=()=>contentEdit(...b.dataset.contentEdit.split(":")));$$("[data-content-status]").forEach(b=>b.onclick=()=>contentStatus(...b.dataset.contentStatus.split(":")));$$("[data-content-del]").forEach(b=>b.onclick=()=>contentDelete(...b.dataset.contentDel.split(":")));
 }catch(e){toast(e.message,true)}
}
async function contentEdit(type,id){
 const title=prompt("Judul baru (kosong = tidak diubah):");if(title===null)return;
 const desc=prompt("Deskripsi baru (kosong = tidak diubah):");if(desc===null)return;
 const content=prompt("Content text baru. Multiline gunakan \\n. Kosong = tidak diubah:");
 const html=(type==="pastelink"||type==="payment_link")?prompt("Content HTML baru (kosong = tidak diubah):"):null;
 const price=type==="payment_link"?prompt("Harga baru / IDR (kosong = tidak diubah):"):null;
 try{await rpc("admin_edit_content",{p_type:type,p_id:id,p_title:title||null,p_description:desc||null,p_content_text:content?content.replace(/\\n/g,"\n"):null,p_content_html:html||null,p_price:price?Number(price):null});toast("Konten diperbarui");loadContent()}catch(e){toast(e.message,true)}
}
async function contentStatus(type,id){const s=prompt("Status baru (active/published/paused/unpublished/expired/deleted):");if(!s)return;try{await rpc("admin_edit_content",{p_type:type,p_id:id,p_status:s});toast("Status diperbarui");loadContent()}catch(e){toast(e.message,true)}}
async function contentDelete(type,id){if(!confirm("Tandai konten sebagai deleted?"))return;try{await rpc("admin_delete_content",{p_type:type,p_id:id});toast("Konten diblokir/dihapus");loadContent()}catch(e){toast(e.message,true)}}
async function loadWithdrawals(){try{const arr=await rpc("admin_withdrawals",{p_status:$("#withdraw-status").value,p_limit:300});$("#withdraw-body").innerHTML=arr.map(w=>`<tr><td><span class="user-name">${esc(w.username)}</span><span class="sub">${esc(w.auth_email||"")}</span></td><td>${money(w.amount)}<span class="sub">Net ${money(w.net_amount)}</span></td><td>${esc(w.method_type||"-")}<span class="sub">${esc(w.account_name||"")} · ${esc(w.account_number||"")}</span></td><td><span class="chip ${w.status}">${esc(w.status)}</span></td><td>${new Date(w.created_at).toLocaleString("id-ID")}</td><td><div class="row-actions"><button class="mini" data-wid="${w.id}" data-ws="processing">Process</button><button class="mini" data-wid="${w.id}" data-ws="paid">Approve</button><button class="mini" data-wid="${w.id}" data-ws="rejected">Reject</button><button class="mini" data-wid="${w.id}" data-ws="cancelled">Cancel</button></div></td></tr>`).join("");$$("[data-wid]").forEach(b=>b.onclick=()=>withdrawStatus(b.dataset.wid,b.dataset.ws))}catch(e){toast(e.message,true)}}
async function withdrawStatus(id,status){let note=null;if(status==="rejected")note=prompt("Alasan reject (opsional):");try{await rpc("admin_set_withdrawal_status",{p_id:id,p_status:status,p_note:note});toast("Status withdraw diperbarui");loadWithdrawals();loadStats()}catch(e){toast(e.message,true)}}
async function loadSettings(){try{const s=await rpc("admin_get_settings");$("#set-cpm").value=s.cpm;$("#set-manual").checked=s.manual_withdraw;$("#set-instant").checked=s.instant_withdraw;$("#set-maintenance").checked=s.maintenance;$("#set-maintenance-msg").value=s.maintenance_message||"";$("#set-theme").value=s.theme?.mode||"system"}catch(e){toast(e.message,true)}}
async function saveSettings(){try{const s=await rpc("admin_set_settings",{p_cpm:Number($("#set-cpm").value),p_manual:$("#set-manual").checked,p_instant:$("#set-instant").checked,p_maintenance:$("#set-maintenance").checked,p_maintenance_message:$("#set-maintenance-msg").value,p_theme_mode:$("#set-theme").value});toast("Pengaturan tersimpan");$("#set-cpm").value=s.cpm}catch(e){toast(e.message,true)}}
async function sendAnnouncement(){const title=$("#ann-title").value.trim(),message=$("#ann-message").value.trim(),link=$("#ann-link").value.trim()||null;if(!title||!message)return toast("Judul dan pesan wajib diisi",true);if(!confirm("Kirim pengumuman ke semua user yang tidak dibanned?"))return;try{const r=await rpc("admin_announce",{p_title:title,p_message:message,p_link_url:link});toast(`Terkirim ke ${r.recipients} user`);$("#ann-title").value="";$("#ann-message").value="";$("#ann-link").value=""}catch(e){toast(e.message,true)}}
init();
})();