/* ShowLink shared footer component. */
(() => {
  "use strict";
  const CONFIG={home:"/",terms:"/terms.html",privacy:"/privacy.html",contact:"/contact.html"};
  const icon=(cls,name)=>`<i class="fa-solid ${name} ${cls||""}" aria-hidden="true"></i>`;
  const t=(key)=>window.ShowLinkLanguage?.t?.(key)||key;
  function render(){
    const host=document.querySelector("[data-showlink-footer]"); if(!host)return;
    const year=new Date().getFullYear();
    host.innerHTML=`<footer class="sl-footer"><div class="sl-container sl-footer-main">
      <a class="sl-footer-brand" href="${CONFIG.home}" aria-label="ShowLink"><span class="sl-brand-mark">${icon("","fa-link")}</span><span class="sl-footer-brand-text"><strong>ShowLink</strong><small data-i18n="footerTagline">${t("footerTagline")}</small></span></a>
      <nav class="sl-footer-links" aria-label="${t("footerNavigation")}"><a href="${CONFIG.terms}" data-i18n="terms">${t("terms")}</a><a href="${CONFIG.privacy}" data-i18n="privacy">${t("privacy")}</a><a href="${CONFIG.contact}" data-i18n="contact">${t("contact")}</a></nav>
    </div><div class="sl-container sl-footer-bottom"><span data-i18n="copyright">${t("copyright").replace("{year}",year)}</span></div></footer>`;
  }
  window.ShowLinkFooter={render,refresh:render};
  document.addEventListener("DOMContentLoaded",render);
})();
