import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASHI_STATUS_URL = "https://cashi.id/api/check-status";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id || "").trim();
    const guestToken = String(body.guest_access_token || "").trim();
    if (!orderId) return json({ error: "order_id is required" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let callerUserId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const authClient = createClient(
        supabaseUrl,
        env("SUPABASE_ANON_KEY"),
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader } },
        },
      );
      const { data: userData } = await authClient.auth.getUser();
      callerUserId = userData.user?.id || null;
    }

    if (!callerUserId && !guestToken) {
      return json({ error: "AUTH_OR_GUEST_TOKEN_REQUIRED" }, 401);
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,status,provider_order_id,buyer_id,guest_access_token")
      .eq("id", orderId)
      .single();

    if (orderError || !order) return json({ error: "Order not found" }, 404);

    const ownsAsUser = !!callerUserId && order.buyer_id === callerUserId;
    const ownsAsGuest = !callerUserId && !!guestToken && order.guest_access_token === guestToken;
    if (!ownsAsUser && !ownsAsGuest) {
      return json({ error: "ORDER_ACCESS_DENIED" }, 403);
    }

    if (["paid", "completed"].includes(String(order.status))) {
      return json({ success: true, status: "SETTLED", paid: true });
    }

    if (!order.provider_order_id) {
      return json({ success: false, status: order.status, paid: false });
    }

    const response = await fetch(
      `${CASHI_STATUS_URL}/${encodeURIComponent(order.provider_order_id)}`,
      { headers: { "x-api-key": env("CASHI_API_KEY") } },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success !== true) {
      const providerMessage =
        result?.message ||
        result?.error ||
        result?.errors ||
        `HTTP ${response.status}`;
      console.error("Cashi check-status rejected", {
        status: response.status,
        providerMessage,
        result,
      });
      return json({
        error: `CASHI_STATUS_CHECK_FAILED: ${String(providerMessage)}`,
        provider_status: response.status,
        provider_response: result,
      }, 502);
    }

    const cashiStatus = String(result.status || "").toUpperCase();
    if (cashiStatus === "SETTLED") {
      const { data: settled, error: settleError } = await supabase.rpc(
        "settle_paid_order",
        {
          p_order_id: order.id,
          p_provider: "CASHI",
          p_provider_payment_id: order.provider_order_id,
          p_provider_payload: result,
        },
      );
      if (settleError) {
        console.error(settleError);
        return json({ error: "Settlement failed" }, 500);
      }
      return json({ success: true, status: "SETTLED", paid: true, settlement: settled });
    }

    return json({
      success: true,
      status: cashiStatus || "PENDING",
      paid: false,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
