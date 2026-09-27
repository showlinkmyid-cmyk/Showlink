(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const t=k=>window.ShowLinkLanguage?.t?.(k)||k;
  const message=(k,f)=>t(k)!==k?t(k):f;
  const alertBox=()=> $("[data-auth-alert]");
  function showAlert(msg,success=false){const el=alertBox();if(!el)return;el.textContent=msg;el.classList.toggle("auth-success",success);el.classList.add("is-visible")}
  function hideAlert(){alertBox()?.classList.remove("is-visible")}
  function setupPasswordToggles(){document.querySelectorAll("[data-password-toggle]").forEach(btn=>btn.addEventListener("click",()=>{const i=document.getElementById(btn.dataset.target);if(!i)return;const show=i.type==="password";i.type=show?"text":"password";btn.innerHTML=show?'<i class="fa-regular fa-eye-slash"></i>':'<i class="fa-regular fa-eye"></i>'}))}
  function setupStrength(){const i=$("#register-password"),b=$("[data-strength-bar]");if(!i||!b)return;i.addEventListener("input",()=>{let s=0,v=i.value;if(v.length>=8)s++;if(/[a-z]/.test(v)&&/[A-Z]/.test(v))s++;if(/\d/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;b.style.width=`${s*25}%`})}
  async function getClient(){try{return await window.ShowLinkSupabase.load()}catch(e){showAlert(e.message||message("authConfigError","Supabase belum dikonfigurasi."));return null}}
  function persistUser(user){if(!user)return;const p={id:user.id,email:user.email||"",user_metadata:user.user_metadata||{}};localStorage.setItem("showlink_user",JSON.stringify(p));if(p.email)localStorage.setItem("showlink_last_email",p.email);window.dispatchEvent(new CustomEvent("showlink:auth-change",{detail:{user:p}}))}
  function rememberUsername(username){if(!username)return;let a=[];try{a=JSON.parse(localStorage.getItem("showlink_usernames")||"[]")}catch{};a=[username,...a.filter(x=>x.toLowerCase()!==username.toLowerCase())].slice(0,5);localStorage.setItem("showlink_usernames",JSON.stringify(a))}

  async function receipt({title,username,email,password}) {
    const old=document.getElementById("auth-receipt"); old?.remove();
    const box=document.createElement("div");box.id="auth-receipt";
    box.innerHTML=`<div class="auth-receipt-backdrop"><div class="auth-receipt-card" id="auth-receipt-card">
      <div class="auth-receipt-icon"><i class="fa-solid fa-circle-check"></i></div>
      <h3>${escapeHtml(title)}</h3><p class="auth-receipt-note">${escapeHtml(message("accountSaved","Data akun berhasil disimpan."))}</p>
      <div class="auth-receipt-row"><span>${escapeHtml(message("username","Username"))}</span><strong>${escapeHtml(username||"-")}</strong></div>
      <div class="auth-receipt-row"><span>${escapeHtml(message("email","Email"))}</span><strong>${escapeHtml(email||"-")}</strong></div>
      <div class="auth-receipt-row auth-receipt-password"><span>${escapeHtml(message("password","Password"))}</span><strong>${escapeHtml(password||"-")}</strong></div>
      <p class="auth-receipt-safe">${escapeHtml(message("passwordReceiptNote","Password ditampilkan hanya di perangkat ini agar bisa kamu simpan sebagai catatan. Password tidak disimpan ke database oleh ShowLink."))}</p>
      <div class="auth-receipt-actions"><button type="button" class="auth-submit" data-save-receipt><i class="fa-solid fa-camera"></i> ${escapeHtml(message("saveScreenshot","Simpan screenshot"))}</button><button type="button" class="auth-secondary" data-close-receipt>${escapeHtml(message("continueDashboard","Lanjut ke Dashboard"))}</button></div>
    </div></div>`;
    document.body.appendChild(box);
    box.querySelector("[data-close-receipt]").onclick=()=>{box.remove();location.replace("/dashboard.html")};
    box.querySelector("[data-save-receipt]").onclick=async()=>{
      const card=$("#auth-receipt-card"); if(!window.html2canvas){showAlert(message("screenshotUnavailable","Screenshot tidak tersedia di browser ini."));return}
      const canvas=await html2canvas(card,{backgroundColor:null,scale:2,useCORS:true});
      const a=document.createElement("a");a.download="showlink-account-success.png";a.href=canvas.toDataURL("image/png");a.click();
    };
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

  async function login(form){
    const email=$('[name="email"]',form)?.value.trim(),password=$('[name="password"]',form)?.value||"";
    if(!email)return showAlert(message("requiredField","Email wajib diisi."));
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showAlert(message("invalidEmail","Format email tidak valid."));
    if(!password)return showAlert(message("requiredField","Password wajib diisi."));
    const sb=await getClient();if(!sb)return;const btn=$(".auth-submit",form);if(btn)btn.disabled=true;
    try{const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;persistUser(data.user);showAlert(message("loginSuccess","Login berhasil."),true);setTimeout(()=>location.replace("/dashboard.html"),350)}
    catch(e){showAlert(e.message||message("loginFailed","Email atau password salah."))}finally{if(btn)btn.disabled=false}
  }

  async function register(form){
    const username=$('[name="username"]',form)?.value.trim()||"",email=$('[name="email"]',form)?.value.trim(),password=$('[name="password"]',form)?.value||"",confirm=$('[name="confirmPassword"]',form)?.value||"",terms=$('[name="terms"]',form);
    if(!/^[A-Za-z0-9_]{3,30}$/.test(username))return showAlert(message("usernameInvalid","Username 3–30 karakter, hanya huruf, angka, dan underscore."));
    if(!email)return showAlert(message("requiredField","Email wajib diisi."));
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showAlert(message("invalidEmail","Format email tidak valid."));
    if(password.length<8)return showAlert(message("passwordHint","Password minimal 8 karakter."));
    if(password!==confirm)return showAlert(message("passwordMismatch","Konfirmasi password tidak sama."));
    if(terms&&!terms.checked)return showAlert(message("authTerms","Setujui ketentuan terlebih dahulu."));
    const sb=await getClient();if(!sb)return;const btn=$(".auth-submit",form);if(btn)btn.disabled=true;
    try{
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{username,display_name:username}}});if(error)throw error;
      rememberUsername(username);
      if(data.session){persistUser(data.user);await receipt({title:message("registerSuccessTitle","Pendaftaran berhasil!"),username,email,password})}
      else showAlert(message("confirmEmail","Akun berhasil dibuat. Silakan cek email untuk konfirmasi akun sebelum login."),true);
    }catch(e){showAlert(e.message||message("registerFailed","Pendaftaran gagal."))}finally{if(btn)btn.disabled=false}
  }

  async function googleAuth(){
    hideAlert();const sb=await getClient();if(!sb)return;
    try{const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${location.origin}/auth-callback.html`}});if(error)throw error}
    catch(e){showAlert(e.message||message("googleFailed","Login Google gagal. Silakan coba lagi."))}
  }

  async function forgot(){
    const email=$("#login-email")?.value.trim();if(!email)return showAlert(message("enterEmailFirst","Masukkan email terlebih dahulu."));
    const sb=await getClient();if(!sb)return;
    try{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/reset-password.html`});if(error)throw error;showAlert(message("resetSent","Link reset password telah dikirim ke email."),true)}
    catch(e){showAlert(e.message||message("resetFailed","Gagal mengirim reset password."))}
  }

  function setup(){
    setupPasswordToggles();setupStrength();
    document.querySelectorAll("[data-auth-form]").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();hideAlert();form.dataset.authForm==="register"?register(form):login(form)}));
    document.querySelectorAll('[data-i18n="forgotPassword"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();location.href="/reset-password.html"}));
    document.querySelectorAll("[data-google-auth]").forEach(b=>b.addEventListener("click",googleAuth));
  }
  document.addEventListener("DOMContentLoaded",setup);
})();