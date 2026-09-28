(() => {
  'use strict';

  const qs = new URLSearchParams(location.search);
  const enabled = qs.get('debug') === '1' || localStorage.getItem('showlink_debug') === '1';
  if (!enabled) return;

  const started = performance.now();
  const logs = [];
  const maxLogs = 250;

  function safe(v) {
    try {
      if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack || ''}`;
      if (typeof v === 'object') return JSON.stringify(v, null, 2);
      return String(v);
    } catch (_) { return String(v); }
  }

  function push(type, message, extra) {
    const entry = {
      t: `${(performance.now() - started).toFixed(0)}ms`,
      type,
      message: safe(message),
      extra: extra == null ? '' : safe(extra)
    };
    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();
    window.dispatchEvent(new CustomEvent('showlink-debug-log', { detail: entry }));
    render();
  }

  window.ShowLinkDebug = {
    enabled: true,
    logs,
    log: (message, extra) => push('INFO', message, extra),
    warn: (message, extra) => push('WARN', message, extra),
    error: (message, extra) => push('ERROR', message, extra),
    clear: () => { logs.length = 0; render(); },
    export: () => JSON.stringify({
      generated_at: new Date().toISOString(),
      url: location.href,
      user_agent: navigator.userAgent,
      logs
    }, null, 2)
  };

  // Capture JS/runtime errors.
  window.addEventListener('error', e => {
    push('ERROR', e.message || 'window.error', {
      file: e.filename,
      line: e.lineno,
      column: e.colno
    });
  });

  window.addEventListener('unhandledrejection', e => {
    push('ERROR', 'Unhandled Promise Rejection', e.reason);
  });

  // Capture fetch status/timing without storing response bodies or secrets.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = (args[1]?.method || input?.method || 'GET').toUpperCase();
    const interesting = /supabase\.co|\/functions\/v1\/|\/rest\/v1\//i.test(url);
    const startedAt = performance.now();

    if (interesting) push('FETCH', `${method} ${url}`);

    try {
      const response = await originalFetch(...args);
      if (interesting) {
        push(
          response.ok ? 'FETCH_OK' : 'FETCH_ERROR',
          `${method} ${url} → HTTP ${response.status}`,
          { elapsed_ms: Math.round(performance.now() - startedAt) }
        );
      }
      return response;
    } catch (err) {
      if (interesting) push('FETCH_ERROR', `${method} ${url} → NETWORK ERROR`, err);
      throw err;
    }
  };

  function render() {
    let box = document.getElementById('showlink-debug-panel');
    if (!box) {
      box = document.createElement('div');
      box.id = 'showlink-debug-panel';
      box.innerHTML = `
        <div class="sld-head">
          <strong>ShowLink Debug Mode</strong>
          <button data-sld="min">−</button>
          <button data-sld="copy">Copy</button>
          <button data-sld="clear">Clear</button>
        </div>
        <div class="sld-meta"></div>
        <pre class="sld-log"></pre>
      `;
      document.body.appendChild(box);

      box.querySelector('[data-sld="min"]').onclick = () => {
        box.classList.toggle('sld-min');
      };
      box.querySelector('[data-sld="clear"]').onclick = () => window.ShowLinkDebug.clear();
      box.querySelector('[data-sld="copy"]').onclick = async () => {
        try {
          await navigator.clipboard.writeText(window.ShowLinkDebug.export());
          push('INFO', 'Debug log copied to clipboard');
        } catch (e) {
          push('ERROR', 'Clipboard copy failed', e);
        }
      };
    }

    const meta = box.querySelector('.sld-meta');
    meta.textContent =
      `URL: ${location.href} | PATH: ${location.pathname} | QUERY: ${location.search || '(none)'}`;

    box.querySelector('.sld-log').textContent = logs.map(x => {
      const extra = x.extra ? `\n  ${x.extra}` : '';
      return `[${x.t}] ${x.type}: ${x.message}${extra}`;
    }).join('\n');
  }

  const css = document.createElement('style');
  css.textContent = `
    #showlink-debug-panel{
      position:fixed;z-index:2147483647;left:10px;right:10px;bottom:10px;
      max-height:48vh;background:#111827;color:#e5e7eb;border:1px solid #374151;
      border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.45);
      font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
      overflow:hidden;text-align:left;
    }
    #showlink-debug-panel .sld-head{
      display:flex;gap:6px;align-items:center;padding:8px 10px;
      background:#1f2937;position:sticky;top:0;
    }
    #showlink-debug-panel .sld-head strong{margin-right:auto;color:#fff}
    #showlink-debug-panel button{
      border:1px solid #4b5563;background:#111827;color:#e5e7eb;
      border-radius:6px;padding:4px 7px;font:inherit;
    }
    #showlink-debug-panel .sld-meta{
      padding:7px 10px;border-bottom:1px solid #374151;
      word-break:break-all;color:#93c5fd;
    }
    #showlink-debug-panel .sld-log{
      margin:0;padding:8px 10px;max-height:35vh;overflow:auto;
      white-space:pre-wrap;word-break:break-word;
    }
    #showlink-debug-panel.sld-min .sld-meta,
    #showlink-debug-panel.sld-min .sld-log{display:none}
  `;
  document.documentElement.appendChild(css);
  render();

  push('INFO', 'Debug mode enabled');
  push('INFO', 'Document loaded', {
    readyState: document.readyState,
    title: document.title
  });
  push('INFO', 'Route information', {
    href: location.href,
    pathname: location.pathname,
    search: location.search
  });
})();