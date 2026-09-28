import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASHI_STATUS_URL = "https://cashi.id/api/check-status";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function hmacSha256Hex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyCashiStatus(cashiOrderId: string) {
  const response = await fetch(`${CASHI_STATUS_URL}/${encodeURIComponent(cashiOrderId)}`, {
    method: "GET",
    headers: { "x-api-key": env("CASHI_API_KEY") },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.message || result?.error || "Cashi status check failed");
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const raw = await req.text();
    const signature = req.headers.get("x-gateway-signature") || "";
    if (!signature) return json({ error: "Missing signature" }, 401);

    const expected = await hmacSha256Hex(raw, env("CASHI_SECRET_KEY"));
    if (!timingSafeEqual(expected.toLowerCase(), signature.trim().toLowerCase())) {
      return json({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(raw);
    const event = String(payload?.event || "");
    const data = payload?.data || {};
    const cashiOrderId = String(data?.order_id || payload?.order_id || "").trim();
    const status = String(data?.status || "").toUpperCase();

    if (event !== "PAYMENT_SETTLED" || status !== "SETTLED") {
      // Acknowledge other verified events without settling them.
      return json({ ok: true, ignored: true });
    }

    if (!cashiOrderId) return json({ error: "Missing order_id" }, 400);

    // Test webhook described by Cashi documentation.
    if (cashiOrderId.startsWith("TEST-")) {
      return json({ ok: true, test: true });
    }

    // Confirm SETTLED against Cashi's status endpoint before changing ShowLink state.
    const verified = await verifyCashiStatus(cashiOrderId);
    if (String(verified.status || "").toUpperCase() !== "SETTLED") {
      return json({ error: "Cashi payment is not settled" }, 409);
    }

    const supabase = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,status")
      .eq("provider", "CASHI")
      .eq("provider_order_id", cashiOrderId)
      .maybeSingle();

    if (orderError) {
      console.error(orderError);
      return json({ error: "Order lookup failed" }, 500);
    }
    if (!order) return json({ error: "Order not found" }, 404);

    // Canonical settlement function is responsible for idempotency,
    // seller/platform split, wallet update and content access.
    const { data: settled, error: settleError } = await supabase.rpc(
      "settle_paid_order",
      {
        p_order_id: order.id,
        p_provider: "CASHI",
        p_provider_payment_id: cashiOrderId,
        p_provider_payload: payload,
      },
    );

    if (settleError) {
      console.error("settle_paid_order failed", settleError);
      return json({ error: "Settlement failed" }, 500);
    }

    return json({
      ok: true,
      order_id: order.id,
      status: "SETTLED",
      settlement: settled,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Webhook error" }, 500);
  }
});
