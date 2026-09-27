/* ShowLink shared navbar component. */
(() => {
  "use strict";

  const CONFIG = {
    home: "/", login: "/login.html", register: "/register.html", dashboard: "/dashboard.html",
    shortlink: "/shortlink.html", paymentLink: "/payment-link.html", sub4unlock: "/sub4unlock.html",
    manageLinks: "/kelola-tautan.html", notifications: "/notifikasi.html", payment: "/payment.html",
    profile: "/profil.html", settings: "/pengaturan.html", about: "/about.html",
    platform: "/#platform", how: "/#how", help: "/#faq"
  };

  let authUser = null;
  const getStoredUser = () => { try { const raw = localStorage.getItem("showlink_user"); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const isLoggedIn = () => !!authUser || !!getStoredUser();
  const icon = (cls, name) => `<i class="fa-solid ${name} ${cls || ""}" aria-hidden="true"></i>`;
  const t = (key) => window.ShowLinkLanguage?.t?.(key) || key;

  function render() {
    const host = document.querySelector("[data-showlink-navbar]");
    if (!host) return;
    const loggedIn = isLoggedIn();
    const guestLinks = `
      <a class="sl-nav-link" href="${CONFIG.platform}">${icon("sl-icon-blue","fa-circle-info")}<span data-i18n="platformInfo">${t("platformInfo")}</span></a>
      <a class="sl-nav-link" href="${CONFIG.how}">${icon("sl-icon-orange","fa-route")}<span data-i18n="howItWorks">${t("howItWorks")}</span></a>
      <a class="sl-nav-link" href="${CONFIG.help}">${icon("sl-icon-purple","fa-circle-question")}<span data-i18n="help">${t("help")}</span></a>`;
    const authLinks = `
      <a class="sl-nav-link" href="${CONFIG.dashboard}">${icon("sl-icon-blue","fa-gauge-high")}<span data-i18n="dashboard">${t("dashboard")}</span></a>
      <div class="sl-nav-dropdown"><button class="sl-nav-link sl-nav-dropdown-toggle" type="button" aria-expanded="false">${icon("sl-icon-purple","fa-link")}<span data-i18n="manageLinks">${t("manageLinks")}</span>${icon("sl-dropdown-chevron","fa-chevron-down")}</button>
        <div class="sl-nav-dropdown-menu">
          <a class="sl-nav-link" href="${CONFIG.shortlink}">${icon("sl-icon-green","fa-link")}<span data-i18n="shortlink">${t("shortlink")}</span><span class="sl-new-badge sl-new-green"><i class="fa-solid fa-fire"></i> New</span></a>
          <a class="sl-nav-link" href="${CONFIG.paymentLink}">${icon("sl-icon-yellow","fa-credit-card")}<span data-i18n="paymentLink">${t("paymentLink")}</span><span class="sl-new-badge sl-new-yellow"><i class="fa-solid fa-fire"></i> New</span></a>
          <a class="sl-nav-link" href="${CONFIG.sub4unlock}">${icon("sl-icon-orange","fa-unlock-keyhole")}<span data-i18n="sub4unlock">${t("sub4unlock")}</span></a>
        </div>
      </div>
      <a class="sl-nav-link" href="${CONFIG.notifications}">${icon("sl-icon-pink","fa-bell")}<span data-i18n="notifications">${t("notifications")}</span></a>
      <a class="sl-nav-link" href="${CONFIG.payment}">${icon("sl-icon-green","fa-wallet")}<span data-i18n="payment">${t("payment")}</span></a>
      <a class="sl-nav-link" href="${CONFIG.profile}">${icon("sl-icon-blue","fa-user")}<span data-i18n="profile">${t("profile")}</span></a>
      <a class="sl-nav-link" href="${CONFIG.settings}">${icon("sl-icon-yellow","fa-gear")}<span data-i18n="settings">${t("settings")}</span></a>
      <a class="sl-nav-link" href="${CONFIG.about}">${icon("sl-icon-purple","fa-circle-info")}<span data-i18n="about">${t("about")}</span></a>
      <a class="sl-nav-link sl-nav-logout" href="#logout" data-logout>${icon("sl-icon-red","fa-right-from-bracket")}<span data-i18n="signOut">${t("signOut")}</span></a>`;

    host.innerHTML = `<header class="sl-navbar" id="showlink-navbar"><div class="sl-container sl-navbar-inner">
      <button class="sl-nav-menu" type="button" aria-label="${t("openMenu")}" aria-expanded="false" data-showlink-menu>${icon("","fa-bars")}</button>
      <a class="sl-brand" href="${CONFIG.home}" aria-label="ShowLink"><span class="sl-brand-mark">${icon("","fa-link")}</span><span class="sl-brand-text">Show<span>Link</span></span></a>
      <nav class="sl-nav-links" aria-label="${t("mainNavigation")}">${loggedIn ? authLinks : guestLinks}</nav>
      <div class="sl-nav-actions"><div data-showlink-tools class="showlink-tools" aria-label="${t("displayOptions")}"></div>
        ${loggedIn ? "" : `<a class="sl-btn sl-btn-ghost sl-desktop-action" href="${CONFIG.login}">${icon("sl-icon-green","fa-right-to-bracket")}<span data-i18n="login">${t("login")}</span></a><a class="sl-btn sl-btn-primary sl-desktop-action" href="${CONFIG.register}">${icon("","fa-user-plus")}<span data-i18n="register">${t("register")}</span></a>`}
      </div></div>
      <div class="sl-mobile-panel" data-showlink-mobile><div class="sl-container">${loggedIn ? authLinks : `${guestLinks}<a class="sl-mobile-link" href="${CONFIG.login}">${icon("sl-icon-green","fa-right-to-bracket")}<span data-i18n="login">${t("login")}</span></a><a class="sl-mobile-link" href="${CONFIG.register}">${icon("sl-icon-yellow","fa-user-plus")}<span data-i18n="register">${t("register")}</span></a>`}</div></div>
    </header>`;

    const menu = host.querySelector("[data-showlink-menu]"), panel = host.querySelector("[data-showlink-mobile]");
    menu?.addEventListener("click", () => { const open = panel?.classList.toggle("open"); menu.setAttribute("aria-expanded", String(!!open)); menu.innerHTML = icon("", open ? "fa-xmark" : "fa-bars"); });
    panel?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => { panel.classList.remove("open"); menu?.setAttribute("aria-expanded","false"); if(menu) menu.innerHTML=icon("","fa-bars"); }));
    host.querySelectorAll(".sl-nav-dropdown-toggle").forEach(btn => btn.addEventListener("click", e => { e.preventDefault(); const dd=btn.closest(".sl-nav-dropdown"); const open=dd?.classList.toggle("is-open"); btn.setAttribute("aria-expanded",String(!!open)); }));
  }

  function logoutReady() {
    if (window.__showLinkLogoutReady) return;
    window.__showLinkLogoutReady = true;
    document.addEventListener("click", async e => {
      const btn = e.target instanceof Element ? e.target.closest("[data-logout]") : null;
      if (!btn) return;
      e.preventDefault();
      try { if (window.ShowLinkSupabase?.load) { const sb=await window.ShowLinkSupabase.load(); await sb.auth.signOut(); } } catch (_) {}
      localStorage.removeItem("showlink_user");
      window.dispatchEvent(new CustomEvent("showlink:auth-change", {detail:{user:null}}));
      location.replace("/login.html");
    });
  }

  window.ShowLinkNavbar = { render, refresh: () => { authUser=getStoredUser(); render(); }, setAuth: user => { authUser=user||null; render(); } };
  window.addEventListener("showlink:auth-change", e => { authUser=e.detail?.user||null; render(); });
  document.addEventListener("DOMContentLoaded", () => { authUser=getStoredUser(); logoutReady(); render(); });
})();
