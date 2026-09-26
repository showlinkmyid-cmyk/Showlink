(() => {
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const t=k=>window.ShowLinkLanguage?.t?.(k)||k;
function setAll(sel,val){document.querySelectorAll(sel).forEach(e=>e.textContent=val);}
function showError(msg){const box=$("[data-dashboard-error]");if(box){box.textContent=msg;box.hidden=false;}}
async function boot(){
  try{
    const sb=await window.ShowLinkSupabase.load();
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    const session=data.session;
    if(!session){localStorage.removeItem("showlink_user");location.replace("/login.html");return;}
    const user=session.user;
    let profile=null;
    try{
      const r=await sb.from("profiles").select("display_name,username,plan,created_at").eq("id",user.id).maybeSingle();
      if(!r.error) profile=r.data;
    }catch(_){}
    const name=profile?.display_name||profile?.username||user.user_metadata?.display_name||user.email?.split("@")[0]||"User";
    setAll("[data-user-name]",name);
    setAll("[data-user-email]",user.email||"—");
    setAll("[data-user-plan]",profile?.plan||"Free");
    setAll("[data-user-created]",profile?.created_at?new Date(profile.created_at).toLocaleDateString():new Date(user.created_at).toLocaleDateString());
    localStorage.setItem("showlink_user",JSON.stringify({id:user.id,email:user.email,user_metadata:user.user_metadata||{}}));
    window.dispatchEvent(new CustomEvent("showlink:auth-change",{detail:{user}}));
    const lang=window.ShowLinkLanguage?.getLanguage?.()||"id";
    setAll("[data-current-language]",lang==="en"?"EN":"ID");
    setAll("[data-current-theme]",(window.ShowLinkTheme?.getTheme?.()||"light")==="dark"?t("dark"):t("light"));
    window.addEventListener("showlink:language-change",()=>setAll("[data-current-language]",window.ShowLinkLanguage.getLanguage()==="en"?"EN":"ID"));
  }catch(e){showError(e.message||"Unable to load account.");}
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-logout]");if(!b)return;
  try{
    const sb=await window.ShowLinkSupabase.load();
    await sb.auth.signOut();
  }catch(_){}
  localStorage.removeItem("showlink_user");
  window.dispatchEvent(new CustomEvent("showlink:auth-change",{detail:{user:null}}));
  location.replace("/login.html");
});
document.addEventListener("DOMContentLoaded",boot);
})();
