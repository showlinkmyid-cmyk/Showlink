/**
 * ShowLink — Cloudflare Pages Function
 * POST /api/turnstile
 *
 * Server-side Turnstile verification.
 * Secret must be configured in Cloudflare Pages as:
 *   TURNSTILE_SECRET
 * (TURNSTILE_SECRET_KEY is accepted as a backwards-compatible fallback.)
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const ALLOWED_HOSTNAMES = new Set([
  "showlink.my.id",
  "www.showlink.my.id",
  "showlink-cm8.pages.dev"
]);

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

function getSecret(env) {
  return String(
    env?.TURNSTILE_SECRET ||
    env?.TURNSTILE_SECRET_KEY ||
    ""
  ).trim();
}

export async function onRequestPost({ request, env }) {
  const secret = getSecret(env);

  if (!secret) {
    return json({
      success: false,
      code: "server-not-configured",
      errors: ["missing-turnstile-secret"]
    }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({
      success: false,
      code: "invalid-request",
      errors: ["invalid-json"]
    }, 400);
  }

  const token = String(body?.token || "").trim();

  if (!token) {
    return json({
      success: false,
      code: "missing-token",
      errors: ["missing-input-response"]
    }, 400);
  }

  // Only accept requests coming from the same site.
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  const requestHost = normalizeHost(request.headers.get("Host"));
  const originHost = normalizeHost(origin ? new URL(origin).host : "");
  const refererHost = normalizeHost(referer ? new URL(referer).host : "");

  const suppliedHost = originHost || refererHost || requestHost;

  if (suppliedHost && !ALLOWED_HOSTNAMES.has(suppliedHost)) {
    return json({
      success: false,
      code: "request-host-mismatch",
      hostname: suppliedHost,
      errors: ["request-host-not-allowed"]
    }, 403);
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);

  const cfConnectingIp = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIp) form.set("remoteip", cfConnectingIp);

  let response;
  let result;

  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });
  } catch {
    return json({
      success: false,
      code: "cloudflare-unreachable",
      errors: ["siteverify-request-failed"]
    }, 502);
  }

  try {
    result = await response.json();
  } catch {
    return json({
      success: false,
      code: "cloudflare-invalid-response",
      errors: ["invalid-siteverify-response"]
    }, 502);
  }

  const errors = Array.isArray(result?.["error-codes"])
    ? result["error-codes"].map(String)
    : [];

  if (!response.ok) {
    return json({
      success: false,
      code: "cloudflare-http-error",
      status: response.status,
      errors
    }, 502);
  }

  if (!result?.success) {
    return json({
      success: false,
      code: "turnstile-rejected",
      errors
    }, 403);
  }

  const hostname = normalizeHost(result?.hostname);
  const action = String(result?.action || "").trim();

  // Prevent a valid token issued for another site from being reused here.
  if (hostname && !ALLOWED_HOSTNAMES.has(hostname)) {
    return json({
      success: false,
      code: "hostname-mismatch",
      hostname,
      errors: ["hostname-mismatch"]
    }, 403);
  }

  // auth-pages.js renders action="auth". Only accept that action.
  if (action && action !== "auth") {
    return json({
      success: false,
      code: "action-mismatch",
      action,
      errors: ["action-mismatch"]
    }, 403);
  }

  return json({
    success: true,
    hostname,
    action: action || "auth"
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store"
    }
  });
}
