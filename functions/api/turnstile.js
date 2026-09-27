/*
 * ShowLink — Cloudflare Pages Function
 * POST /api/turnstile
 * Server-side verification for the existing Turnstile widget.
 *
 * Required Production secret:
 *   TURNSTILE_SECRET
 *
 * Never put the secret in frontend JavaScript.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ALLOWED_HOSTS = new Set(["showlink.my.id", "www.showlink.my.id", "showlink-cm8.pages.dev"]);
const EXPECTED_ACTION = "auth";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function normalizeHost(value) {
  return String(value || "").trim().toLowerCase().split(":")[0];
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = String(env?.TURNSTILE_SECRET || "").trim();
    if (!secret) {
      return json({
        success: false,
        code: "server-not-configured",
        errors: ["missing-turnstile-secret"]
      }, 500);
    }

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
      return json({ success: false, code: "missing-token", errors: ["missing-input-response"] }, 400);
    }

    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);

    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) form.append("remoteip", ip);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      return json({
        success: false,
        code: "cloudflare-http-error",
        errors: [`http-${response.status}`]
      }, 502);
    }

    const result = await response.json().catch(() => null);
    if (!result || result.success !== true) {
      return json({
        success: false,
        code: "turnstile-rejected",
        errors: Array.isArray(result?.["error-codes"]) ? result["error-codes"] : ["verification-failed"],
        hostname: result?.hostname || null,
        action: result?.action || null
      }, 403);
    }

    const hostname = normalizeHost(result.hostname);
    if (hostname && !ALLOWED_HOSTS.has(hostname)) {
      return json({
        success: false,
        code: "hostname-mismatch",
        errors: ["hostname-mismatch"],
        hostname
      }, 403);
    }

    if (result.action && result.action !== EXPECTED_ACTION) {
      return json({
        success: false,
        code: "action-mismatch",
        errors: ["action-mismatch"],
        action: result.action
      }, 403);
    }

    return json({
      success: true,
      hostname,
      action: result.action || EXPECTED_ACTION
    });
  } catch (error) {
    return json({
      success: false,
      code: "server-error",
      errors: [String(error?.message || "verification-error")]
    }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "https://showlink.my.id",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}
