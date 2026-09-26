(() => {
  "use strict";

  const t = (key) => window.ShowLinkLanguage?.t?.(key) || key;
  const alertBox = () => document.querySelector("[data-auth-alert]");

  function showAlert(message, success=false) {
    const el = alertBox();
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("auth-success", success);
    el.classList.add("is-visible");
  }

  function hideAlert() {
    const el = alertBox();
    if (el) el.classList.remove("is-visible");
  }

  function setupPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.innerHTML = showing
          ? '<i class="fa-regular fa-eye" aria-hidden="true"></i>'
          : '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>';
        btn.setAttribute("aria-label", showing ? t("showPassword") : t("hidePassword"));
      });
    });
  }

  function setupRegisterStrength() {
    const input = document.querySelector("#register-password");
    const bar = document.querySelector("[data-strength-bar]");
    if (!input || !bar) return;
    input.addEventListener("input", () => {
      const value = input.value;
      let score = 0;
      if (value.length >= 8) score++;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
      if (/\d/.test(value)) score++;
      if (/[^A-Za-z0-9]/.test(value)) score++;
      bar.style.width = `${Math.min(100, score * 25)}%`;
    });
  }

  function setupForms() {
    document.querySelectorAll("[data-auth-form]").forEach(form => {
      form.addEventListener("submit", event => {
        event.preventDefault();
        hideAlert();

        const email = form.querySelector('[name="email"]');
        const password = form.querySelector('[name="password"]');
        const confirm = form.querySelector('[name="confirmPassword"]');

        if (!email?.value.trim()) {
          showAlert(t("requiredField")); email?.focus(); return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
          showAlert(t("invalidEmail")); email.focus(); return;
        }
        if (!password?.value) {
          showAlert(t("requiredField")); password?.focus(); return;
        }
        if (form.dataset.authForm === "register") {
          if (password.value.length < 8) {
            showAlert(t("passwordHint")); password.focus(); return;
          }
          if (password.value !== confirm?.value) {
            showAlert(t("passwordMismatch")); confirm?.focus(); return;
          }
          const terms = form.querySelector('[name="terms"]');
          if (terms && !terms.checked) {
            showAlert(t("authTerms")); return;
          }
          showAlert(
            document.documentElement.lang === "en"
              ? "Registration form is ready. Connect your authentication backend to create the account."
              : "Form pendaftaran sudah siap. Hubungkan backend autentikasi untuk membuat akun.",
            true
          );
        } else {
          showAlert(
            document.documentElement.lang === "en"
              ? "Login form is ready. Connect your authentication backend to sign in."
              : "Form login sudah siap. Hubungkan backend autentikasi untuk masuk.",
            true
          );
        }
      });
    });
  }

  function setupGoogle() {
    document.querySelectorAll("[data-google-login]").forEach(btn => {
      btn.addEventListener("click", () => {
        showAlert(
          document.documentElement.lang === "en"
            ? "Google authentication needs to be connected to your authentication provider."
            : "Autentikasi Google perlu dihubungkan ke provider autentikasi kamu."
        );
      });
    });
  }

  function setupForgot() {
    document.querySelectorAll('[href="#"][data-i18n="forgotPassword"]').forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        showAlert(
          document.documentElement.lang === "en"
            ? "Password reset needs to be connected to your authentication provider."
            : "Reset password perlu dihubungkan ke provider autentikasi kamu."
        );
      });
    });
  }

  function boot() {
    setupPasswordToggles();
    setupRegisterStrength();
    setupForms();
    setupGoogle();
    setupForgot();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
