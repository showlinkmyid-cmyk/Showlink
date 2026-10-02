(() => {
  "use strict";

  const MIN_PRICE = 2000;
  const MAX_PRICE = 10000000;
  const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeUrl(value) {
    const url = String(value || "").trim();
    return /^www\./i.test(url) ? `https://${url}` : url;
  }

  function linkifyContent(text) {
    return escapeHtml(text).replace(URL_RE, (match) => {
      const trailing = match.match(/[.,!?;:)\]}]+$/)?.[0] || "";
      const clean = trailing ? match.slice(0, -trailing.length) : match;
      return `<a href="${escapeHtml(normalizeUrl(clean))}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a>${escapeHtml(trailing)}`;
    }).replace(/\r?\n/g, "<br>");
  }

  function rupiah(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(value);
  }

  function showError(selector, show) {
    const el = $(selector);
    if (el) el.hidden = !show;
  }

  function setResult(message, type = "info", link = "") {
    const box = $("#create-result");
    if (!box) return;
    box.hidden = false;
    box.className = `payment-result ${type}`;
    box.innerHTML = message + (link ? ` <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>` : "");
  }

  function validate(form) {
    const title = form.elements.title.value.trim();
    const content = form.elements.content.value.trim();
    const price = Number(form.elements.price.value);

    const badTitle = title.length < 1;
    const badContent = content.length < 1;
    const badPrice = !Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE;

    showError("[data-title-warning]", badTitle);
    showError("[data-content-warning]", badContent);
    showError("[data-price-warning]", badPrice);

    return !badTitle && !badContent && !badPrice;
  }

  function normalizePaymentUrl(url) {
    const value = String(url || "");
    return value.replace("/d/", "/p/");
  }


  async function assertPaymentLinkPlan(sb) {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !sessionData?.session?.user?.id) {
      throw new Error(t("payment.session_error"));
    }
    const uid = sessionData.session.user.id;
    const { data: profile, error } = await sb.from("profiles").select("plan").eq("id", uid).maybeSingle();
    if (error) throw error;
    const plan = String(profile?.plan || "free").toLowerCase();
    if (plan !== "vip" && plan !== "premium") {
      throw new Error(t("payment.plan_locked"));
    }
    return plan;
  }

  async function createPaymentLink(form) {
    const sb = await window.ShowLinkSupabase.load();
    await assertPaymentLinkPlan(sb);
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !sessionData?.session) {
      throw new Error(t("payment.session_error"));
    }

    const title = form.elements.title.value.trim();
    const description = form.elements.description.value.trim();
    const content = form.elements.content.value.trim();
    const price = Number(form.elements.price.value);

    const contentHtml = linkifyContent(content);

    const { data, error } = await sb.rpc("create_payment_link", {
      p_title: title,
      p_description: description || null,
      p_price: price,
      p_pastelink_id: null,
      p_content_html: contentHtml,
      p_content_text: content,
      p_thumbnail_url: null
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.url) throw new Error(t("payment.url_error"));
    if (row?.url) row.url = normalizePaymentUrl(row.url);
    return row;
  }


  function currentLanguage() {
    const raw = localStorage.getItem("showlink-language") ||
      localStorage.getItem("showlink-lang") ||
      document.documentElement.lang || "id";
    return /^en/i.test(raw) ? "en" : "id";
  }

  function t(key) {
    const lang = currentLanguage();
    return window.SHOWLINK_PAYMENT_I18N?.[lang]?.[key] ??
      window.SHOWLINK_PAYMENT_I18N?.id?.[key] ?? key;
  }

  function applyPaymentLanguage() {
    const lang = currentLanguage();
    const dict = window.SHOWLINK_PAYMENT_I18N?.[lang] || window.SHOWLINK_PAYMENT_I18N.id;
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (dict[key] != null) el.innerHTML = dict[key];
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.dataset.i18nHtml;
      if (dict[key] != null) el.innerHTML = dict[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (dict[key] != null) el.setAttribute("placeholder", String(dict[key]).replace(/\\n/g, "\n"));
    });
  }

  async function applyPaymentPlanGate() {
    const form = $("#create-link-form");
    if (!form) return;
    try {
      const sb = await window.ShowLinkSupabase.load();
      const { data: sessionData } = await sb.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return;
      const { data: profile } = await sb.from("profiles").select("plan").eq("id", uid).maybeSingle();
      const plan = String(profile?.plan || "free").toLowerCase();
      const allowed = plan === "vip" || plan === "premium";
      form.classList.toggle("payment-plan-locked", !allowed);
      form.querySelectorAll("input,textarea,select,button").forEach(el => { el.disabled = !allowed; });
      let gate = document.getElementById("payment-plan-gate");
      if (!allowed) {
        if (!gate) {
          gate = document.createElement("div");
          gate.id = "payment-plan-gate";
          gate.className = "payment-plan-gate";
          form.parentElement?.insertBefore(gate, form);
        }
        gate.innerHTML = `<div class="payment-plan-gate-icon"><i class="fa-solid fa-lock"></i></div><div><strong>${t("payment.plan_locked_title")}</strong><p>${t("payment.plan_locked")}</p></div>`;
        gate.hidden = false;
      } else if (gate) {
        gate.hidden = true;
      }
    } catch (e) {
      console.warn("[ShowLink] Payment plan check failed", e);
    }
  }



  function init() {
    const form = $("#create-link-form");
    if (!form) return;

    const price = $("#payment-price");
    price?.addEventListener("input", () => {
      const value = Number(price.value);
      showError("[data-price-warning]", !Number.isFinite(value) || value < MIN_PRICE || value > MAX_PRICE);
    });

    form.elements.title?.addEventListener("input", () => showError("[data-title-warning]", !form.elements.title.value.trim()));
    form.elements.content?.addEventListener("input", () => showError("[data-content-warning]", !form.elements.content.value.trim()));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validate(form)) return;

      const button = form.querySelector("button[type=submit]");
      const original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Membuat link...</span>';
      setResult(t("payment.loading"), "loading");

      try {
        const result = await createPaymentLink(form);
        const priceText = rupiah(Number(form.elements.price.value));
        setResult(`${t("payment.success")} · ${priceText}:`, "success", result.url);
        form.reset();
      } catch (error) {
        console.error(error);
        setResult(error?.message || t("payment.generic_error"), "error");
      } finally {
        button.disabled = false;
        button.innerHTML = original;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyPaymentLanguage();
    init();
    applyPaymentPlanGate();

    window.addEventListener("showlink:language-change", applyPaymentLanguage);
    window.addEventListener("languagechange", applyPaymentLanguage);
    window.addEventListener("storage", (event) => {
      if (event.key === "showlink-language" || event.key === "showlink-lang") {
        applyPaymentLanguage();
      }
    });
  });
})();
