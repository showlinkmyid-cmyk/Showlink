(() => {
"use strict";

/*
 * Dashboard data contract.
 * The current uploaded HTML/CSS did not contain the actual Supabase table/column
 * schema for Shortlink, Payment Link, or Sub4unlock. Therefore this file keeps
 * the database adapter isolated instead of inventing a schema.
 * Set these table names/field mappings when the canonical SQL schema is supplied.
 */
const I18N = {
 id:{
  dashboard:"Dashboard",welcome:"Selamat datang",dashboardIntro:"Pantau saldo, pendapatan, klik, dan performa semua layanan ShowLink dari satu tempat.",
  accountGreeting:"Salam sambutan",welcomeNote:"Semua ringkasan penghasilanmu ada di sini.",availableBalance:"Saldo tersedia saat ini",readyToWithdraw:"Siap digunakan/ditarik",
  shortlinkIncome:"Pendapatan Shortlink",shortlinkIncomeSub:"Penghasilan dari iklan & CPM",paymentIncome:"Pendapatan Payment Link",paymentIncomeSub:"Pendapatan bersih dari penjualan link",
  subIncome:"Pendapatan Member Sub4unlock",subIncomeSub:"Hanya dari user yang menyelesaikan task Sub4Sub",pendingSettlement:"Saldo Pending Settlement H1",todayIncome:"Pendapatan hari ini",monthIncome:"Pendapatan bulan ini",
  totalShortlinks:"Total Shortlink",totalPaymentLinks:"Total Payment Link",clicksToday:"Pendapatan klik hari ini",totalSubLinks:"Total Link Sub4unlock",
  viewDetails:"Lihat detail",cpmTrend:"Naik Turun CPM Shortlink",weeklyCpm:"CPM mingguan",weekendHigher:"Weekend lebih tinggi",
  cpmNote:"CPM acuan: Senin–Jumat Rp100–150, Sabtu–Minggu Rp150–250. Pendapatan aktual mengikuti CPM yang berlaku dan klik valid setelah task selesai.",
  incomeDistribution:"Distribusi pendapatan",totalIncome:"Total pendapatan",shortlinkStats:"Statistik Shortlink",performanceTrend:"Performa & tren",
  chartData:"Data akan mengikuti statistik Shortlink dari database.",validViews:"View valid",estimatedIncome:"Estimasi pendapatan",paymentStats:"Statistik Payment Link",salesTrend:"Penjualan & tren",paymentClicks:"Klik/checkout",netIncome:"Pendapatan bersih",
  subStats:"Statistik Sub4unlock",subUnlockStats:"Klik & total link",validTasks:"Task selesai",monthlyClicks:"Klik bulan ini",activeLinks:"Link aktif",details:"Detail",subDetails:"Sub4unlock",
  lockedContent:"Konten terkunci",unlockedContent:"Konten terbuka",usersCompleted:"User selesai task",successfulSales:"Penjualan berhasil",incomeRule:"Aturan pendapatan",incomeRuleTitle:"Saldo tampil sebagai pendapatan bersih",incomeRuleText:"Payment Link menampilkan bagian bersih yang menjadi milikmu. Fee platform tidak ditampilkan di Dashboard."
 },
 en:{
  dashboard:"Dashboard",welcome:"Welcome",dashboardIntro:"Monitor your balance, earnings, clicks, and ShowLink performance in one place.",
  accountGreeting:"Account greeting",welcomeNote:"Your earnings overview is all here.",availableBalance:"Available balance",readyToWithdraw:"Ready to use/withdraw",
  shortlinkIncome:"Shortlink earnings",shortlinkIncomeSub:"Advertising & CPM earnings",paymentIncome:"Payment Link earnings",paymentIncomeSub:"Net earnings from link sales",
  subIncome:"Sub4unlock member earnings",subIncomeSub:"Only from users completing Sub4Sub tasks",pendingSettlement:"Pending Settlement H1",todayIncome:"Today's earnings",monthIncome:"This month's earnings",
  totalShortlinks:"Total Shortlinks",totalPaymentLinks:"Total Payment Links",clicksToday:"Clicks today",totalSubLinks:"Total Sub4unlock Links",
  viewDetails:"View details",cpmTrend:"Shortlink CPM trend",weeklyCpm:"Weekly CPM",weekendHigher:"Higher on weekends",
  cpmNote:"Reference CPM: Monday–Friday Rp100–150, Saturday–Sunday Rp150–250. Actual earnings follow the active CPM and valid clicks after the task is completed.",
  incomeDistribution:"Income distribution",totalIncome:"Total earnings",shortlinkStats:"Shortlink statistics",performanceTrend:"Performance & trend",
  chartData:"Data will follow Shortlink statistics from the database.",validViews:"Valid views",estimatedIncome:"Estimated earnings",paymentStats:"Payment Link statistics",salesTrend:"Sales & trend",paymentClicks:"Clicks/checkout",netIncome:"Net earnings",
  subStats:"Sub4unlock statistics",subUnlockStats:"Clicks & total links",validTasks:"Completed tasks",monthlyClicks:"Clicks this month",activeLinks:"Active links",details:"Details",subDetails:"Sub4unlock",
  lockedContent:"Locked content",unlockedContent:"Unlocked content",usersCompleted:"Users completing task",successfulSales:"Successful sales",incomeRule:"Earnings rule",incomeRuleTitle:"Balance is shown as net earnings",incomeRuleText:"Payment Link shows the net amount that belongs to you. Platform fees are not shown on the Dashboard."
 }
};

const lang=()=>localStorage.getItem("showlink-language")==="en"?"en":"id";
const theme=()=>{const t=localStorage.getItem("showlink-theme");return t==="dark"||t==="light"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")};
const t=k=>I18N[lang()][k]||k;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

function translate(){
 document.documentElement.lang=lang();
 $$("[data-i18n]").forEach(el=>{const k=el.dataset.i18n;if(I18N[lang()][k]!==undefined)el.textContent=t(k)});
}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0)}
function num(n){return new Intl.NumberFormat("id-ID").format(Number(n)||0)}
function setMetric(k,v){$$(`[data-metric="${k}"]`).forEach(el=>el.textContent=typeof v==="number"&&/balance|income|pending|today|month|earnings/.test(k)?money(v):num(v))}
function setTrend(k,v){const nodes=$$(`[data-trend="${k}"]`);nodes.forEach(el=>{const n=Number(v)||0;el.classList.toggle("up",n>0);el.classList.toggle("down",n<0);el.innerHTML=`<i class="fa-solid fa-arrow-${n>=0?"trend-up":"trend-down"}"></i> ${Math.abs(n).toFixed(1)}%`})}

async function loadProfile(sb,user){
 try{
  const {data}=await sb.from("profiles").select("username,display_name,email,plan,avatar_url").eq("id",user.id).maybeSingle();
  const p=data||{};
  const name=p.username||p.display_name||user.user_metadata?.username||user.email?.split("@")[0]||"User";
  $$("[data-user-name]").forEach(x=>x.textContent=name);
  $$("[data-user-email]").forEach(x=>x.textContent=p.email||user.email||"—");
  $$("[data-account-status]").forEach(x=>x.textContent=(p.plan||"free").toUpperCase());
  const av=$("[data-avatar]"); if(av && p.avatar_url) av.innerHTML=`<img src="${p.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
 }catch(e){console.warn("Profile load:",e)}
}

/*
 * Adapter point for the canonical database.
 * No guessed table is queried here. Once the project's canonical SQL is supplied,
 * this function can map exact rows/RPCs into the metrics below.
 */
async function loadDashboardData(sb,user){
 const data={
  available_balance:0,short_pending:0,short_today:0,short_month:0,short_total:0,short_views:0,short_earnings:0,
  pay_pending:0,pay_today:0,pay_month:0,pay_total:0,pay_clicks:0,pay_earnings:0,pay_sales:0,
  sub_today:0,sub_month:0,sub_total:0,sub_clicks:0,sub_clicks_month:0,sub_links_active:0,sub_locked:0,sub_unlocked:0,sub_users:0,
  income_total:0,income_short_pct:0,income_pay_pct:0
 };

 try{
   // Wallet is read only for the authenticated owner.
   const wallet=await sb.from('wallets')
     .select('available_balance,pending_balance')
     .eq('user_id',user.id)
     .maybeSingle();
   if(!wallet.error && wallet.data){
     data.available_balance=Number(wallet.data.available_balance||0);
     data.short_pending=Number(wallet.data.pending_balance||0);
   }

   // This view is populated by Final after all required tasks are completed.
   // RLS/security_invoker limits rows to the authenticated owner.
   const stats=await sb.from('showlink_shortlink_final_dashboard')
     .select('shortlink_id,views,ad_clicks,original_clicks,telegram_clicks,cpm,estimated_revenue,created_at,updated_at')
     .eq('owner_id',user.id);

   if(stats.error) throw stats.error;

   const rows=stats.data||[];
   data.short_total=rows.length;
   data.short_views=rows.reduce((sum,r)=>sum+Number(r.views||0),0);
   data.short_earnings=rows.reduce((sum,r)=>sum+Number(r.estimated_revenue||0),0);

   // The current aggregate schema stores cumulative Final statistics.
   // Therefore total earnings/views are authoritative here; daily/monthly
   // cards remain zero until an event ledger is added.
   data.short_today=0;
   data.short_month=data.short_earnings;
   data.income_total=data.short_earnings+data.pay_earnings;
 }catch(err){
   console.warn('[ShowLink] Shortlink dashboard data:',err);
 }

 Object.entries(data).forEach(([k,v])=>setMetric(k,v));
 ["short_today","short_month","short_total"].forEach(k=>setTrend(k,0));
 updateDonuts(data.short_earnings,data.pay_earnings,data.sub_today);
}
function updateDonuts(short,pay,sub){
 const total=Number(short)+Number(pay);
 const sp=total?Math.round(short/total*100):0, pp=total?100-sp:0;
 setMetric("income_total",total);setMetric("income_short_pct",sp);setMetric("income_pay_pct",pp);
 const d=$("#income-donut"); if(d)d.style.background=`conic-gradient(var(--green) 0 ${sp}%,var(--yellow) ${sp}% 100%)`;
 const sd=$("#sub-donut"); if(sd)sd.style.background=`conic-gradient(var(--orange) 0 65%,var(--blue) 65% 100%)`;
}

async function guard(){
 try{
  const sb=await window.ShowLinkSupabase.load();
  const {data,error}=await sb.auth.getSession();
  if(error||!data.session){location.replace("/login.html");return}
  await loadProfile(sb,data.session.user);
  await loadDashboardData(sb,data.session.user);
 }catch(e){console.error(e);location.replace("/login.html")}
}

function applyTheme(v){v=v==="dark"?"dark":"light";document.documentElement.dataset.theme=v;document.documentElement.style.colorScheme=v;localStorage.setItem("showlink-theme",v);if(window.showlinkRefreshComponents)window.showlinkRefreshComponents()}
function setupThemeSync(){
 window.addEventListener("showlink:theme",e=>applyTheme(e.detail?.theme||theme()));
 window.addEventListener("showlink:language",e=>{localStorage.setItem("showlink-language",e.detail?.language||lang());translate()});
}

document.addEventListener("DOMContentLoaded",()=>{translate();setupThemeSync();guard()});
})();
