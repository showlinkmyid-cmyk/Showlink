(() => {
  "use strict";

  const MIN_PRICE = 2000;
  const MAX_PRICE = 200000;
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

  async function createPaymentLink(form) {
    const sb = await window.ShowLinkSupabase.load();
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !sessionData?.session) {
      throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
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
    if (!row?.url) throw new Error("Payment Link berhasil dibuat tetapi URL tidak diterima.");
    return row;
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
      setResult("Sedang membuat Payment Link...", "loading");

      try {
        const result = await createPaymentLink(form);
        const priceText = rupiah(Number(form.elements.price.value));
        setResult(`Payment Link berhasil dibuat · ${priceText}:`, "success", result.url);
        form.reset();
      } catch (error) {
        console.error(error);
        setResult(error?.message || "Gagal membuat Payment Link. Silakan coba lagi.", "error");
      } finally {
        button.disabled = false;
        button.innerHTML = original;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
