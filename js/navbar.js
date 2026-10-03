/* ShowLink shared navbar — fixed top bar + sliding side drawer */
(() => {
  "use strict";

  const C={
    home:"/",login:"/login.html",register:"/register.html",
    dashboard:"/dashboard.html",shortlink:"/shortlink.html",
    paymentLink:"/payment-link.html",sub4unlock:"/sub4unlock.html",
    manage:"/kelola-tautan.html",notifications:"/notifikasi.html",
    payment:"/payment.html",profile:"/profil.html",
    settings:"/pengaturan.html",about:"/about.html",
    platform:"/#platform",how:"/#how",help:"/#faq"
  };

  let authUser=null;
  const stored=()=>{try{const x=localStorage.getItem("showlink_user");return x?JSON.parse(x):null}catch{return null}};
  const logged=()=>!!authUser||!!stored();
  const t=k=>window.ShowLinkLanguage?.t?.(k)||({myLinks:"Link saya"}[k]||k);
  const icon=(cls,name)=>`<i class="fa-solid ${name}${cls?` ${cls}`:""}" aria-hidden="true"></i>`;

  const link=(href,ic,key,badge="")=>
    `<a class="sl-nav-link" href="${href}" data-nav-link>
      ${icon(ic.cls,ic.name)}
      <span data-i18n="${key}">${t(key)}</span>${badge}
    </a>`;

  function authMarkup(){
    const badgeNew=`<span class="sl-new-badge sl-new-green"><i class="fa-solid fa-sparkles"></i> New</span>`;
    const badgeBeta=`<span class="sl-new-badge sl-new-yellow"><i class="fa-solid fa-flask"></i> Beta</span>`;
    const badgeSoon=`<span class="sl-new-badge sl-new-gray"><i class="fa-solid fa-clock"></i> Coming soon</span>`;
    return `
      ${link(C.dashboard,{cls:"sl-icon-blue",name:"fa-gauge-high"},"dashboard")}
      <div class="sl-nav-dropdown">
        <button class="sl-nav-link sl-nav-dropdown-toggle" type="button" aria-expanded="false">
          ${icon("sl-icon-purple","fa-plus-circle")}
          <span>Buat Link</span>
          ${icon("sl-dropdown-chevron","fa-chevron-down")}
        </button>
        <div class="sl-nav-dropdown-menu">
          ${link(C.shortlink,{cls:"sl-icon-green",name:"fa-link"},"shortlink",badgeNew)}
          ${link(C.paymentLink,{cls:"sl-icon-yellow",name:"fa-credit-card"},"paymentLink",badgeBeta)}
          ${link(C.sub4unlock,{cls:"sl-icon-orange",name:"fa-unlock-keyhole"},"sub4unlock",badgeSoon)}
        </div>
      </div>
      ${link(C.manage,{cls:"sl-icon-purple",name:"fa-link"},"myLinks")}
      ${link(C.notifications,{cls:"sl-icon-pink",name:"fa-bell"},"notifications")}
      ${link(C.payment,{cls:"sl-icon-green",name:"fa-wallet"},"payment")}
      ${link(C.profile,{cls:"sl-icon-blue",name:"fa-user"},"profile")}
      ${link(C.settings,{cls:"sl-icon-yellow",name:"fa-gear"},"settings")}
      ${link(C.about,{cls:"sl-icon-purple",name:"fa-circle-info"},"about")}
      <div class="sl-drawer-divider"></div>
      <a class="sl-nav-link sl-nav-logout" href="#logout" data-logout>
        ${icon("sl-icon-red","fa-right-from-bracket")}
        <span data-i18n="signOut">${t("signOut")}</span>
      </a>`;
  }

  function guestMarkup(){
    return `
      ${link(C.platform,{cls:"sl-icon-blue",name:"fa-circle-info"},"platformInfo")}
      ${link(C.how,{cls:"sl-icon-orange",name:"fa-route"},"howItWorks")}
      ${link(C.help,{cls:"sl-icon-purple",name:"fa-circle-question"},"help")}`;
  }

  function closeDrawer(){
    const host=document.querySelector("[data-showlink-navbar]");
    if(!host)return;
    const drawer=host.querySelector("[data-showlink-drawer]");
    const overlay=host.querySelector("[data-showlink-overlay]");
    const menu=host.querySelector("[data-showlink-menu]");
    drawer?.classList.remove("is-open");
    overlay?.classList.remove("is-open");
    menu?.setAttribute("aria-expanded","false");
    if(menu)menu.innerHTML=icon("","fa-bars");
    document.documentElement.classList.remove("sl-drawer-open");
  }

  function openDrawer(){
    const host=document.querySelector("[data-showlink-navbar]");
    if(!host)return;
    const drawer=host.querySelector("[data-showlink-drawer]");
    const overlay=host.querySelector("[data-showlink-overlay]");
    const menu=host.querySelector("[data-showlink-menu]");
    drawer?.classList.add("is-open");
    overlay?.classList.add("is-open");
    menu?.setAttribute("aria-expanded","true");
    if(menu)menu.innerHTML=icon("","fa-xmark");
    document.documentElement.classList.add("sl-drawer-open");
  }


  async function applyPlanFeatureLocks(){
    const host=document.querySelector("[data-showlink-navbar]");
    if(!host || !logged()) return;
    try{
      const sb=await window.ShowLinkSupabase?.load?.();
      if(!sb) return;
      const {data:session}=await sb.auth.getSession();
      const uid=session?.session?.user?.id;
      if(!uid) return;
      const {data:profile}=await sb.from("profiles").select("plan").eq("id",uid).maybeSingle();
      const plan=String(profile?.plan||"free").toLowerCase();
      const allowed=plan==="vip"||plan==="premium";
      const links=host.querySelectorAll('a[href="/payment-link.html"]');
      links.forEach(a=>{
        a.classList.toggle("sl-feature-locked",!allowed);
        a.setAttribute("aria-disabled",String(!allowed));
        if(!allowed){
          a.setAttribute("title","Payment Link hanya untuk VIP & Premium");
          a.addEventListener("click",function(e){
            e.preventDefault();
            e.stopPropagation();
            const msg=document.createElement("div");
            msg.className="sl-plan-toast";
            msg.textContent="Payment Link hanya tersedia untuk VIP dan Premium.";
            document.body.appendChild(msg);
            setTimeout(()=>msg.remove(),2600);
          },{once:false});
        }
      });
    }catch(e){}
  }



  async function applyPlatformControl(){
    try{
      const sb=await window.ShowLinkSupabase?.load?.();
      if(!sb)return;
      const {data:s}=await sb.rpc("get_platform_public_settings");
      const m=s?.maintenance;
      if(!m?.enabled)return;
      const {data:ud}=await sb.auth.getUser();
      const email=ud?.user?.email?.toLowerCase()||"";
      if(email==="saputrarmx190301@gmail.com")return;
      const old=document.getElementById("showlink-maintenance-overlay"); if(old)old.remove();
      const el=document.createElement("div");el.id="showlink-maintenance-overlay";
      el.innerHTML=`<div class="sl-maint-card"><div class="sl-maint-icon"><i class="fa-solid fa-screwdriver-wrench"></i></div><span>SHOWLINK</span><h2>Platform sedang maintenance</h2><p>${String(m.message||"ShowLink sedang dalam maintenance.").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</p></div>`;
      Object.assign(el.style,{position:"fixed",inset:"0",zIndex:"999999",display:"grid",placeItems:"center",padding:"20px",background:"rgba(8,8,18,.86)",backdropFilter:"blur(18px)"});
      const card=el.firstElementChild;Object.assign(card.style,{width:"min(460px,100%)",padding:"32px",borderRadius:"26px",textAlign:"center",background:"var(--surface,#fff)",color:"var(--text,#171827)",border:"1px solid rgba(255,255,255,.18)",boxShadow:"0 30px 100px rgba(0,0,0,.35)",fontFamily:"Inter,system-ui,sans-serif"});
      document.body.appendChild(el);
    }catch(e){}
  }

  function render(){
    const host=document.querySelector("[data-showlink-navbar]");
    if(!host)return;

    closeDrawer();
    const is=logged();

    host.innerHTML=`
      <header class="sl-navbar" id="showlink-navbar">
        <div class="sl-nav-shell">
          <button class="sl-nav-menu" type="button" aria-label="${t("openMenu")}" aria-expanded="false" data-showlink-menu>
            ${icon("","fa-bars")}
          </button>

          <a class="sl-brand" href="${C.home}" aria-label="ShowLink">
            <span class="sl-brand-mark"><img src="/assets/showlink-logo.svg" alt="ShowLink"></span>
            <span class="sl-brand-text">Show<span>Link</span></span>
          </a>

          <nav class="sl-nav-links" aria-hidden="true"></nav>

          <div class="sl-nav-actions" data-top-navbar-tools>
            <div data-showlink-tools class="showlink-tools" aria-label="${t("displayOptions")}" data-sl-tools-ready="false">
              <div class="showlink-tool" data-theme-tool>
                <button class="showlink-tool-btn" type="button" aria-label="${t("theme")}" aria-expanded="false" data-theme-toggle>
                  <span class="sl-tool-icon" data-theme-icon><i class="fa-solid fa-moon" aria-hidden="true"></i></span>
                  <span class="showlink-tool-text" data-theme-label>${t("light")}</span>
                </button>
                <div class="showlink-tool-menu" role="menu">
                  <button class="showlink-tool-option" type="button" role="menuitem" data-theme-option="light"><span class="sl-option-icon sl-option-sun"><i class="fa-solid fa-sun" aria-hidden="true"></i></span><span data-i18n="light">${t("light")}</span><span class="sl-check"></span></button>
                  <button class="showlink-tool-option" type="button" role="menuitem" data-theme-option="dark"><span class="sl-option-icon sl-option-moon"><i class="fa-solid fa-moon" aria-hidden="true"></i></span><span data-i18n="dark">${t("dark")}</span><span class="sl-check"></span></button>
                </div>
              </div>
              <div class="showlink-tool" data-language-tool>
                <button class="showlink-tool-btn" type="button" aria-label="${t("language")}" aria-expanded="false" data-language-toggle>
                  <span class="sl-tool-icon"><i class="fa-solid fa-language" aria-hidden="true"></i></span><span class="showlink-lang-label" data-lang-label>ID</span>
                </button>
                <div class="showlink-tool-menu" role="menu">
                  <button class="showlink-tool-option" type="button" role="menuitem" data-lang-option="id"><span class="sl-option-icon"><i class="fa-solid fa-flag" aria-hidden="true"></i></span><span data-i18n="indonesia">${t("indonesia")}</span><span class="sl-check"></span></button>
                  <button class="showlink-tool-option" type="button" role="menuitem" data-lang-option="en"><span class="sl-option-icon"><i class="fa-solid fa-earth-americas" aria-hidden="true"></i></span><span data-i18n="english">${t("english")}</span><span class="sl-check"></span></button>
                </div>
              </div>
            </div>
            ${is ? "" : `
              <a class="sl-btn sl-btn-ghost sl-desktop-action" href="${C.login}">
                ${icon("sl-icon-green","fa-right-to-bracket")}<span data-i18n="login">${t("login")}</span>
              </a>
              <a class="sl-btn sl-btn-primary sl-desktop-action" href="${C.register}">
                ${icon("","fa-user-plus")}<span data-i18n="register">${t("register")}</span>
              </a>
            `}
          </div>
        </div>
      </header>

      <div class="sl-nav-overlay" data-showlink-overlay></div>

      <aside class="sl-nav-drawer" data-showlink-drawer aria-hidden="true">
        <div class="sl-drawer-head">
          <div class="sl-drawer-brand">
            <span class="sl-brand-mark"><img src="/assets/showlink-logo.svg" alt="ShowLink"></span>
            <span>Show<span style="color:var(--sl-primary)">Link</span></span>
          </div>
          <button class="sl-drawer-close" type="button" aria-label="${t("closeMenu")}" data-showlink-close>
            ${icon("","fa-xmark")}
          </button>
        </div>

        <div class="sl-drawer-scroll">
          <nav class="sl-drawer-nav" aria-label="${t("mainNavigation")}">
            ${is ? authMarkup() : guestMarkup()}
          </nav>

          ${is ? "" : `
            <div class="sl-drawer-divider"></div>
            <nav class="sl-drawer-nav">
              <a class="sl-nav-link" href="${C.login}" data-nav-link>
                ${icon("sl-icon-green","fa-right-to-bracket")}<span data-i18n="login">${t("login")}</span>
              </a>
              <a class="sl-nav-link" href="${C.register}" data-nav-link>
                ${icon("sl-icon-yellow","fa-user-plus")}<span data-i18n="register">${t("register")}</span>
              </a>
            </nav>
          `}
        </div>
      </aside>`;

    document.body.classList.add("showlink-navbar-page");
    window.dispatchEvent(new CustomEvent("showlink:navbar-rendered"));
    applyPlanFeatureLocks();
    applyPlatformControl();

    const menu=host.querySelector("[data-showlink-menu]");
    menu?.addEventListener("click",()=>{
      if(host.querySelector("[data-showlink-drawer]")?.classList.contains("is-open")) closeDrawer();
      else openDrawer();
    });
    host.querySelector("[data-showlink-close]")?.addEventListener("click",closeDrawer);
    host.querySelector("[data-showlink-overlay]")?.addEventListener("click",closeDrawer);

    host.querySelectorAll("[data-nav-link]").forEach(a=>{
      a.addEventListener("click",()=>closeDrawer());
    });

    host.querySelectorAll(".sl-nav-dropdown-toggle").forEach(btn=>{
      btn.addEventListener("click",e=>{
        e.preventDefault();
        const dd=btn.closest(".sl-nav-dropdown");
        const open=!dd.classList.contains("is-open");
        host.querySelectorAll(".sl-nav-dropdown").forEach(x=>x.classList.remove("is-open"));
        dd.classList.toggle("is-open",open);
        btn.setAttribute("aria-expanded",String(open));
      });
    });

  }

  function logoutReady(){
    if(window.__showLinkLogoutReady)return;
    window.__showLinkLogoutReady=true;
    document.addEventListener("click",async e=>{
      const b=e.target instanceof Element?e.target.closest("[data-logout]"):null;
      if(!b)return;
      e.preventDefault();
      closeDrawer();
      try{
        if(window.ShowLinkSupabase?.load){
          const sb=await window.ShowLinkSupabase.load();
          await sb.auth.signOut();
        }
      }catch{}
      localStorage.removeItem("showlink_user");
      window.dispatchEvent(new CustomEvent("showlink:auth-change",{detail:{user:null}}));
      location.replace(C.home);
    });
  }

  window.ShowLinkNavbar={
    render,
    refresh:()=>{authUser=stored();render()},
    setAuth:u=>{authUser=u||null;render()}
  };

  window.addEventListener("showlink:auth-change",e=>{
    authUser=e.detail?.user||null;
    render();
  });

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape")closeDrawer();
  });

  // Render is orchestrated by showlink-components.js to avoid duplicate DOM work.
})();
