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
            <div data-showlink-tools class="showlink-tools" aria-label="ShowLink tools"></div></nav>

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


/* ============================================================
   ShowLink Theme + Language Manager
   ============================================================ */
(function () {
  const THEME_KEY = "showlink-theme";
  const LANG_KEY = "showlink-language";

  const translations = {
    id: {
      platformInfo: "Informasi Platform",
      howItWorks: "Cara Kerja",
      help: "Bantuan",
      login: "Login",
      register: "Register",
      theme: "Tema",
      light: "Terang",
      dark: "Gelap",
      language: "Bahasa",
      indonesia: "Indonesia",
      english: "Inggris",
      terms: "Ketentuan Layanan",
      privacy: "Kebijakan Privasi",
      contact: "Kontak",
      allRights: "Hak cipta dilindungi.",
      create: "Buat sekarang",
      pasteLink: "PasteLink",
      paymentLink: "Payment Link"
    },
    en: {
      platformInfo: "Platform Information",
      howItWorks: "How It Works",
      help: "Help",
      login: "Login",
      register: "Register",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      language: "Language",
      indonesia: "Indonesian",
      english: "English",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      contact: "Contact",
      allRights: "All rights reserved.",
      create: "Create now",
      pasteLink: "PasteLink",
      paymentLink: "Payment Link"
    }
  };

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }

  function getLanguage() {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === "en" ? "en" : "id";
  }

  function applyTheme(theme, persist = true) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    if (persist) localStorage.setItem(THEME_KEY, theme);

    document.querySelectorAll("[data-theme-label]").forEach(el => {
      el.textContent = theme === "dark"
        ? (translations[getLanguage()].dark || "Dark")
        : (translations[getLanguage()].light || "Light");
    });

    document.querySelectorAll("[data-theme-icon]").forEach(el => {
      el.textContent = theme === "dark" ? "☀️" : "🌙";
    });
  }

  function applyLanguage(lang, persist = true) {
    lang = lang === "en" ? "en" : "id";
    document.documentElement.setAttribute("lang", lang);
    if (persist) localStorage.setItem(LANG_KEY, lang);

    const t = translations[lang];

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (Object.prototype.hasOwnProperty.call(t, key)) {
        if (el.dataset.i18nHtml === "true") el.innerHTML = t[key];
        else el.textContent = t[key];
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (Object.prototype.hasOwnProperty.call(t, key)) {
        el.setAttribute("placeholder", t[key]);
      }
    });

    document.querySelectorAll("[data-lang-option]").forEach(el => {
      const active = el.getAttribute("data-lang-option") === lang;
      el.classList.toggle("is-active", active);
      const check = el.querySelector(".sl-check");
      if (check) check.textContent = active ? "✓" : "";
    });

    document.querySelectorAll("[data-lang-label]").forEach(el => {
      el.textContent = lang === "en" ? "EN" : "ID";
    });

    applyTheme(getTheme(), false);
  }

  function closeToolMenus(except) {
    document.querySelectorAll(".showlink-tool.is-open").forEach(tool => {
      if (tool !== except) tool.classList.remove("is-open");
    });
  }

  function buildControls() {
    document.querySelectorAll("[data-showlink-tools]").forEach(container => {
      if (container.dataset.slToolsReady === "true") return;
      container.dataset.slToolsReady = "true";

      container.innerHTML = `
        <div class="showlink-tool" data-theme-tool>
          <button class="showlink-tool-btn" type="button"
                  aria-label="Theme" aria-expanded="false"
                  data-theme-toggle>
            <span class="sl-tool-icon" data-theme-icon>🌙</span>
            <span class="showlink-tool-text" data-theme-label>Terang</span>
          </button>
          <div class="showlink-tool-menu" role="menu">
            <button class="showlink-tool-option" type="button"
                    data-theme-option="light">
              <span>☀️</span><span data-i18n="light">Terang</span>
              <span class="sl-check"></span>
            </button>
            <button class="showlink-tool-option" type="button"
                    data-theme-option="dark">
              <span>🌙</span><span data-i18n="dark">Gelap</span>
              <span class="sl-check"></span>
            </button>
          </div>
        </div>

        <div class="showlink-tool" data-language-tool>
          <button class="showlink-tool-btn" type="button"
                  aria-label="Language" aria-expanded="false"
                  data-language-toggle>
            <span class="sl-tool-icon">🌐</span>
            <span class="showlink-lang-label" data-lang-label>ID</span>
          </button>
          <div class="showlink-tool-menu" role="menu">
            <button class="showlink-tool-option" type="button"
                    data-lang-option="id">
              <span>🇮🇩</span><span data-i18n="indonesia">Indonesia</span>
              <span class="sl-check"></span>
            </button>
            <button class="showlink-tool-option" type="button"
                    data-lang-option="en">
              <span>🇬🇧</span><span data-i18n="english">Inggris</span>
              <span class="sl-check"></span>
            </button>
          </div>
        </div>
      `;

      const themeTool = container.querySelector("[data-theme-tool]");
      const langTool = container.querySelector("[data-language-tool]");

      container.querySelector("[data-theme-toggle]").addEventListener("click", (e) => {
        e.stopPropagation();
        const open = themeTool.classList.toggle("is-open");
        langTool.classList.remove("is-open");
        e.currentTarget.setAttribute("aria-expanded", String(open));
      });

      container.querySelector("[data-language-toggle]").addEventListener("click", (e) => {
        e.stopPropagation();
        const open = langTool.classList.toggle("is-open");
        themeTool.classList.remove("is-open");
        e.currentTarget.setAttribute("aria-expanded", String(open));
      });

      container.querySelectorAll("[data-theme-option]").forEach(btn => {
        btn.addEventListener("click", () => {
          applyTheme(btn.getAttribute("data-theme-option"));
          themeTool.classList.remove("is-open");
          container.querySelector("[data-theme-toggle]").setAttribute("aria-expanded", "false");
        });
      });

      container.querySelectorAll("[data-lang-option]").forEach(btn => {
        btn.addEventListener("click", () => {
          applyLanguage(btn.getAttribute("data-lang-option"));
          langTool.classList.remove("is-open");
          container.querySelector("[data-language-toggle]").setAttribute("aria-expanded", "false");
        });
      });
    });
  }

  function boot() {
    applyTheme(getTheme(), false);
    applyLanguage(getLanguage(), false);
    buildControls();
    applyLanguage(getLanguage(), false);
  }

  document.addEventListener("click", () => closeToolMenus());
  document.addEventListener("DOMContentLoaded", boot);

  window.ShowLinkTheme = { applyTheme, getTheme };
  window.ShowLinkLanguage = { applyLanguage, getLanguage, translations };
})();
