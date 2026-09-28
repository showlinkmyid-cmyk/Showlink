-- ============================================================
-- SHOWLINK PAYMENT LINK PRICING — FINAL / MASTER-COMPATIBLE
-- FREE/GUEST 100% | VIP 70% | PREMIUM 50% | PLATFORM 20%
-- SELLER 80% OF ACTUAL AMOUNT PAID
--
-- IMPORTANT:
-- 1) Run SHOWLINK_MASTER_DATABASE.sql FIRST.
-- 2) This migration never creates a second orders table.
-- 3) Cashi must receive the returned "amount" from
--    create_checkout_order(), not payment_links.price.
-- 4) Cashi minimum is Rp2,000. If a discounted buyer amount is
--    below Rp2,000, checkout is rejected instead of sending an
--    invalid Cashi order.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Fail clearly if the canonical Master DB is not installed.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.payment_links') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.platform_finance_config') IS NULL
  THEN
    RAISE EXCEPTION
      'SHOWLINK_MASTER_REQUIRED: run SHOWLINK_MASTER_DATABASE.sql first. Missing canonical table(s): profiles/payment_links/orders/platform_finance_config';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. Account plan used by Payment Link pricing.
-- Canonical Master does not contain a plan column, so add one.
-- Existing users default to FREE.
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- Normalize existing values before adding the constraint.
UPDATE public.profiles
SET plan = CASE
  WHEN lower(trim(coalesce(plan,''))) IN ('premium','prem') THEN 'premium'
  WHEN lower(trim(coalesce(plan,''))) IN ('vip') THEN 'vip'
  ELSE 'free'
END;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free','vip','premium'));

CREATE INDEX IF NOT EXISTS profiles_plan_idx
  ON public.profiles(plan);

-- ------------------------------------------------------------
-- 2. Payment Link pricing configuration.
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
VALUES (true, 100.00, 70.00, 50.00, 100.00, 20.00)
ON CONFLICT (id) DO UPDATE
SET free_percent = EXCLUDED.free_percent,
    vip_percent = EXCLUDED.vip_percent,
    premium_percent = EXCLUDED.premium_percent,
    guest_percent = EXCLUDED.guest_percent,
    platform_fee_percent = EXCLUDED.platform_fee_percent,
    updated_at = now();

-- ------------------------------------------------------------
-- 3. Snapshot pricing on every order.
-- orders.amount = ACTUAL buyer amount sent to Cashi.
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

-- Safe backfill for historical rows: preserve orders.amount.
UPDATE public.orders
SET original_amount = COALESCE(original_amount, amount)
WHERE original_amount IS NULL;

-- ------------------------------------------------------------
-- 4. Buyer price calculator.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_link_buyer_price(
  p_original_amount numeric,
  p_buyer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  original_amount numeric,
  buyer_plan text,
  buyer_price_percent numeric,
  buyer_amount numeric,
  platform_fee_percent numeric,
  platform_fee_amount numeric,
  seller_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_plan text := 'guest';
  v_percent numeric := 100.00;
  v_platform_percent numeric := 20.00;
  v_buyer_amount numeric;
  v_platform_amount numeric;
  v_seller_amount numeric;
BEGIN
  IF p_original_amount IS NULL OR p_original_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_LINK_AMOUNT';
  END IF;

  IF p_buyer_id IS NOT NULL THEN
    SELECT lower(coalesce(plan, 'free'))
      INTO v_plan
    FROM public.profiles
    WHERE id = p_buyer_id;

    v_plan := coalesce(v_plan, 'free');

    IF v_plan NOT IN ('free','vip','premium') THEN
      v_plan := 'free';
    END IF;
  END IF;

  SELECT
    CASE v_plan
      WHEN 'vip' THEN vip_percent
      WHEN 'premium' THEN premium_percent
      WHEN 'free' THEN free_percent
      ELSE guest_percent
    END,
    platform_fee_percent
  INTO v_percent, v_platform_percent
  FROM public.payment_link_pricing_config
  WHERE id = true;

  v_percent := coalesce(v_percent, 100.00);
  v_platform_percent := coalesce(v_platform_percent, 20.00);

  v_buyer_amount := round(p_original_amount * v_percent / 100.00, 2);
  v_platform_amount := round(v_buyer_amount * v_platform_percent / 100.00, 2);
  v_seller_amount := round(v_buyer_amount - v_platform_amount, 2);

  RETURN QUERY
  SELECT
    round(p_original_amount, 2),
    v_plan,
    v_percent,
    v_buyer_amount,
    v_platform_percent,
    v_platform_amount,
    v_seller_amount;
END;
$$;

GRANT EXECUTE
ON FUNCTION public.get_payment_link_buyer_price(numeric, uuid)
TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. Canonical checkout order.
--
-- This replaces the Master function so pricing is calculated
-- BEFORE orders.amount is inserted.
--
-- Cashi must use:
--   returned amount == orders.amount
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_payment_link_id uuid,
  p_guest_access_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_link public.payment_links%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
  v_buyer uuid;
  v_original_amount numeric;
  v_buyer_plan text;
  v_buyer_price_percent numeric;
  v_buyer_amount numeric;
  v_platform_fee_percent numeric;
  v_platform_fee_amount numeric;
  v_seller_amount numeric;
BEGIN
  IF auth.uid() IS NULL
     AND coalesce(trim(p_guest_access_token),'') = '' THEN
    RAISE EXCEPTION 'AUTH_OR_GUEST_TOKEN_REQUIRED';
  END IF;

  SELECT * INTO v_link
  FROM public.payment_links
  WHERE id = p_payment_link_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_sales IS NULL OR sales_count < max_sales);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_LINK_NOT_AVAILABLE';
  END IF;

  v_buyer := auth.uid();

  -- Creator cannot purchase their own Payment Link.
  IF v_buyer IS NOT NULL AND v_buyer = v_link.owner_id THEN
    RAISE EXCEPTION 'CANNOT_BUY_OWN_PAYMENT_LINK';
  END IF;

  -- Logged-in buyers who already have access do not pay again.
  IF v_buyer IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.content_access
    WHERE payment_link_id = v_link.id
      AND buyer_id = v_buyer
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_accessible', true,
      'payment_link_id', v_link.id,
      'amount', 0,
      'currency', v_link.currency,
      'checkout_url', 'https://showlink.my.id/p/' || v_link.slug
    );
  END IF;

  -- Calculate the actual buyer amount before creating the order.
  SELECT
    p.original_amount,
    p.buyer_plan,
    p.buyer_price_percent,
    p.buyer_amount,
    p.platform_fee_percent,
    p.platform_fee_amount,
    p.seller_amount
  INTO
    v_original_amount,
    v_buyer_plan,
    v_buyer_price_percent,
    v_buyer_amount,
    v_platform_fee_percent,
    v_platform_fee_amount,
    v_seller_amount
  FROM public.get_payment_link_buyer_price(v_link.price, v_buyer) p;

  -- Cashi minimum is Rp2,000.
  IF v_buyer_amount < 2000 THEN
    RAISE EXCEPTION
      'PAYMENT_AMOUNT_BELOW_CASHI_MINIMUM:%',
      v_buyer_amount;
  END IF;

  v_order_number := public.showlink_order_number();

  INSERT INTO public.orders (
    buyer_id,
    seller_id,
    payment_link_id,
    order_number,
    item_title,
    amount,
    currency,
    status,
    guest_access_token,
    expires_at,
    original_amount,
    buyer_plan,
    buyer_price_percent,
    platform_fee_percent,
    platform_fee_amount,
    seller_amount
  )
  VALUES (
    v_buyer,
    v_link.owner_id,
    v_link.id,
    v_order_number,
    v_link.title,
    v_buyer_amount,
    v_link.currency,
    'pending',
    NULLIF(trim(p_guest_access_token), ''),
    now() + interval '30 minutes',
    v_original_amount,
    v_buyer_plan,
    v_buyer_price_percent,
    v_platform_fee_percent,
    v_platform_fee_amount,
    v_seller_amount
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_accessible', false,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'amount', v_buyer_amount,
    'original_amount', v_original_amount,
    'buyer_plan', v_buyer_plan,
    'buyer_price_percent', v_buyer_price_percent,
    'platform_fee_percent', v_platform_fee_percent,
    'platform_fee_amount', v_platform_fee_amount,
    'seller_amount', v_seller_amount,
    'currency', v_link.currency,
    'payment_link_id', v_link.id,
    'checkout_url', 'https://showlink.my.id/p/' || v_link.slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid,text) FROM PUBLIC;
GRANT EXECUTE
ON FUNCTION public.create_checkout_order(uuid,text)
TO anon, authenticated;

-- ------------------------------------------------------------
-- 6. Settlement = 80% seller / 20% platform of ACTUAL amount.
--
-- This is intentionally tied to orders.amount, which is the
-- amount already sent to Cashi.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_paid_order(
  p_order_id uuid,
  p_provider text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_seller numeric(18,2);
  v_platform numeric(18,2);
  v_platform_percent numeric(5,2) := 20.00;
  v_seller_percent numeric(5,2) := 80.00;
  v_platform_fee numeric(18,2);
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.status IN ('paid','completed') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_settled', true,
      'order_id', v_order.id
    );
  END IF;

  -- Payment Link settlement rule is fixed at 80/20.
  -- No payment-provider fee is silently invented here.
  v_platform_fee := round(v_order.amount * v_platform_percent / 100.00, 2);
  v_platform := v_platform_fee;
  v_seller := round(v_order.amount - v_platform, 2);

  UPDATE public.orders
  SET status = 'paid',
      paid_at = now(),
      updated_at = now(),
      payment_reference = coalesce(payment_reference, p_provider_payment_id),
      provider = coalesce(p_provider, provider),
      provider_order_id = coalesce(provider_order_id, p_provider_payment_id),
      platform_fee_percent = v_platform_percent,
      platform_fee_amount = v_platform,
      seller_amount = v_seller,
      gateway_payload = coalesce(p_provider_payload, '{}'::jsonb)
  WHERE id = v_order.id;

  INSERT INTO public.order_settlements (
    order_id,
    seller_id,
    gross_amount,
    payment_fee,
    seller_amount,
    platform_amount,
    status,
    available_at,
    released_at
  )
  VALUES (
    v_order.id,
    v_order.seller_id,
    v_order.amount,
    0,
    v_seller,
    v_platform,
    'released',
    now(),
    now()
  )
  ON CONFLICT (order_id) DO UPDATE
  SET gross_amount = excluded.gross_amount,
      payment_fee = excluded.payment_fee,
      seller_amount = excluded.seller_amount,
      platform_amount = excluded.platform_amount,
      status = 'released',
      available_at = excluded.available_at,
      released_at = excluded.released_at,
      updated_at = now();

  INSERT INTO public.platform_earnings (
    order_id,
    amount,
    source,
    description
  )
  VALUES (
    v_order.id,
    v_platform,
    'payment_link',
    'Payment Link platform fee 20%'
  );

  IF v_order.seller_id IS NOT NULL THEN
    INSERT INTO public.wallets (user_id)
    VALUES (v_order.seller_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.wallets
    SET available_balance = available_balance + v_seller,
        lifetime_earned = lifetime_earned + v_seller,
        updated_at = now()
    WHERE user_id = v_order.seller_id;

    UPDATE public.profiles
    SET balance = balance + v_seller,
        total_earned = total_earned + v_seller,
        updated_at = now()
    WHERE id = v_order.seller_id;

    INSERT INTO public.wallet_transactions (
      user_id,
      type,
      direction,
      amount,
      balance_before,
      balance_after,
      order_id,
      description
    )
    SELECT
      v_order.seller_id,
      'earning',
      'credit',
      v_seller,
      w.available_balance - v_seller,
      w.available_balance,
      v_order.id,
      'Payment Link sale'
    FROM public.wallets w
    WHERE w.user_id = v_order.seller_id;
  END IF;

  UPDATE public.payment_links
  SET sales_count = sales_count + 1,
      updated_at = now()
  WHERE id = v_order.payment_link_id;

  PERFORM public.grant_payment_access(v_order.id);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'settled', true,
    'gross_amount', v_order.amount,
    'platform_fee', v_platform,
    'seller_amount', v_seller
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_paid_order(uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE
ON FUNCTION public.settle_paid_order(uuid,text,text,jsonb)
TO service_role;

-- ------------------------------------------------------------
-- 7. RLS for pricing configuration.
-- ------------------------------------------------------------
ALTER TABLE public.payment_link_pricing_config
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_link_pricing_admin_only
ON public.payment_link_pricing_config;

CREATE POLICY payment_link_pricing_admin_only
ON public.payment_link_pricing_config
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

-- ------------------------------------------------------------
-- 8. Keep finance config synchronized for the canonical
-- settlement table. This table is used only by settle_paid_order
-- in the ShowLink Master DB.
-- ------------------------------------------------------------
UPDATE public.platform_finance_config
SET seller_share_percent = 80.0000,
    platform_share_percent = 20.0000,
    updated_at = now()
WHERE id = 1;

COMMIT;

-- ============================================================
-- EXPECTED CALCULATION
-- ============================================================
--
-- Original Rp15,000:
--
-- FREE/GUEST:
--   buyer = 15,000
--   platform = 3,000
--   seller = 12,000
--
-- VIP:
--   buyer = 10,500
--   platform = 2,100
--   seller = 8,400
--
-- PREMIUM:
--   buyer = 7,500
--   platform = 1,500
--   seller = 6,000
--
-- Cashi MUST receive the exact "amount" returned by
-- create_checkout_order().
--
-- ============================================================
