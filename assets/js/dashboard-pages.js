(() => {
  "use strict";
  async function boot(){
    try{
      const sb=await window.ShowLinkSupabase.load();
      const {data,error}=await sb.auth.getSession();
      if(error) throw error;
      if(!data.session){ localStorage.removeItem("showlink_user"); location.replace("/login.html"); return; }
      const u=data.session.user;
      let profile=null;
      const r=await sb.from("profiles").select("username,display_name,plan").eq("id",u.id).maybeSingle();
      if(!r.error) profile=r.data;
      const name=profile?.display_name||profile?.username||u.user_metadata?.display_name||u.email?.split("@")[0]||"User";
      document.querySelectorAll("[data-user-name]").forEach(x=>x.textContent=name);
      document.querySelectorAll("[data-user-email]").forEach(x=>x.textContent=u.email||"—");
      document.querySelectorAll("[data-user-plan]").forEach(x=>x.textContent=profile?.plan||"Free");
      localStorage.setItem("showlink_user",JSON.stringify({id:u.id,email:u.email,user_metadata:u.user_metadata||{}}));
      window.dispatchEvent(new CustomEvent("showlink:auth-change",{detail:{user:u}}));
    }catch(e){ console.error(e); location.replace("/login.html"); }
  }
  document.addEventListener("DOMContentLoaded",boot);
})();
