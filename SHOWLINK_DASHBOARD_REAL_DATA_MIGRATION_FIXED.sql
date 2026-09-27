-- ============================================================
-- SHOWLINK DASHBOARD REAL DATA MIGRATION
-- Version: 2026-09-28
-- Purpose:
--   1. Keep the existing SHOWLINK_MASTER_DATABASE schema intact.
--   2. Add dedicated Shortlink and Sub4unlock analytics tables.
--   3. Store valid click/task earnings in the database.
--   4. Keep user data isolated with RLS.
--
-- Existing canonical sources used by Dashboard:
-- profiles, wallets, wallet_transactions, pastelinks,
-- payment_links, orders, order_settlements, transactions,
-- analytics_events, link_views.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- SHORTLINKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.showlink_shortlinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','paused','expired','deleted')),
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  unique_views bigint NOT NULL DEFAULT 0 CHECK (unique_views >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showlink_shortlinks_owner_idx
  ON public.showlink_shortlinks(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS showlink_shortlinks_status_idx
  ON public.showlink_shortlinks(status);

-- A click becomes revenue only when the required task is completed
-- and the click has passed the validity checks.
CREATE TABLE IF NOT EXISTS public.showlink_shortlink_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlink_id uuid NOT NULL REFERENCES public.showlink_shortlinks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_hash text,
  is_valid boolean NOT NULL DEFAULT false,
  task_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  rate_per_click numeric(18,2) NOT NULL DEFAULT 0,
  earning_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (earning_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showlink_shortlink_clicks_owner_idx
  ON public.showlink_shortlink_clicks(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS showlink_shortlink_clicks_link_idx
  ON public.showlink_shortlink_clicks(shortlink_id, created_at DESC);

CREATE INDEX IF NOT EXISTS showlink_shortlink_clicks_valid_idx
  ON public.showlink_shortlink_clicks(owner_id, is_valid, completed_at);

-- ============================================================
-- SUB4UNLOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.showlink_sub4unlock_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','paused','expired','deleted')),
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  unique_views bigint NOT NULL DEFAULT 0 CHECK (unique_views >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showlink_sub4unlock_links_owner_idx
  ON public.showlink_sub4unlock_links(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.showlink_sub4unlock_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.showlink_sub4unlock_links(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_hash text,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','completed','failed','expired')),
  completed_at timestamptz,
  earning_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (earning_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showlink_sub4unlock_completions_owner_idx
  ON public.showlink_sub4unlock_completions(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS showlink_sub4unlock_completions_link_idx
  ON public.showlink_sub4unlock_completions(link_id, created_at DESC);

-- ============================================================
-- CPM CONFIG
-- User-defined dashboard reference:
--   Mon-Fri  Rp100-150
--   Sat-Sun  Rp150-250
-- These are stored as per-valid-click rates because that is the
-- earning rule supplied for the Dashboard.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.showlink_shortlink_cpm_config (
  id integer PRIMARY KEY,
  weekday_min numeric(18,2) NOT NULL DEFAULT 100,
  weekday_max numeric(18,2) NOT NULL DEFAULT 150,
  weekend_min numeric(18,2) NOT NULL DEFAULT 150,
  weekend_max numeric(18,2) NOT NULL DEFAULT 250,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (weekday_min >= 0 AND weekday_max >= weekday_min),
  CHECK (weekend_min >= 0 AND weekend_max >= weekend_min)
);

INSERT INTO public.showlink_shortlink_cpm_config(id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================

-- ============================================================
-- RLS / GRANTS
-- ============================================================
ALTER TABLE public.showlink_shortlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showlink_shortlink_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showlink_sub4unlock_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showlink_sub4unlock_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showlink_shortlink_cpm_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS showlink_shortlinks_owner_select ON public.showlink_shortlinks;
DROP POLICY IF EXISTS showlink_shortlinks_owner_write ON public.showlink_shortlinks;
CREATE POLICY showlink_shortlinks_owner_select
ON public.showlink_shortlinks FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin());
CREATE POLICY showlink_shortlinks_owner_write
ON public.showlink_shortlinks FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_current_user_admin());

-- Click rows are intentionally NOT insertable/updatable by normal users.
-- Only the trusted backend/service role should create and complete clicks.
DROP POLICY IF EXISTS showlink_shortlink_clicks_owner_select ON public.showlink_shortlink_clicks;
CREATE POLICY showlink_shortlink_clicks_owner_select
ON public.showlink_shortlink_clicks FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS showlink_sub4unlock_links_owner_select ON public.showlink_sub4unlock_links;
DROP POLICY IF EXISTS showlink_sub4unlock_links_owner_write ON public.showlink_sub4unlock_links;
CREATE POLICY showlink_sub4unlock_links_owner_select
ON public.showlink_sub4unlock_links FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin());
CREATE POLICY showlink_sub4unlock_links_owner_write
ON public.showlink_sub4unlock_links FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS showlink_sub4unlock_completions_owner_select ON public.showlink_sub4unlock_completions;
CREATE POLICY showlink_sub4unlock_completions_owner_select
ON public.showlink_sub4unlock_completions FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS showlink_cpm_authenticated_read ON public.showlink_shortlink_cpm_config;
CREATE POLICY showlink_cpm_authenticated_read
ON public.showlink_shortlink_cpm_config FOR SELECT TO authenticated
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.showlink_shortlinks,
   public.showlink_sub4unlock_links
TO authenticated;

GRANT SELECT
ON public.showlink_shortlink_clicks,
   public.showlink_sub4unlock_completions,
   public.showlink_shortlink_cpm_config
TO authenticated;

-- ============================================================
-- VALID SHORTLINK CLICK
-- SECURITY:
--   * callable only by service_role
--   * idempotent: cannot pay twice for the same click
--   * credits pending settlement, not available balance
--   * records an auditable wallet transaction
--   * increments link views exactly once on completion
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_showlink_shortlink_click(
  p_click_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_click public.showlink_shortlink_clicks;
  v_cfg public.showlink_shortlink_cpm_config;
  v_rate numeric(18,2);
  v_owner uuid;
  v_pending_before numeric(18,2);
  v_pending_after numeric(18,2);
  v_profile_pending numeric(18,2);
  v_unique_increment bigint := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  SELECT *
  INTO v_click
  FROM public.showlink_shortlink_clicks
  WHERE id = p_click_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHORTLINK_CLICK_NOT_FOUND';
  END IF;

  -- Idempotency: a completed click must never create another earning.
  IF v_click.is_valid AND v_click.task_completed AND v_click.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'click_id', v_click.id,
      'rate_per_click', v_click.rate_per_click,
      'earning_amount', v_click.earning_amount,
      'completed_at', v_click.completed_at
    );
  END IF;

  IF v_click.shortlink_id IS NULL OR v_click.owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SHORTLINK_CLICK';
  END IF;

  SELECT *
  INTO v_cfg
  FROM public.showlink_shortlink_cpm_config
  WHERE id = 1
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CPM_CONFIG_NOT_FOUND';
  END IF;

  -- The configured values are per valid click, exactly as defined by
  -- the Dashboard business rule. Pick a rate inside the configured band.
  IF extract(isodow FROM now()) IN (6,7) THEN
    v_rate := round(
      v_cfg.weekend_min
      + (random() * (v_cfg.weekend_max - v_cfg.weekend_min)),
      2
    );
  ELSE
    v_rate := round(
      v_cfg.weekday_min
      + (random() * (v_cfg.weekday_max - v_cfg.weekday_min)),
      2
    );
  END IF;

  v_owner := v_click.owner_id;

  -- Ensure the wallet exists before locking/updating it.
  INSERT INTO public.wallets (user_id)
  VALUES (v_owner)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT pending_balance
  INTO v_pending_before
  FROM public.wallets
  WHERE user_id = v_owner
  FOR UPDATE;

  v_pending_after := coalesce(v_pending_before,0) + v_rate;

  UPDATE public.showlink_shortlink_clicks
  SET is_valid = true,
      task_completed = true,
      completed_at = now(),
      rate_per_click = v_rate,
      earning_amount = v_rate
  WHERE id = p_click_id
  RETURNING * INTO v_click;

  -- A valid completion counts as a view.
  -- Count a unique view only when this visitor hash has not completed
  -- another click for the same shortlink.
  IF v_click.visitor_hash IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.showlink_shortlink_clicks c
    WHERE c.shortlink_id = v_click.shortlink_id
      AND c.visitor_hash = v_click.visitor_hash
      AND c.id <> v_click.id
      AND c.is_valid = true
  ) THEN
    v_unique_increment := 1;
  END IF;

  UPDATE public.showlink_shortlinks
  SET views = views + 1,
      unique_views = unique_views + v_unique_increment,
      updated_at = now()
  WHERE id = v_click.shortlink_id
    AND owner_id = v_owner;

  UPDATE public.wallets
  SET pending_balance = v_pending_after,
      lifetime_earned = lifetime_earned + v_rate,
      updated_at = now()
  WHERE user_id = v_owner;

  SELECT pending_balance INTO v_profile_pending
  FROM public.profiles
  WHERE id = v_owner;

  UPDATE public.profiles
  SET pending_balance = coalesce(v_profile_pending,0) + v_rate,
      total_earned = total_earned + v_rate,
      updated_at = now()
  WHERE id = v_owner;

  INSERT INTO public.wallet_transactions (
    user_id, type, direction, amount,
    balance_before, balance_after,
    description, metadata
  )
  VALUES (
    v_owner,
    'earning',
    'credit',
    v_rate,
    coalesce(v_pending_before,0),
    v_pending_after,
    'ShowLink Shortlink valid click',
    jsonb_build_object(
      'source','shortlink',
      'shortlink_id',v_click.shortlink_id,
      'click_id',v_click.id,
      'rate_per_click',v_rate,
      'settlement','pending'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_completed', false,
    'click_id', v_click.id,
    'rate_per_click', v_rate,
    'earning_amount', v_rate,
    'pending_balance', v_pending_after,
    'completed_at', v_click.completed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_showlink_shortlink_click(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_showlink_shortlink_click(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.complete_showlink_shortlink_click(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_showlink_shortlink_click(uuid) TO service_role;

-- ============================================================
-- SUB4UNLOCK COMPLETION
-- The actual earning amount is supplied by the trusted backend.
-- No public client can choose its own earning.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_showlink_sub4unlock(
  p_completion_id uuid,
  p_earning_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.showlink_sub4unlock_completions;
  v_before numeric(18,2);
  v_after numeric(18,2);
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_earning_amount IS NULL OR p_earning_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_EARNING_AMOUNT';
  END IF;

  SELECT *
  INTO v_row
  FROM public.showlink_sub4unlock_completions
  WHERE id = p_completion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUB4UNLOCK_COMPLETION_NOT_FOUND';
  END IF;

  IF v_row.status = 'completed' AND v_row.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'completion_id', v_row.id,
      'earning_amount', v_row.earning_amount
    );
  END IF;

  INSERT INTO public.wallets (user_id)
  VALUES (v_row.owner_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT pending_balance
  INTO v_before
  FROM public.wallets
  WHERE user_id = v_row.owner_id
  FOR UPDATE;

  v_after := coalesce(v_before,0) + p_earning_amount;

  UPDATE public.showlink_sub4unlock_completions
  SET status = 'completed',
      completed_at = now(),
      earning_amount = p_earning_amount
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  UPDATE public.wallets
  SET pending_balance = v_after,
      lifetime_earned = lifetime_earned + p_earning_amount,
      updated_at = now()
  WHERE user_id = v_row.owner_id;

  UPDATE public.profiles
  SET pending_balance = coalesce(pending_balance,0) + p_earning_amount,
      total_earned = total_earned + p_earning_amount,
      updated_at = now()
  WHERE id = v_row.owner_id;

  IF p_earning_amount > 0 THEN
    INSERT INTO public.wallet_transactions (
      user_id, type, direction, amount,
      balance_before, balance_after,
      description, metadata
    )
    VALUES (
      v_row.owner_id,
      'earning',
      'credit',
      p_earning_amount,
      coalesce(v_before,0),
      v_after,
      'ShowLink Sub4unlock task completed',
      jsonb_build_object(
        'source','sub4unlock',
        'completion_id',v_row.id,
        'link_id',v_row.link_id,
        'settlement','pending'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_completed', false,
    'completion_id', v_row.id,
    'earning_amount', p_earning_amount,
    'pending_balance', v_after,
    'completed_at', v_row.completed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_showlink_sub4unlock(uuid,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_showlink_sub4unlock(uuid,numeric) FROM anon;
REVOKE ALL ON FUNCTION public.complete_showlink_sub4unlock(uuid,numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_showlink_sub4unlock(uuid,numeric) TO service_role;

COMMIT;

