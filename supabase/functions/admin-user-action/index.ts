import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"content-type":"application/json"}});
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw new Error(`${n} not configured`);return v};

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 try{
  const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
  const url=env("SUPABASE_URL"), service=env("SUPABASE_SERVICE_ROLE_KEY"), anon=env("SUPABASE_ANON_KEY");
  const authClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user:caller}}=await authClient.auth.getUser(); if(!caller)return json({error:"AUTH_REQUIRED"},401);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile}=await admin.from("profiles").select("id,is_admin,role,is_banned").eq("id",caller.id).maybeSingle();
  const isAdmin=caller.email?.toLowerCase()==="saputrarmx190301@gmail.com" || (profile?.is_admin===true && profile?.is_banned===false) || (profile?.role==="admin" && profile?.is_banned===false);
  if(!isAdmin)return json({error:"ADMIN_REQUIRED"},403);
  const body=await req.json().catch(()=>({})); const action=String(body.action||"");
  const uid=String(body.user_id||"");
  if(!uid)return json({error:"USER_ID_REQUIRED"},400);
  if(action==="set_password"){
    const password=String(body.password||""); if(password.length<6)return json({error:"PASSWORD_TOO_SHORT"},400);
    const {error}=await admin.auth.admin.updateUserById(uid,{password}); if(error)throw error;
    await admin.from("admin_logs").insert({admin_id:caller.id,action:"change_user_password",target_type:"user",target_id:uid});
    return json({ok:true});
  }
  if(action==="ban_user"){
    const {error}=await admin.auth.admin.updateUserById(uid,{ban_duration:"876000h"}); if(error)throw error;
    await admin.from("profiles").update({is_banned:true,updated_at:new Date().toISOString()}).eq("id",uid);
    return json({ok:true});
  }
  if(action==="unban_user"){
    const {error}=await admin.auth.admin.updateUserById(uid,{ban_duration:"none"}); if(error)throw error;
    await admin.from("profiles").update({is_banned:false,updated_at:new Date().toISOString()}).eq("id",uid);
    return json({ok:true});
  }
  if(action==="delete_user"){
    if(uid===caller.id)return json({error:"CANNOT_DELETE_SELF"},400);
    const {error}=await admin.auth.admin.deleteUser(uid); if(error)throw error;
    return json({ok:true});
  }
  return json({error:"UNKNOWN_ACTION"},400);
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},500)}
});
