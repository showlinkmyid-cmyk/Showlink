-- ============================================================
-- SHOWLINK PAYMENT LINK PRICING / VIP / PREMIUM / 80-20
-- Migration tambahan — TIDAK membuat database baru
-- ============================================================
--
-- Business rules:
--   Guest / FREE  = 100% of creator price
--   VIP           = 70% of creator price
--   PREMIUM       = 50% of creator price
--   Platform fee  = 20% of actual amount paid
--   Seller        = 80% of actual amount paid
--
-- Example original price Rp15,000:
--   Guest/FREE -> buyer pays Rp15,000 -> seller Rp12,000
--   VIP        -> buyer pays Rp10,500 -> seller Rp8,400
--   PREMIUM    -> buyer pays Rp 7,500 -> seller Rp6,000
--
-- IMPORTANT:
-- This migration assumes the canonical ShowLink master schema exists.
-- It does NOT delete existing Payment Link tables.
--
-- Before production:
-- create_checkout_order() and Cashi create-payment flow must use the
-- calculated buyer amount BEFORE sending the amount to Cashi.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Payment Link pricing configuration
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_link_pricing_config (
    id boolean PRIMARY KEY DEFAULT true CHECK (id = true),

    free_percent numeric(5,2) NOT NULL DEFAULT 100.00,
    vip_percent numeric(5,2) NOT NULL DEFAULT 70.00,
    premium_percent numeric(5,2) NOT NULL DEFAULT 50.00,
    guest_percent numeric(5,2) NOT NULL DEFAULT 100.00,

    platform_fee_percent numeric(5,2) NOT NULL DEFAULT 20.00,

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT payment_link_pricing_percent_check
    CHECK (
        free_percent BETWEEN 0 AND 100
        AND vip_percent BETWEEN 0 AND 100
        AND premium_percent BETWEEN 0 AND 100
        AND guest_percent BETWEEN 0 AND 100
        AND platform_fee_percent BETWEEN 0 AND 100
    )
);

INSERT INTO public.payment_link_pricing_config (
    id,
    free_percent,
    vip_percent,
    premium_percent,
    guest_percent,
    platform_fee_percent
)
VALUES (
    true,
    100.00,
    70.00,
    50.00,
    100.00,
    20.00
)
ON CONFLICT (id)
DO UPDATE SET
    free_percent = EXCLUDED.free_percent,
    vip_percent = EXCLUDED.vip_percent,
    premium_percent = EXCLUDED.premium_percent,
    guest_percent = EXCLUDED.guest_percent,
    platform_fee_percent = EXCLUDED.platform_fee_percent,
    updated_at = now();

-- ------------------------------------------------------------
-- 2. Order pricing snapshot columns
-- ------------------------------------------------------------

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS original_amount numeric(18,2);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS buyer_plan text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS buyer_price_percent numeric(5,2);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS platform_fee_amount numeric(18,2);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS seller_amount numeric(18,2);

-- ------------------------------------------------------------
-- 3. Helper: calculate Payment Link price for a buyer
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_payment_link_buyer_price(
    p_original_amount numeric,
    p_buyer_id uuid DEFAULT NULL
)
RETURNS TABLE (
    original_amount numeric,
    buyer_plan text,
    buyer_price_percent numeric,
    buyer_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan text := 'guest';
    v_percent numeric := 100.00;
BEGIN
    IF p_original_amount IS NULL OR p_original_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid payment link amount';
    END IF;

    IF p_buyer_id IS NOT NULL THEN
        SELECT lower(coalesce(plan, 'free'))
        INTO v_plan
        FROM public.profiles
        WHERE id = p_buyer_id;

        v_plan := coalesce(v_plan, 'free');
    END IF;

    SELECT
        CASE v_plan
            WHEN 'vip' THEN c.vip_percent
            WHEN 'premium' THEN c.premium_percent
            WHEN 'free' THEN c.free_percent
            ELSE c.guest_percent
        END
    INTO v_percent
    FROM public.payment_link_pricing_config c
    WHERE c.id = true;

    v_percent := coalesce(v_percent, 100.00);

    RETURN QUERY
    SELECT
        round(p_original_amount, 2),
        v_plan,
        v_percent,
        round(p_original_amount * v_percent / 100.00, 2);
END;
$$;

GRANT EXECUTE
ON FUNCTION public.get_payment_link_buyer_price(numeric, uuid)
TO anon, authenticated;

-- ------------------------------------------------------------
-- 4. Finance configuration: 80% seller / 20% platform
-- ------------------------------------------------------------

UPDATE public.platform_finance_config
SET
    seller_share_percent = 80.00,
    platform_share_percent = 20.00,
    updated_at = now();

-- ------------------------------------------------------------
-- 5. RLS for configuration
-- ------------------------------------------------------------

ALTER TABLE public.payment_link_pricing_config
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
    "payment_link_pricing_admin_only"
ON public.payment_link_pricing_config;

CREATE POLICY
    "payment_link_pricing_admin_only"
ON public.payment_link_pricing_config
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_admin = true
    )
);

COMMIT;

-- ============================================================
-- IMPORTANT NEXT STEP
-- ============================================================
--
-- Do NOT rely on a BEFORE INSERT trigger to change orders.amount
-- after the Cashi amount has been determined.
--
-- The canonical create_checkout_order() should calculate:
--
--   original Payment Link price
--          ↓
--   buyer plan
--          ↓
--   buyer amount
--          ↓
--   INSERT orders.amount = buyer amount
--          ↓
--   Cashi create-order.amount = orders.amount
--
-- This guarantees:
--
--   database amount == Cashi amount
--
-- The final create_checkout_order() migration should therefore be
-- updated together with the Cashi adapter before live transactions.
-- ============================================================
