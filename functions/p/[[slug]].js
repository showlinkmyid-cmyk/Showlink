import { servePublicAsset } from "../_public_asset.js";

export function onRequestGet(context) {
  return servePublicAsset(context, "/payment-public.html");
}
