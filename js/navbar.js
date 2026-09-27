/* ShowLink shared navbar. */
(() => {
  "use strict";
  const C={home:"/",login:"/login.html",register:"/register.html",dashboard:"/dashboard.html",shortlink:"/shortlink.html",paymentLink:"/payment-link.html",sub4unlock:"/sub4unlock.html",manage:"/kelola-tautan.html",notifications:"/notifikasi.html",payment:"/payment.html",profile:"/profil.html",settings:"/pengaturan.html",about:"/about.html",platform:"/#platform",how:"/#how",help:"/#faq"};
  let authUser=null;
  const stored=()=>{try{const x=localStorage.getItem("showlink_user");return x?JSON.parse(x):null}catch{return null}};
  const logged=()=>!!authUser||!!stored();
  const icon=(cls,name)=>`<i class="fa-solid ${name}${cls?` ${cls}`:""}" aria-hidden="true"></i>`;
  const t=k=>window.ShowLinkLanguage?.t?.(k)||k;
  const link=(href,ic,cls,key,badge="")=>`<a class="sl-nav-link${cls?` ${cls}`:""}" href="${href}">${icon(ic.cls,ic.name)}<span data-i18n="${key}">${t(key)}</span>${badge}</a>`;
  function authMarkup(mobile=false){
    const badge1=`<span class="sl-new-badge sl-new-green"><i class="fa-solid fa-fire"></i> New</span>`;
    const badge2=`<span class="sl-new-badge sl-new-yellow"><i class="fa-solid fa-fire"></i> New</span>`;
    const inner=`
      ${link(C.dashboard,{cls:"sl-icon-blue",name:"fa-gauge-high"},"","dashboard")}
      <div class="sl-nav-dropdown">
        <button class="sl-nav-link sl-nav-dropdown-toggle" type="button" aria-expanded="false">${icon("sl-icon-purple","fa-link")}<span data-i18n="manageLinks">${t("manageLinks")}</span>${icon("sl-dropdown-chevron","fa-chevron-down")}</button>
        <div class="sl-nav-dropdown-menu">
          ${link(C.shortlink,{cls:"sl-icon-green",name:"fa-link"},"","shortlink",badge1)}
          ${link(C.paymentLink,{cls:"sl-icon-yellow",name:"fa-credit-card"},"","paymentLink",badge2)}
          ${link(C.sub4unlock,{cls:"sl-icon-orange",name:"fa-unlock-keyhole"},"","sub4unlock")}
        </div>
      </div>
      ${link(C.notifications,{cls:"sl-icon-pink",name:"fa-bell"},"","notifications")}
      ${link(C.payment,{cls:"sl-icon-green",name:"fa-wallet"},"","payment")}
      ${link(C.profile,{cls:"sl-icon-blue",name:"fa-user"},"","profile")}
      ${link(C.settings,{cls:"sl-icon-yellow",name:"fa-gear"},"","settings")}
      ${link(C.about,{cls:"sl-icon-purple",name:"fa-circle-info"},"","about")}
      <a class="sl-nav-link sl-nav-logout" href="#logout" data-logout>${icon("sl-icon-red","fa-right-from-bracket")}<span data-i18n="signOut">${t("signOut")}</span></a>`;
    return inner;
  }
  function guestMarkup(){return `${link(C.platform,{cls:"sl-icon-blue",name:"fa-circle-info"},"","platformInfo")}${link(C.how,{cls:"sl-icon-orange",name:"fa-route"},"","howItWorks")}${link(C.help,{cls:"sl-icon-purple",name:"fa-circle-question"},"","help")}`}
  function render(){
    const host=document.querySelector("[data-showlink-navbar]"); if(!host)return;
    const is=logged();
    host.innerHTML=`<header class="sl-navbar" id="showlink-navbar"><div class="sl-nav-shell">
      <button class="sl-nav-menu" type="button" aria-label="${t("openMenu")}" aria-expanded="false" data-showlink-menu>${icon("","fa-bars")}</button>
      <a class="sl-brand" href="${C.home}" aria-label="ShowLink"><span class="sl-brand-mark">${icon("","fa-link")}</span><span class="sl-brand-text">Show<span>Link</span></span></a>
      <nav class="sl-nav-links" aria-label="${t("mainNavigation")}">${is?authMarkup(false):guestMarkup()}</nav>
      <div class="sl-nav-actions"><div data-showlink-tools class="showlink-tools" aria-label="${t("displayOptions")}"></div>${is?"":`<a class="sl-btn sl-btn-ghost sl-desktop-action" href="${C.login}">${icon("sl-icon-green","fa-right-to-bracket")}<span data-i18n="login">${t("login")}</span></a><a class="sl-btn sl-btn-primary sl-desktop-action" href="${C.register}">${icon("","fa-user-plus")}<span data-i18n="register">${t("register")}</span></a>`}</div>
    </div><div class="sl-mobile-panel" data-showlink-mobile><div class="sl-mobile-shell">${is?authMarkup(true):`${guestMarkup()}<a class="sl-mobile-link" href="${C.login}">${icon("sl-icon-green","fa-right-to-bracket")}<span data-i18n="login">${t("login")}</span></a><a class="sl-mobile-link" href="${C.register}">${icon("sl-icon-yellow","fa-user-plus")}<span data-i18n="register">${t("register")}</span></a>`}</div></div></header>`;
    const menu=host.querySelector("[data-showlink-menu]"),panel=host.querySelector("[data-showlink-mobile]");
    menu?.addEventListener("click",()=>{const open=panel?.classList.toggle("open");menu.setAttribute("aria-expanded",String(!!open));menu.innerHTML=icon("",open?"fa-xmark":"fa-bars")});
    panel?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{panel.classList.remove("open");menu?.setAttribute("aria-expanded","false");if(menu)menu.innerHTML=icon("","fa-bars")}));
    host.querySelectorAll(".sl-nav-dropdown-toggle").forEach(btn=>btn.addEventListener("click",e=>{e.preventDefault();const dd=btn.closest(".sl-nav-dropdown");const open=dd.classList.toggle("is-open");btn.setAttribute("aria-expanded",String(open));host.querySelectorAll(".sl-nav-dropdown").forEach(x=>{if(x!==dd)x.classList.remove("is-open")})}));
  }
  function logoutReady(){if(window.__showLinkLogoutReady)return;window.__showLinkLogoutReady=true;document.addEventListener("click",async e=>{const b=e.target instanceof Element?e.target.closest("[data-logout]"):null;if(!b)return;e.preventDefault();try{if(window.ShowLinkSupabase?.load){const sb=await window.ShowLinkSupabase.load();await sb.auth.signOut()}}catch{}localStorage.removeItem("showlink_user");window.dispatchEvent(new CustomEvent("showlink:auth-change",{detail:{user:null}}));location.replace(C.login)})}
  window.ShowLinkNavbar={render,refresh:()=>{authUser=stored();render()},setAuth:u=>{authUser=u||null;render()}};
  window.addEventListener("showlink:auth-change",e=>{authUser=e.detail?.user||null;render()});
  document.addEventListener("DOMContentLoaded",()=>{authUser=stored();logoutReady();render()});
})();
