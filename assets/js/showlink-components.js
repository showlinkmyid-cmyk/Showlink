/**
 * ShowLink shared UI
 *
 * Import once:
 * <script src="/assets/js/showlink-components.js" defer></script>
 *
 * Guest navbar:
 *   Informasi Platform | Cara Kerja | Bantuan | Login | Register
 *
 * Authenticated navbar can be activated later by:
 *   window.ShowLinkUI.setAuth(userObject)
 *
 * This is UI state only. Real authorization must remain in Supabase RLS/RPC.
 */
(() => {
  "use strict";

  const CONFIG = {
    brand: "ShowLink",
    home: "/",
    login: "/login.html",
    register: "/register.html",
    dashboard: "/dashboard.html",
    createPasteLink: "/create-pastelink.html",
    createPaymentLink: "/create-payment-link.html",
    terms: "/terms.html",
    privacy: "/privacy.html",
    contact: "/contact.html",
    platform: "/#platform",
    how: "/#how",
    help: "/#faq"
  };

  let authUser = null;

  function getStoredUser() {
    try {
      const raw = localStorage.getItem("showlink_user");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!authUser || !!getStoredUser();
  }

  function icon(cls, name) {
    return `<i class="fa-solid ${name} ${cls || ""}" aria-hidden="true"></i>`;
  }

  function renderNavbar() {
    const host = document.querySelector("[data-showlink-navbar]");
    if (!host) return;

    const loggedIn = isLoggedIn();

    const guestLinks = `
      <a class="sl-nav-link" href="${CONFIG.platform}">
        ${icon("sl-icon-blue","fa-circle-info")} Informasi Platform
      </a>
      <a class="sl-nav-link" href="${CONFIG.how}">
        ${icon("sl-icon-orange","fa-route")} Cara Kerja
      </a>
      <a class="sl-nav-link" href="${CONFIG.help}">
        ${icon("sl-icon-purple","fa-circle-question")} Bantuan
      </a>`;

    const authLinks = `
      <a class="sl-nav-link" href="${CONFIG.dashboard}">
        ${icon("sl-icon-blue","fa-house")} Dashboard
      </a>
      <a class="sl-nav-link" href="${CONFIG.createPasteLink}">
        ${icon("sl-icon-purple","fa-file-circle-plus")} PasteLink
      </a>
      <a class="sl-nav-link" href="${CONFIG.createPaymentLink}">
        ${icon("sl-icon-pink","fa-credit-card")} Payment Link
      </a>
      <a class="sl-nav-link" href="${CONFIG.dashboard}#analytics">
        ${icon("sl-icon-green","fa-chart-line")} Analytics
      </a>`;

    host.innerHTML = `
      <div class="sl-shared">
        <header class="sl-navbar" id="showlink-navbar">
          <div class="sl-container sl-navbar-inner">
            <a class="sl-brand" href="${CONFIG.home}" aria-label="ShowLink">
              <span class="sl-brand-mark">${icon("","fa-link")}</span>
              <span class="sl-brand-text">Show<span>Link</span></span>
            </a>

            <nav class="sl-nav-links" aria-label="Navigasi utama">
              ${loggedIn ? authLinks : guestLinks}
            </nav>

            <div class="sl-nav-actions">
              ${
                loggedIn
                  ? `<a class="sl-btn sl-btn-primary" href="${CONFIG.dashboard}">
                       ${icon("","fa-gauge-high")} Dashboard
                     </a>`
                  : `
                    <a class="sl-btn sl-btn-ghost" href="${CONFIG.login}">
                      ${icon("sl-icon-green","fa-right-to-bracket")} Login
                    </a>
                    <a class="sl-btn sl-btn-primary" href="${CONFIG.register}">
                      ${icon("","fa-user-plus")} Register
                    </a>
                  `
              }
              <button class="sl-nav-menu" type="button"
                aria-label="Buka menu" aria-expanded="false"
                data-showlink-menu>
                ${icon("","fa-bars")}
              </button>
            </div>
          </div>

          <div class="sl-mobile-panel" data-showlink-mobile>
            <div class="sl-container">
              ${
                loggedIn
                  ? `${authLinks}
                     <a class="sl-mobile-link" href="${CONFIG.dashboard}#settings">
                       ${icon("sl-icon-yellow","fa-gear")} Settings
                     </a>`
                  : `${guestLinks}
                     <a class="sl-mobile-link" href="${CONFIG.login}">
                       ${icon("sl-icon-green","fa-right-to-bracket")} Login
                     </a>
                     <a class="sl-mobile-link" href="${CONFIG.register}">
                       ${icon("sl-icon-yellow","fa-user-plus")} Register
                     </a>`
              }
            </div>
          </div>
        </header>
      </div>
    `;

    const menu = host.querySelector("[data-showlink-menu]");
    const panel = host.querySelector("[data-showlink-mobile]");

    menu?.addEventListener("click", () => {
      const open = panel?.classList.toggle("open");
      menu.setAttribute("aria-expanded", String(!!open));
      menu.innerHTML = icon("", open ? "fa-xmark" : "fa-bars");
    });

    panel?.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        panel.classList.remove("open");
        menu?.setAttribute("aria-expanded", "false");
        if (menu) menu.innerHTML = icon("", "fa-bars");
      });
    });
  }

  function renderFooter() {
    const host = document.querySelector("[data-showlink-footer]");
    if (!host) return;

    const year = new Date().getFullYear();

    host.innerHTML = `
      <div class="sl-shared">
        <footer class="sl-footer">
          <div class="sl-container sl-footer-main">
            <a class="sl-footer-brand" href="${CONFIG.home}" aria-label="ShowLink">
              <span class="sl-brand-mark">${icon("","fa-link")}</span>
              <span class="sl-footer-brand-text">
                <strong>ShowLink</strong>
                <small>Simple digital links.</small>
              </span>
            </a>

            <nav class="sl-footer-links" aria-label="Footer">
              <a href="${CONFIG.terms}">Terms of Service</a>
              <a href="${CONFIG.privacy}">Privacy Policy</a>
              <a href="${CONFIG.contact}">Contact Person</a>
            </nav>
          </div>

          <div class="sl-container sl-footer-bottom">
            <span>Copyright © ${year} <strong>ShowLink</strong>. All Rights Reserved.</span>
            <span>${icon("sl-icon-green","fa-shield-halved")} Secure digital platform</span>
          </div>
        </footer>
      </div>
    `;
  }

  function render() {
    renderNavbar();
    renderFooter();
  }

  window.ShowLinkUI = {
    config: Object.freeze({ ...CONFIG }),
    setAuth(user) {
      authUser = user || null;
      render();
    },
    clearAuth() {
      authUser = null;
      render();
    },
    refresh() {
      authUser = getStoredUser();
      render();
    },
    isLoggedIn
  };

  // Allow login/auth code to notify every page without coupling components
  // to a specific authentication SDK.
  window.addEventListener("showlink:auth-change", (event) => {
    authUser = event.detail?.user || null;
    render();
  });

  document.addEventListener("DOMContentLoaded", () => {
    authUser = getStoredUser();
    render();
  });
})();
