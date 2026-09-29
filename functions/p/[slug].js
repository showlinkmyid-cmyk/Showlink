export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!env?.ASSETS?.fetch) {
    return new Response("ShowLink Pages Assets binding is unavailable.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  // Cloudflare's dynamic route parameter is the authoritative slug.
  const slug = String(params?.slug || "").trim();
  if (!slug) {
    return new Response("Payment Link slug is missing.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const assetUrl = new URL("/payment-link-public.html", request.url);
  const assetResponse = await env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: "GET",
      headers: { "Accept": "text/html" }
    })
  );

  if (!assetResponse.ok) {
    return new Response("Payment Link public page is unavailable.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  let html = await assetResponse.text();

  // Inject the route slug before any page JavaScript executes.
  // The client still has URL/query fallbacks, but this makes /p/:slug
  // deterministic even when the static asset is internally rewritten.
  const injection = `<script>window.__SHOWLINK_PAYMENT_SLUG=${JSON.stringify(slug)};</script>`;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, match => `${match}${injection}`);
  } else {
    html = `${injection}${html}`;
  }

  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("x-showlink-payment-route", "active");
  headers.set("x-showlink-payment-slug", slug);

  return new Response(html, {
    status: 200,
    headers
  });
}
