(() => {
  "use strict";
  const root = document.querySelector('[data-shortlink-cpm-settings]');
  if (!root || !window.ShowLinkSupabase) return;

  const input = root.querySelector('[data-cpm-input]');
  const form = root.querySelector('[data-cpm-form]');
  const status = root.querySelector('[data-cpm-status]');
  const current = root.querySelector('[data-cpm-current]');
  const preview = root.querySelector('[data-cpm-preview]');
  const save = root.querySelector('[data-cpm-save]');

  const money = n => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 4
  }).format(Number(n) || 0);

  function setStatus(text, ok = true) {
    status.textContent = text;
    status.dataset.state = ok ? 'ok' : 'error';
  }

  function updatePreview() {
    const cpm = Math.max(0, Number(input.value) || 0);
    preview.textContent = `1.000 view = ${money(cpm)} · 1 view = ${money(cpm / 1000)}`;
  }

  async function load() {
    try {
      const sb = await window.ShowLinkSupabase.load();
      const { data, error } = await sb.rpc('get_shortlink_cpm_admin');
      if (error) throw error;
      if (!data?.ok) {
        root.hidden = true;
        return;
      }
      input.value = Number(data.cpm || 0);
      current.textContent = money(data.cpm);
      updatePreview();
    } catch (err) {
      console.error('[ShowLink CPM]', err);
      root.hidden = true;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const cpm = Number(input.value);
    if (!Number.isFinite(cpm) || cpm < 0 || cpm > 1000000) {
      setStatus('CPM harus 0 sampai 1.000.000.', false);
      return;
    }

    save.disabled = true;
    setStatus('Menyimpan…');
    try {
      const sb = await window.ShowLinkSupabase.load();
      const { data, error } = await sb.rpc('set_shortlink_cpm_admin', { p_cpm: cpm });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Gagal menyimpan CPM');
      current.textContent = money(data.cpm);
      input.value = Number(data.cpm);
      updatePreview();
      setStatus('CPM berhasil diperbarui.');
    } catch (err) {
      console.error('[ShowLink CPM]', err);
      setStatus(err?.message || 'Gagal menyimpan CPM.', false);
    } finally {
      save.disabled = false;
    }
  });

  input.addEventListener('input', updatePreview);
  load();
})();
