/* ShowLink shared footer. */
(() => {
  "use strict";
  const C={home:"/",about:"/about.html",platform:"/#platform",how:"/#how"};
  const icon=(cls,name)=>`<i class="fa-solid ${name}${cls?` ${cls}`:""}" aria-hidden="true"></i>`;
  const t=k=>window.ShowLinkLanguage?.t?.(k)||k;
  function render(){const host=document.querySelector("[data-showlink-footer]");if(!host)return;const y=new Date().getFullYear();host.innerHTML=`<footer class="sl-footer"><div class="sl-footer-shell"><div class="sl-footer-main"><a class="sl-footer-brand" href="${C.home}" aria-label="ShowLink"><span class="sl-brand-mark"><img src="/assets/showlink-logo.svg" alt="ShowLink"></span><span class="sl-footer-brand-text"><strong>ShowLink</strong><small data-i18n="footerTagline">${t("footerTagline")}</small></span></a><nav class="sl-footer-links" aria-label="${t("footerNavigation")}"><a href="${C.platform}" data-i18n="platformInfo">${t("platformInfo")}</a><a href="${C.how}" data-i18n="howItWorks">${t("howItWorks")}</a><a href="${C.about}" data-i18n="about">${t("about")}</a></nav></div><div class="sl-footer-bottom"><span data-i18n="copyright">${t("copyright").replace("{year}",y)}</span><span>ShowLink</span></div></div></footer>`}
  window.ShowLinkFooter={render,refresh:render};
})();
