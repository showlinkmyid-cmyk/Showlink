(() => {
  "use strict";

  const cfg = window.SHOWLINK_SUPABASE || {};
  let client = null;

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url || "") &&
           !!cfg.anonKey &&
           !String(cfg.anonKey).includes("YOUR_SUPABASE");
  }

  async function load() {
    if (client) return client;
    if (!configured()) throw new Error("Supabase belum dikonfigurasi. Isi assets/js/supabase-config.js.");
    if (!window.supabase) throw new Error("Supabase client belum dimuat.");
    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  window.ShowLinkSupabase = { load, configured };
})();
