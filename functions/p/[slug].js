export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env || !env.ASSETS || !env.ASSETS.fetch) {
    return new Response("ShowLink Pages Assets binding is unavailable.", { status: 500 });
  }
  const assetUrl = new URL("/payment-link-public.html", request.url);
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  return response;
}
