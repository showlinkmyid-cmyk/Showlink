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
-- RLS
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

-- CPM configuration is public-read for authenticated users.
DROP POLICY IF EXISTS showlink_cpm_authenticated_read ON public.showlink_shortlink_cpm_config;
CREATE POLICY showlink_cpm_authenticated_read
ON public.showlink_shortlink_cpm_config FOR SELECT TO authenticated
USING (true);

-- ============================================================
-- VALID CLICK RPC
-- The service records a completed/valid click and determines
-- the rate from the configured weekday/weekend range.
-- SECURITY DEFINER is used only for this controlled write.
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
BEGIN
  SELECT * INTO v_click
  FROM public.showlink_shortlink_clicks
  WHERE id = p_click_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHORTLINK_CLICK_NOT_FOUND';
  END IF;

  SELECT * INTO v_cfg
  FROM public.showlink_shortlink_cpm_config
  WHERE id = 1;

  IF extract(isodow FROM now()) IN (6,7) THEN
    v_rate := round((v_cfg.weekend_min + v_cfg.weekend_max) / 2, 2);
  ELSE
    v_rate := round((v_cfg.weekday_min + v_cfg.weekday_max) / 2, 2);
  END IF;

  UPDATE public.showlink_shortlink_clicks
  SET is_valid = true,
      task_completed = true,
      completed_at = now(),
      rate_per_click = v_rate,
      earning_amount = v_rate
  WHERE id = p_click_id
  RETURNING * INTO v_click;

  RETURN jsonb_build_object(
    'ok', true,
    'click_id', v_click.id,
    'rate_per_click', v_click.rate_per_click,
    'earning_amount', v_click.earning_amount,
    'completed_at', v_click.completed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_showlink_shortlink_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_showlink_shortlink_click(uuid) TO authenticated;

COMMIT;
