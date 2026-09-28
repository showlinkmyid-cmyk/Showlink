(() => {
  "use strict";
  const MIN_PRICE = 2000, MAX_PRICE = 200000;
  const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
  const $ = (s,r=document) => r.querySelector(s);

  function escapeHtml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function normalizeUrl(v){v=String(v||"").trim();return /^www\./i.test(v)?`https://${v}`:v;}
  function linkifyText(text){
    return escapeHtml(text).replace(URL_RE,(match)=>{
      const trailing=match.match(/[.,!?;:)\]}]+$/)?.[0]||"";
      const clean=trailing?match.slice(0,-trailing.length):match;
      return `<a href="${escapeHtml(normalizeUrl(clean))}" target="_blank" rel="noopener noreferrer">${clean}</a>${trailing}`;
    }).replace(/\r?\n/g,"<br>");
  }
  function linkifyHtml(html){
    const tpl=document.createElement("template"); tpl.innerHTML=html;
    const walker=document.createTreeWalker(tpl.content,NodeFilter.SHOW_TEXT,{
      acceptNode(n){
        const p=n.parentElement;
        if(!p || /^(A|SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE)$/i.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        return URL_RE.test(n.nodeValue||"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }
    });
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{
      const frag=document.createDocumentFragment(), text=n.nodeValue||""; let last=0;
      text.replace(URL_RE,(match,_m,offset)=>{
        if(offset>last) frag.append(document.createTextNode(text.slice(last,offset)));
        const trailing=match.match(/[.,!?;:)\]}]+$/)?.[0]||"", clean=trailing?match.slice(0,-trailing.length):match;
        const a=document.createElement("a"); a.href=normalizeUrl(clean); a.target="_blank"; a.rel="noopener noreferrer"; a.textContent=clean; frag.append(a);
        if(trailing) frag.append(document.createTextNode(trailing)); last=offset+match.length; return match;
      });
      if(last<text.length) frag.append(document.createTextNode(text.slice(last)));
      n.replaceWith(frag);
    });
    return tpl.innerHTML;
  }
  function setWarning(el,show){if(el) el.hidden=!show;}
  function validate(form){
    const price=Number($("#payment-price",form)?.value||0), thumb=form.elements.thumbnail_url?.value.trim()||"";
    const badPrice=!Number.isFinite(price)||price<MIN_PRICE||price>MAX_PRICE;
    const badThumb=thumb!==""&&!/^https:\/\//i.test(thumb);
    setWarning($("[data-price-warning]",form),badPrice); setWarning($("[data-thumbnail-warning]",form),badThumb);
    return !badPrice&&!badThumb;
  }
  function prepareContent(form){
    const h=$("#content-html",form), t=$("#content-text",form); if(!h||!t) return;
    if(h.value.trim()) h.value=linkifyHtml(h.value.trim());
    else if(t.value.trim()) h.value=linkifyText(t.value.trim());
  }
  function init(){
    const form=$("#create-link-form"); if(!form)return;
    const price=$("#payment-price",form), thumb=form.elements.thumbnail_url;
    price?.addEventListener("input",()=>{const v=Number(price.value);setWarning($("[data-price-warning]",form),!Number.isFinite(v)||v<MIN_PRICE||v>MAX_PRICE);});
    thumb?.addEventListener("input",()=>{const v=thumb.value.trim();setWarning($("[data-thumbnail-warning]",form),v!==""&&!/^https:\/\//i.test(v));});
    form.addEventListener("submit",e=>{if(!validate(form)){e.preventDefault();e.stopImmediatePropagation();price?.focus();return;}prepareContent(form);},true);
  }
  document.addEventListener("DOMContentLoaded",init);
})();