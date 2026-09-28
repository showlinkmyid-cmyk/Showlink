import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASHI_CREATE_URL = "https://cashi.id/api/create-order";
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
    if (!orderId) return json({ error: "order_id is required" }, 400);

    const supabase = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,amount,currency,status,payment_reference,provider_order_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return json({ error: "Order not found" }, 404);
    }

    if (["paid", "completed"].includes(String(order.status))) {
      return json({
        success: true,
        already_paid: true,
        order_id: order.id,
      });
    }

    if (!["pending", "waiting_payment", "processing"].includes(String(order.status))) {
      return json({
        error: `Order cannot be paid in status ${order.status}`,
      }, 409);
    }

    // Reuse an existing pending Cashi payment to avoid duplicate invoices.
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("provider_payment_id,invoice_id,checkout_url,qr_string,status,amount")
      .eq("order_id", order.id)
      .eq("provider", "CASHI")
      .in("status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.checkout_url || existingPayment?.qr_string) {
      return json({
        success: true,
        order_id: order.id,
        provider: "CASHI",
        checkout_url: existingPayment.checkout_url || null,
        qr_url: existingPayment.qr_string || null,
        reused: true,
      });
    }

    const cashiOrderId = `SL-${order.id}`;

    const response = await fetch(CASHI_CREATE_URL, {
      method: "POST",
      headers: {
        "x-api-key": env("CASHI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(order.amount),
        order_id: cashiOrderId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result?.success !== true) {
      return json({
        error: result?.message || result?.error || "Cashi create-order failed",
        provider_response: result,
      }, 502);
    }

    const providerId = String(result.orderId || cashiOrderId);
    const amount = Number(result.amount ?? order.amount);
    const fee = Number(result.fee ?? 0);
    const checkoutUrl = result.checkout_url ? String(result.checkout_url) : null;
    const qrUrl = result.qrUrl ? String(result.qrUrl) : null;

    const { error: paymentError } = await supabase.from("payments").upsert({
      order_id: order.id,
      provider: "CASHI",
      payment_method: "CASHI",
      provider_payment_id: providerId,
      invoice_id: providerId,
      amount,
      fee,
      net_amount: amount - fee,
      status: "pending",
      checkout_url: checkoutUrl,
      qr_string: qrUrl,
      provider_payload: result,
    }, { onConflict: "provider_payment_id" });

    if (paymentError) {
      console.error("payments upsert failed", paymentError);
      return json({ error: "Payment record could not be saved" }, 500);
    }

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        provider: "CASHI",
        provider_order_id: providerId,
        payment_reference: providerId,
        status: "waiting_payment",
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      console.error("order update failed", orderUpdateError);
      return json({ error: "Order could not be updated" }, 500);
    }

    return json({
      success: true,
      order_id: order.id,
      provider: "CASHI",
      cashi_order_id: providerId,
      amount,
      fee,
      checkout_url: checkoutUrl,
      qr_url: qrUrl,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
