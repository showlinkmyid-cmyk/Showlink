(() => {
  "use strict";

  const $ = (s, root=document) => root.querySelector(s);
  const t = key => window.ShowLinkLanguage?.t?.(key) || key;
  const alertBox = () => $("[data-auth-alert]");

  function message(id, fallback) {
    return t(id) !== id ? t(id) : fallback;
  }
  function showAlert(msg, success=false) {
    const el=alertBox(); if(!el) return;
    el.textContent=msg;
    el.classList.toggle("auth-success", success);
    el.classList.add("is-visible");
  }
  function hideAlert(){ alertBox()?.classList.remove("is-visible"); }

  function setupPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input=document.getElementById(btn.dataset.target); if(!input) return;
        const show=input.type==="password";
        input.type=show?"text":"password";
        btn.innerHTML=show?'<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>':'<i class="fa-regular fa-eye" aria-hidden="true"></i>';
      });
    });
  }

  function setupStrength() {
    const input=$("#register-password"), bar=$("[data-strength-bar]");
    if(!input||!bar) return;
    input.addEventListener("input",()=>{
      let score=0,v=input.value;
      if(v.length>=8)score++;
      if(/[a-z]/.test(v)&&/[A-Z]/.test(v))score++;
      if(/\d/.test(v))score++;
      if(/[^A-Za-z0-9]/.test(v))score++;
      bar.style.width=`${score*25}%`;
    });
  }


  let turnstileWidgetId = null;

  function turnstileConfigured() {
    const key = window.SHOWLINK_TURNSTILE?.siteKey || "";
    return !!key && !key.includes("YOUR_CLOUDFLARE_TURNSTILE");
  }

  function renderTurnstile() {
    const host = document.querySelector("[data-turnstile-widget]");
    if (!host) return;
    if (!turnstileConfigured()) {
      host.innerHTML = `<div class="turnstile-config-warning">${message("turnstileConfig","Cloudflare Turnstile belum dikonfigurasi.")}</div>`;
      return;
    }

    const render = () => {
      if (!window.turnstile || !host.isConnected || turnstileWidgetId !== null) return;
      try {
        turnstileWidgetId = window.turnstile.render(host, {
          sitekey: window.SHOWLINK_TURNSTILE.siteKey,
          theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
          callback: () => {
            host.classList.add("is-verified");
          },
          "expired-callback": () => {
            host.classList.remove("is-verified");
          },
          "error-callback": () => {
            host.classList.remove("is-verified");
          }
        });
      } catch (err) {
        turnstileWidgetId = null;
      }
    };

    if (window.turnstile?.render) {
      render();
      return;
    }

    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (window.turnstile?.render) {
        clearInterval(timer);
        render();
      } else if (tries >= 100) {
        clearInterval(timer);
      }
    }, 100);
  }

  async function verifyTurnstile() {
    if (!turnstileConfigured()) {
      showAlert(message("turnstileConfig","Cloudflare Turnstile belum dikonfigurasi."));
      return false;
    }
    if (!window.turnstile || turnstileWidgetId === null) {
      showAlert(message("turnstileLoading","Verifikasi keamanan belum siap. Tunggu sebentar lalu coba lagi."));
      return false;
    }
    const token = window.turnstile.getResponse(turnstileWidgetId);
    if (!token) {
      showAlert(message("turnstileRequired","Selesaikan verifikasi keamanan terlebih dahulu."));
      return false;
    }
    try {
      const res = await fetch("/api/turnstile", {
        method: "POST",
        headers: {"content-type":"application/json"},
        credentials: "same-origin",
        body: JSON.stringify({token})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const codes = Array.isArray(data.errors) ? data.errors : [];
        let text = message("turnstileFailed","Verifikasi keamanan gagal. Silakan coba lagi.");
        if (data.code === "server-not-configured") {
          text = message("turnstileConfig","Cloudflare Turnstile belum dikonfigurasi di server.");
        } else if (codes.includes("invalid-input-secret")) {
          text = message("turnstileSecret","Secret Key Cloudflare Turnstile di Cloudflare Pages tidak cocok dengan widget ini.");
        } else if (codes.includes("invalid-input-response")) {
          text = message("turnstileToken","Token verifikasi tidak valid atau sudah kedaluwarsa. Silakan centang lagi.");
        } else if (codes.includes("timeout-or-duplicate")) {
          text = message("turnstileExpired","Verifikasi sudah kedaluwarsa atau sudah digunakan. Silakan centang lagi.");
        }
        window.turnstile.reset(turnstileWidgetId);
        showAlert(text);
        return false;
      }
      return true;
    } catch {
      window.turnstile.reset(turnstileWidgetId);
      showAlert(message("turnstileFailed","Verifikasi keamanan gagal. Silakan coba lagi."));
      return false;
    }
  }

  function resetTurnstile() {
    if (window.turnstile && turnstileWidgetId !== null) {
      try { window.turnstile.reset(turnstileWidgetId); } catch {}
    }
  }

  async function getClient() {
    try { return await window.ShowLinkSupabase.load(); }
    catch(e){ showAlert(e.message || message("authConfigError","Supabase belum dikonfigurasi.")); return null; }
  }

  function persistUser(user) {
    if (!user) return;
    const profile = {
      id:user.id, email:user.email || "",
      user_metadata:user.user_metadata || {}
    };
    localStorage.setItem("showlink_user", JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("showlink:auth-change",{detail:{user:profile}}));
  }

  async function login(form) {
    const email=$('[name="email"]',form)?.value.trim();
    const password=$('[name="password"]',form)?.value||"";
    if(!email) return showAlert(message("requiredField","Email wajib diisi."));
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert(message("invalidEmail","Format email tidak valid."));
    if(!password) return showAlert(message("requiredField","Password wajib diisi."));
    if (!(await verifyTurnstile())) return;
    const sb=await getClient(); if(!sb)return;
    const btn=$(".auth-submit",form); if(btn) btn.disabled=true;
    try {
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      persistUser(data.user);
      showAlert(message("loginSuccess","Login berhasil. Mengalihkan ke dashboard..."),true);
      setTimeout(()=>location.href="/dashboard.html",450);
    } catch(e) {
      showAlert(e.message || message("loginFailed","Email atau password salah."));
    } finally { if(btn)btn.disabled=false; resetTurnstile(); }
  }

  async function register(form) {
    const email=$('[name="email"]',form)?.value.trim();
    const password=$('[name="password"]',form)?.value||"";
    const confirm=$('[name="confirmPassword"]',form)?.value||"";
    const terms=$('[name="terms"]',form);
    if(!email) return showAlert(message("requiredField","Email wajib diisi."));
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert(message("invalidEmail","Format email tidak valid."));
    if(password.length<8) return showAlert(message("passwordHint","Password minimal 8 karakter."));
    if(password!==confirm) return showAlert(message("passwordMismatch","Konfirmasi password tidak sama."));
    if(terms&&!terms.checked) return showAlert(message("authTerms","Setujui ketentuan terlebih dahulu."));
    if (!(await verifyTurnstile())) return;
    const sb=await getClient(); if(!sb)return;
    const btn=$(".auth-submit",form); if(btn)btn.disabled=true;
    try {
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:email.split("@")[0]}}});
      if(error)throw error;
      if(data.session) {
        persistUser(data.user);
        showAlert(message("registerSuccess","Akun berhasil dibuat. Mengalihkan ke dashboard..."),true);
        setTimeout(()=>location.href="/dashboard.html",450);
      } else {
        showAlert(message("confirmEmail","Akun dibuat. Silakan cek email untuk konfirmasi akun sebelum login."),true);
      }
    } catch(e) { showAlert(e.message || message("registerFailed","Pendaftaran gagal.")); }
    finally { if(btn)btn.disabled=false; resetTurnstile(); }
  }

  async function google() {
    const btn = document.querySelector("[data-google-login]");
    hideAlert();
    if (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
    }
    try {
      if (!(await verifyTurnstile())) return;
      const sb=await getClient(); if(!sb)return;
      const {error}=await sb.auth.signInWithOAuth({
        provider:"google",
        options:{
          redirectTo:`${location.origin}/auth-callback.html`,
          queryParams:{access_type:"offline",prompt:"select_account"}
        }
      });
      if(error) throw error;
    } catch(e) {
      showAlert(e?.message || message("googleFailed","Login Google gagal."));
      resetTurnstile();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
      }
    }
  }

  async function forgot() {
    const email=$("#login-email")?.value.trim();
    if(!email)return showAlert(message("enterEmailFirst","Masukkan email terlebih dahulu."));
    const sb=await getClient(); if(!sb)return;
    try{
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/login.html`});
      if(error)throw error;
      showAlert(message("resetSent","Link reset password telah dikirim ke email."),true);
    }catch(e){showAlert(e.message||message("resetFailed","Gagal mengirim reset password."));}
  }

  function setup() {
    setupPasswordToggles(); setupStrength(); renderTurnstile();
    document.querySelectorAll("[data-auth-form]").forEach(form=>{
      form.addEventListener("submit",e=>{
        e.preventDefault();hideAlert();
        form.dataset.authForm==="register"?register(form):login(form);
      });
    });
    document.querySelectorAll("[data-google-login]").forEach(b=>b.addEventListener("click",google));
    document.querySelectorAll('[data-i18n="forgotPassword"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();forgot();}));
  }

  document.addEventListener("DOMContentLoaded",setup);
})();
