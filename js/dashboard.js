(() => {
"use strict";

const I18N={
 id:{dashboard:"Dashboard",welcome:"Selamat datang",dashboardIntro:"Pantau saldo, pendapatan, klik, dan performa semua layanan ShowLink dari satu tempat.",accountGreeting:"Salam sambutan",welcomeNote:"Semua ringkasan penghasilanmu ada di sini.",availableBalance:"Saldo tersedia saat ini",readyToWithdraw:"Siap digunakan/ditarik",shortlinkIncome:"Pendapatan Shortlink",shortlinkIncomeSub:"Pendapatan dari Shortlink",paymentIncome:"Pendapatan Payment Link",paymentIncomeSub:"Pendapatan bersih dari penjualan link",subIncome:"Pendapatan Member Sub4unlock",subIncomeSub:"Hanya dari user yang menyelesaikan task Sub4Sub",pendingSettlement:"Saldo Pending Settlement H1",todayIncome:"Pendapatan hari ini",monthIncome:"Pendapatan bulan ini",totalShortlinks:"Total Shortlink",totalPaymentLinks:"Total Payment Link",clicksToday:"Pendapatan klik hari ini",totalSubLinks:"Total Link Sub4unlock",viewDetails:"Lihat detail",incomeDistribution:"Distribusi pendapatan",totalIncome:"Total pendapatan",shortlinkStats:"Statistik Shortlink",performanceTrend:"Performa & tren",chartData:"Data mengikuti statistik dari database.",validViews:"View valid",estimatedIncome:"Estimasi pendapatan",paymentStats:"Statistik Payment Link",salesTrend:"Penjualan & tren",paymentClicks:"Klik/checkout",netIncome:"Pendapatan bersih",subStats:"Statistik Sub4unlock",subUnlockStats:"Klik & total link",validTasks:"Task selesai",monthlyClicks:"Klik bulan ini",activeLinks:"Link aktif",details:"Detail",subDetails:"Sub4unlock",lockedContent:"Konten terkunci",unlockedContent:"Konten terbuka",usersCompleted:"User selesai task",successfulSales:"Penjualan berhasil",incomeRule:"Aturan pendapatan",incomeRuleTitle:"Saldo tampil sebagai pendapatan bersih",incomeRuleText:"Payment Link menampilkan bagian bersih yang menjadi milikmu. Fee platform tidak ditampilkan di Dashboard."},
 en:{dashboard:"Dashboard",welcome:"Welcome",dashboardIntro:"Monitor your balance, earnings, clicks, and ShowLink performance in one place.",accountGreeting:"Account greeting",welcomeNote:"Your earnings overview is all here.",availableBalance:"Available balance",readyToWithdraw:"Ready to use/withdraw",shortlinkIncome:"Shortlink earnings",shortlinkIncomeSub:"Shortlink earnings",paymentIncome:"Payment Link earnings",paymentIncomeSub:"Net earnings from link sales",subIncome:"Sub4unlock member earnings",subIncomeSub:"Only from users completing Sub4Sub tasks",pendingSettlement:"Pending Settlement H1",todayIncome:"Today's earnings",monthIncome:"This month's earnings",totalShortlinks:"Total Shortlinks",totalPaymentLinks:"Total Payment Links",clicksToday:"Clicks today",totalSubLinks:"Total Sub4unlock Links",viewDetails:"View details",incomeDistribution:"Income distribution",totalIncome:"Total earnings",shortlinkStats:"Shortlink statistics",performanceTrend:"Performance & trend",chartData:"Data follows database statistics.",validViews:"Valid views",estimatedIncome:"Estimated earnings",paymentStats:"Payment Link statistics",salesTrend:"Sales & trend",paymentClicks:"Clicks/checkout",netIncome:"Net earnings",subStats:"Sub4unlock statistics",subUnlockStats:"Clicks & total links",validTasks:"Completed tasks",monthlyClicks:"Clicks this month",activeLinks:"Active links",details:"Details",subDetails:"Sub4unlock",lockedContent:"Locked content",unlockedContent:"Unlocked content",usersCompleted:"Users completing task",successfulSales:"Successful sales",incomeRule:"Earnings rule",incomeRuleTitle:"Balance is shown as net earnings",incomeRuleText:"Payment Link shows the net amount that belongs to you."}
};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const lang=()=>localStorage.getItem("showlink-language")==="en"?"en":"id";
const t=k=>I18N[lang()][k]||k;
const theme=()=>{const x=localStorage.getItem("showlink-theme");return x==="dark"||x==="light"?x:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")};
function translate(){document.documentElement.lang=lang();$$("[data-i18n]").forEach(e=>{const k=e.dataset.i18n;if(I18N[lang()][k]!==undefined)e.textContent=t(k)});}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0)}
function num(n){return new Intl.NumberFormat("id-ID").format(Number(n)||0)}
function setMetric(k,v){$$(`[data-metric="${k}"]`).forEach(e=>e.textContent=/balance|income|pending|today|month|earnings/.test(k)?money(v):num(v))}
function setTrend(k,v){$$(`[data-trend="${k}"]`).forEach(e=>{const n=Number(v)||0;e.classList.toggle("up",n>0);e.classList.toggle("down",n<0);e.innerHTML=`<i class="fa-solid fa-arrow-${n>=0?"trend-up":"trend-down"}"></i> ${Math.abs(n).toFixed(1)}%`})}
const rows=r=>r&&!r.error?(r.data||[]):[];
const day0=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
const sum=(a,k)=>a.reduce((n,x)=>n+Number(x?.[k]||0),0);

async function loadProfile(sb,u){
 try{const {data:p}=await sb.from("profiles").select("username,display_name,email,plan,avatar_url").eq("id",u.id).maybeSingle();const q=p||{};const name=q.username||q.display_name||u.user_metadata?.username||u.email?.split("@")[0]||"User";$$("[data-user-name]").forEach(e=>e.textContent=name);$$("[data-user-email]").forEach(e=>e.textContent=q.email||u.email||"—");$$("[data-account-status]").forEach(e=>e.textContent=(q.plan||"free").toUpperCase());const a=$("[data-avatar]");if(a&&q.avatar_url)a.innerHTML=`<img src="${String(q.avatar_url).replace(/"/g,"&quot;")}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`}catch(e){console.warn(e)}
}

function periodChange(cur,prev){return prev?((cur-prev)/prev)*100:(cur>0?100:0)}

function buildChart(series,id,key,cls){
 const el=$(id);if(!el)return;
 const vals=series.map(x=>Number(x[key]||0)),max=Math.max(...vals,1),W=800,H=210,p=22;
 const pts=vals.map((v,i)=>[p+i/(Math.max(vals.length-1,1))*(W-p*2),H-p-v/max*(H-p*2)]);
 el.classList.remove("line-chart");el.classList.add("real-chart");
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline class="${cls}" points="${pts.map(x=>x.join(",")).join(" ")}"></polyline>${pts.filter((_,i)=>i===0||i===pts.length-1||i%5===0).map(x=>`<circle class="${cls.replace("line","point")}" cx="${x[0]}" cy="${x[1]}" r="4"></circle>`).join("")}</svg>`;
}
function renderCharts(series){buildChart(series,"#shortlink-chart","short","chart-line-short");buildChart(series,"#payment-chart","pay","chart-line-pay");}

async function loadDashboardData(sb,u){
 const d={available_balance:0,short_pending:0,short_today:0,short_month:0,short_total:0,short_views:0,short_earnings:0,pay_pending:0,pay_today:0,pay_month:0,pay_total:0,pay_clicks:0,pay_earnings:0,pay_sales:0,sub_today:0,sub_month:0,sub_total:0,sub_clicks:0,sub_clicks_month:0,sub_links_active:0,sub_locked:0,sub_unlocked:0,sub_users:0};
 const now=new Date(),today=day0(now),month=new Date(now.getFullYear(),now.getMonth(),1),yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1),prevMonth=new Date(month);prevMonth.setMonth(prevMonth.getMonth()-1);
 try{
  const [w,sl,sc,pl,orders,tx,subl,subc]=await Promise.all([
   sb.from("wallets").select("available_balance,pending_balance,lifetime_earned").eq("user_id",u.id).maybeSingle(),
   sb.from("showlink_shortlinks").select("id,status,views,unique_views,created_at").eq("owner_id",u.id),
   sb.from("showlink_shortlink_clicks").select("shortlink_id,is_valid,task_completed,earning_amount,created_at,completed_at,visitor_hash").eq("owner_id",u.id).eq("is_valid",true).eq("task_completed",true),
   sb.from("payment_links").select("id,status,views,unique_views,sales_count,created_at").eq("owner_id",u.id),
   sb.from("orders").select("id,payment_link_id,amount,status,created_at,paid_at,completed_at").eq("seller_id",u.id),
   sb.from("wallet_transactions").select("amount,order_id,type,direction,description,created_at").eq("user_id",u.id).eq("type","earning").eq("direction","credit"),
   sb.from("showlink_sub4unlock_links").select("id,status,views,unique_views,created_at").eq("owner_id",u.id),
   sb.from("showlink_sub4unlock_completions").select("id,link_id,visitor_hash,status,earning_amount,completed_at,created_at").eq("owner_id",u.id)
  ]);
  const a=rows(sl),short=rows(sc),links=rows(pl),or=rows(orders),earn=rows(tx).filter(x=>x.order_id),subs=rows(subc),sublinks=rows(subl);
  d.available_balance=Number(w.data?.available_balance||0);
  d.short_total=a.length;d.short_views=sum(a,"views");d.short_earnings=sum(short,"earning_amount");
  d.short_today=short.filter(x=>new Date(x.completed_at||x.created_at)>=today).reduce((n,x)=>n+Number(x.earning_amount||0),0);
  d.short_month=short.filter(x=>new Date(x.completed_at||x.created_at)>=month).reduce((n,x)=>n+Number(x.earning_amount||0),0);
  d.short_pending=d.short_earnings;
  d.pay_total=links.length;
  d.pay_clicks=or.length;
  d.pay_sales=or.filter(x=>["paid","processing","completed"].includes(String(x.status||"").toLowerCase())).length;
  d.pay_earnings=sum(earn,"amount");
  d.pay_today=earn.filter(x=>new Date(x.created_at)>=today).reduce((n,x)=>n+Number(x.amount||0),0);
  d.pay_month=earn.filter(x=>new Date(x.created_at)>=month).reduce((n,x)=>n+Number(x.amount||0),0);
  d.pay_pending=0;
  const done=subs.filter(x=>String(x.status||"").toLowerCase()==="completed");
  d.sub_total=sublinks.length;d.sub_links_active=sublinks.filter(x=>x.status==="active").length;d.sub_clicks=done.length;d.sub_clicks_month=done.filter(x=>new Date(x.completed_at||x.created_at)>=month).length;
  d.sub_today=done.filter(x=>new Date(x.completed_at||x.created_at)>=today).reduce((n,x)=>n+Number(x.earning_amount||0),0);
  d.sub_month=done.filter(x=>new Date(x.completed_at||x.created_at)>=month).reduce((n,x)=>n+Number(x.earning_amount||0),0);
  d.sub_unlocked=done.length;d.sub_locked=Math.max(0,subs.length-done.length);d.sub_users=new Set(done.map(x=>x.visitor_hash||x.id)).size;
  const ps=short.filter(x=>{const z=new Date(x.completed_at||x.created_at);return z>=yesterday&&z<today}).reduce((n,x)=>n+Number(x.earning_amount||0),0);
  const pms=short.filter(x=>{const z=new Date(x.completed_at||x.created_at);return z>=prevMonth&&z<month}).reduce((n,x)=>n+Number(x.earning_amount||0),0);
  const pp=earn.filter(x=>{const z=new Date(x.created_at);return z>=yesterday&&z<today}).reduce((n,x)=>n+Number(x.amount||0),0);
  const ppm=earn.filter(x=>{const z=new Date(x.created_at);return z>=prevMonth&&z<month}).reduce((n,x)=>n+Number(x.amount||0),0);
  d._tr={short_today:periodChange(d.short_today,ps),short_month:periodChange(d.short_month,pms),pay_today:periodChange(d.pay_today,pp),pay_month:periodChange(d.pay_month,ppm),short_total:0,pay_total:0,sub_today:0,sub_month:0,sub_total:0};
  const series=[];for(let i=29;i>=0;i--){const st=new Date(today);st.setDate(st.getDate()-i);const en=new Date(st);en.setDate(en.getDate()+1);series.push({short:short.filter(x=>{const z=new Date(x.completed_at||x.created_at);return z>=st&&z<en}).reduce((n,x)=>n+Number(x.earning_amount||0),0),pay:earn.filter(x=>{const z=new Date(x.created_at);return z>=st&&z<en}).reduce((n,x)=>n+Number(x.amount||0),0),sub:done.filter(x=>{const z=new Date(x.completed_at||x.created_at);return z>=st&&z<en}).reduce((n,x)=>n+Number(x.earning_amount||0),0)});}
  d._series=series;
 }catch(e){console.warn("[ShowLink] dashboard DB:",e);d._tr={};d._series=[]}
 d.income_total=d.short_earnings+d.pay_earnings;
 const total=d.income_total,sp=total?Math.round(d.short_earnings/total*100):0;
 d.income_short_pct=sp;d.income_pay_pct=total?100-sp:0;
 Object.entries(d).forEach(([k,v])=>{if(!k.startsWith("_"))setMetric(k,v)});Object.entries(d._tr).forEach(([k,v])=>setTrend(k,v));
 const donut=$("#income-donut");if(donut)donut.style.background=`conic-gradient(var(--green) 0 ${sp}%,var(--yellow) ${sp}% 100%)`;
 const sd=$("#sub-donut");if(sd)sd.style.background="conic-gradient(var(--orange) 0 65%,var(--blue) 65% 100%)";
 renderCharts(d._series);
}

async function getDashboardSession(sb){
  let lastError=null;
  for(let attempt=0;attempt<4;attempt++){
    try{
      const {data,error}=await sb.auth.getSession();
      if(data?.session) return data.session;
      if(error) lastError=error;
    }catch(e){lastError=e;}
    await new Promise(r=>setTimeout(r,250*(attempt+1)));
  }
  if(lastError) console.warn("[ShowLink Dashboard] Session check retry exhausted:",lastError);
  return null;
}

async function guard(){
  try{
    const sb=await window.ShowLinkSupabase.load();
    let session=await getDashboardSession(sb);
    if(!session){
      session=await new Promise(resolve=>{
        let done=false;
        const finish=s=>{if(done)return;done=true;resolve(s||null);};
        try{sb.auth.onAuthStateChange((_event,s)=>{if(s) finish(s);});}catch(e){console.warn("[ShowLink Dashboard] Auth listener:",e);}
        setTimeout(()=>finish(null),3000);
      });
    }
    if(!session){
      location.replace("/login.html?redirect="+encodeURIComponent(location.pathname+location.search));
      return;
    }
    await loadProfile(sb,session.user);
    await loadDashboardData(sb,session.user);
  }catch(e){
    console.error("[ShowLink Dashboard] Initialization failed:",e);
    // Database/network errors must not sign the user out or force a login redirect.
  }
}
function applyTheme(v){v=v==="dark"?"dark":"light";document.documentElement.dataset.theme=v;document.documentElement.style.colorScheme=v;localStorage.setItem("showlink-theme",v);window.showlinkRefreshComponents?.()}
document.addEventListener("DOMContentLoaded",()=>{translate();window.addEventListener("showlink:theme",e=>applyTheme(e.detail?.theme||theme()));window.addEventListener("showlink:language",e=>{localStorage.setItem("showlink-language",e.detail?.language||lang());translate()});guard()});
})();