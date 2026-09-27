const ALLOWED_HOSTNAMES = new Set(["showlink.my.id", "www.showlink.my.id"]);
const EXPECTED_ACTION = "auth";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ success: false, code: "invalid-content-type" }, 415);
    }

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 2048) {
      return json({ success: false, code: "missing-or-invalid-token" }, 400);
    }

    // Canonical Spin name is TURNSTILE_SECRET. Keep the previous name as a
    // compatibility fallback so existing Cloudflare Pages deployments do not break.
    const secret = String(env?.TURNSTILE_SECRET || env?.TURNSTILE_SECRET_KEY || "").trim();
    if (!secret) {
      return json({ success: false, code: "server-not-configured" }, 500);
    }

    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    const remoteip = request.headers.get("CF-Connecting-IP");
    if (remoteip) form.set("remoteip", remoteip);

    const upstream = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      return json({ success: false, code: "cloudflare-http-error", status: upstream.status }, 502);
    }

    const result = await upstream.json().catch(() => ({}));
    if (result?.success !== true) {
      const errors = Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [];
      return json({ success: false, code: "verification-failed", errors }, 403);
    }

    const hostname = String(result?.hostname || "").toLowerCase();
    const action = String(result?.action || "");
    if (!ALLOWED_HOSTNAMES.has(hostname)) {
      return json({ success: false, code: "hostname-mismatch", hostname }, 403);
    }
    if (action && action !== EXPECTED_ACTION) {
      return json({ success: false, code: "action-mismatch", action }, 403);
    }

    return json({ success: true, hostname, action });
  } catch (error) {
    return json({ success: false, code: "server-error" }, 500);
  }
}
