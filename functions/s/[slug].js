export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env?.ASSETS?.fetch) return new Response("ShowLink Pages Assets binding is unavailable.", {status:500,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  const slug = String(params?.slug || "").trim();
  if (!slug) return new Response("Shortlink slug is missing.", {status:400,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  const assetUrl = new URL("/shortlink-public.html", request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), {method:"GET",headers:{"Accept":"text/html"}}));
  if (!assetResponse.ok) return new Response("Shortlink public page is unavailable.", {status:500,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  let html = await assetResponse.text();
  const injection = `<script>window.__SHOWLINK_SHORTLINK_SLUG=${JSON.stringify(slug)};</script>`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => `${m}${injection}`) : `${injection}${html}`;
  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type","text/html; charset=utf-8");
  headers.set("Cache-Control","no-store, no-cache, must-revalidate");
  headers.set("Pragma","no-cache");
  headers.set("x-showlink-shortlink-route","active");
  headers.set("x-showlink-shortlink-slug",slug);
  return new Response(html,{status:200,headers});
}
