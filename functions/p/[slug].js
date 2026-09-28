export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env?.ASSETS?.fetch) {
    return new Response("Pages asset binding is unavailable.", { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const parts = requestUrl.pathname.split("/").filter(Boolean);
  const slug = parts[0] === "p" && parts[1] ? decodeURIComponent(parts[1]) : "";

  if (!slug) return new Response("Payment Link slug is missing.", { status: 400 });

  const target = new URL("/payment-public.html", request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(target.toString(), request));
  if (!assetResponse.ok) return assetResponse;

  const html = await assetResponse.text();
  const bootstrap = `<script>window.__SHOWLINK_PAYMENT_SLUG=${JSON.stringify(slug)};</script>`;
  const body = html.includes("</head>") ? html.replace("</head>", `${bootstrap}</head>`) : `${bootstrap}${html}`;

  const headers = new Headers(assetResponse.headers);
  headers.set("content-type", "text/html; charset=UTF-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { status: assetResponse.status, headers });
}
