// ShowLink public pretty-route asset router.
// Keeps /p/{slug} in the browser URL while serving the Payment Link page.
// This lets public-payment.js read the original pathname and resolve the slug.
export async function servePublicAsset(context, assetPath) {
  const { request, env } = context;

  if (!env?.ASSETS?.fetch) {
    return new Response("Pages asset binding is unavailable.", { status: 500 });
  }

  const target = new URL(assetPath, request.url);
  target.search = new URL(request.url).search;

  return env.ASSETS.fetch(new Request(target.toString(), request));
}
