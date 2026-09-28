// Public pretty-route asset router.
// The browser URL remains /p/{slug}; only the HTML asset is served internally.
export async function servePublicAsset(context, assetPath) {
  const { request, env } = context;
  if (!env?.ASSETS?.fetch) {
    return new Response("Pages asset binding is unavailable.", { status: 500 });
  }
  const target = new URL(assetPath, request.url);
  target.search = new URL(request.url).search;
  return env.ASSETS.fetch(new Request(target.toString(), request));
}
