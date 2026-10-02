-- ============================================================
-- SHOWLINK.MY.ID — PAYMENT LINK + CASHI FINAL DATABASE
-- ONE canonical SQL for the Master database + Payment Link pricing.
--
-- Payment Link URL: https://showlink.my.id/p/{slug}
-- Buyer price: FREE/GUEST 100% | VIP 70% | PREMIUM 50%
-- Settlement: CREATOR 80% | PLATFORM 20% of actual amount paid
-- Cashi minimum: Rp2,000 | Creator price: Rp2,000–Rp100,000
--
-- IMPORTANT
-- Run this file once in the target Supabase project.
-- Do not additionally run the old Payment Link pricing SQL files.
-- Cashi API secrets stay in Supabase Edge Function secrets.
-- ============================================================

-- ============================================================
-- SHOWLINK.MY.ID — MASTER DATABASE
-- PasteLink + Payment Link
-- PostgreSQL / Supabase
--
-- URL CONTRACT
--   PasteLink      => https://showlink.my.id/p/{slug}
--   Payment Link   => https://showlink.my.id/p/{slug}
--
-- CREATOR FLOW
--   task1 -> task2 -> task3 -> final -> published content
--
-- INTERNAL REVENUE
--   seller/platform settlement is stored internally.
--   Public APIs/views do NOT expose the platform split.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;

-- ============================================================
-- ENUM-LIKE CHECKED TEXT VALUES
-- ============================================================

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  auth_email text,
  display_name text,
  avatar_url text,
  bio text,
  country text,
  role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','admin','moderator')),
  is_admin boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pending_balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  total_earned numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  total_withdrawn numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance numeric(18,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pending_balance numeric(18,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_earned numeric(18,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_withdrawn numeric(18,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================
-- SITE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'manual',
  currency text NOT NULL DEFAULT 'IDR',
  min_payment numeric(18,2) NOT NULL DEFAULT 2000,
  max_payment numeric(18,2) NOT NULL DEFAULT 100000000,
  fee_fixed numeric(18,2) NOT NULL DEFAULT 0,
  fee_percent numeric(8,4) NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_payment >= 0),
  CHECK (max_payment >= min_payment),
  CHECK (fee_fixed >= 0),
  CHECK (fee_percent >= 0)
);

INSERT INTO public.payment_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Internal-only platform settlement configuration.
-- Never expose this table through public views/RPCs.
CREATE TABLE IF NOT EXISTS public.platform_finance_config (
  id integer PRIMARY KEY DEFAULT 1,
  seller_share_percent numeric(8,4) NOT NULL DEFAULT 70.0000,
  platform_share_percent numeric(8,4) NOT NULL DEFAULT 30.0000,
  withdrawal_min numeric(18,2) NOT NULL DEFAULT 10000,
  withdrawal_fee_fixed numeric(18,2) NOT NULL DEFAULT 0,
  withdrawal_fee_percent numeric(8,4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (seller_share_percent >= 0 AND seller_share_percent <= 100),
  CHECK (platform_share_percent >= 0 AND platform_share_percent <= 100),
  CHECK (seller_share_percent + platform_share_percent = 100),
  CHECK (withdrawal_min >= 0),
  CHECK (withdrawal_fee_fixed >= 0),
  CHECK (withdrawal_fee_percent >= 0)
);

INSERT INTO public.platform_finance_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PASTELINKS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pastelinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',

  -- Final published content.
  content_html text NOT NULL DEFAULT '',
  content_text text NOT NULL DEFAULT '',
  thumbnail_url text,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','unpublished','expired','deleted')),
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','unlisted','private')),

  password_hash text,
  expires_at timestamptz,

  allow_comments boolean NOT NULL DEFAULT true,
  allow_copy boolean NOT NULL DEFAULT true,
  allow_download boolean NOT NULL DEFAULT true,

  tags text[] NOT NULL DEFAULT '{}'::text[],

  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  unique_views bigint NOT NULL DEFAULT 0 CHECK (unique_views >= 0),

  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pastelinks_owner_idx
  ON public.pastelinks(owner_id);
CREATE INDEX IF NOT EXISTS pastelinks_status_idx
  ON public.pastelinks(status);
CREATE INDEX IF NOT EXISTS pastelinks_published_idx
  ON public.pastelinks(published_at DESC);

-- ============================================================
-- PASTELINK CREATOR FLOW
-- task1 -> task2 -> task3 -> final
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pastelink_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pastelink_id uuid REFERENCES public.pastelinks(id) ON DELETE CASCADE,

  current_step text NOT NULL DEFAULT 'task1'
    CHECK (current_step IN ('task1','task2','task3','final','completed')),

  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  content_html text NOT NULL DEFAULT '',
  content_text text NOT NULL DEFAULT '',
  thumbnail_url text,
  password_hash text,
  tags text[] NOT NULL DEFAULT '{}'::text[],

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pastelink_drafts_owner_idx
  ON public.pastelink_drafts(owner_id);

CREATE TABLE IF NOT EXISTS public.pastelink_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.pastelink_drafts(id) ON DELETE CASCADE,

  step_key text NOT NULL
    CHECK (step_key IN ('task1','task2','task3','final')),
  step_order integer NOT NULL
    CHECK (step_order BETWEEN 1 AND 4),

  title text,
  content_html text NOT NULL DEFAULT '',
  content_text text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (draft_id, step_key),
  UNIQUE (draft_id, step_order)
);

CREATE INDEX IF NOT EXISTS pastelink_steps_draft_idx
  ON public.pastelink_steps(draft_id, step_order);

-- ============================================================
-- PAYMENT LINKS
-- /p/{slug}
--
-- A payment link is a checkout gate for content.
-- After successful payment, the buyer gets access to the
-- configured delivery/content.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  thumbnail_url text,

  price numeric(18,2) NOT NULL CHECK (price > 0),
  currency text NOT NULL DEFAULT 'IDR',

  -- Optional content destination after payment.
  pastelink_id uuid REFERENCES public.pastelinks(id) ON DELETE SET NULL,

  -- Optional direct content if the payment link is not tied to a PasteLink.
  content_html text NOT NULL DEFAULT '',
  content_text text NOT NULL DEFAULT '',

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','expired','deleted')),

  expires_at timestamptz,

  max_sales bigint,
  sales_count bigint NOT NULL DEFAULT 0 CHECK (sales_count >= 0),

  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  unique_views bigint NOT NULL DEFAULT 0 CHECK (unique_views >= 0),

  success_title text NOT NULL DEFAULT 'Pembayaran berhasil',
  success_message text NOT NULL DEFAULT 'Pembayaran berhasil. Konten kamu sudah dapat dibuka.',

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (price >= 100),
  CHECK (max_sales IS NULL OR max_sales > 0)
);

CREATE INDEX IF NOT EXISTS payment_links_owner_idx
  ON public.payment_links(owner_id);
CREATE INDEX IF NOT EXISTS payment_links_status_idx
  ON public.payment_links(status);
CREATE INDEX IF NOT EXISTS payment_links_pastelink_idx
  ON public.payment_links(pastelink_id);

-- ============================================================
-- PAYMENT LINK ACCESS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  buyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_access_token text,

  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE CASCADE,
  pastelink_id uuid REFERENCES public.pastelinks(id) ON DELETE CASCADE,
  order_id uuid,

  access_type text NOT NULL DEFAULT 'paid'
    CHECK (access_type IN ('paid','free','admin')),

  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,

  UNIQUE (buyer_id, payment_link_id),
  CHECK (buyer_id IS NOT NULL OR guest_access_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS content_access_buyer_idx
  ON public.content_access(buyer_id);
CREATE INDEX IF NOT EXISTS content_access_payment_link_idx
  ON public.content_access(payment_link_id);
CREATE INDEX IF NOT EXISTS content_access_guest_token_idx
  ON public.content_access(guest_access_token);
CREATE UNIQUE INDEX IF NOT EXISTS content_access_guest_payment_uidx
  ON public.content_access(guest_access_token, payment_link_id)
  WHERE guest_access_token IS NOT NULL;

-- ============================================================
-- GUEST BUYER PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guest_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token text NOT NULL UNIQUE,
  public_username text NOT NULL UNIQUE,
  device_hash text,
  last_ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_buyers_device_idx
  ON public.guest_buyers(device_hash);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  buyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_buyer_id uuid REFERENCES public.guest_buyers(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,

  order_number text NOT NULL UNIQUE,

  item_title text NOT NULL DEFAULT '',
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'IDR',

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending','waiting_payment','paid','processing',
      'completed','failed','cancelled','expired','refunded'
    )),

  payment_reference text,
  provider text,
  provider_order_id text,

  guest_access_token text,

  gateway_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  paid_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (buyer_id IS NOT NULL OR guest_buyer_id IS NOT NULL OR guest_access_token IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_uidx
  ON public.orders(payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_order_uidx
  ON public.orders(provider, provider_order_id)
  WHERE provider IS NOT NULL AND provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_buyer_idx
  ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_seller_idx
  ON public.orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_link_idx
  ON public.orders(payment_link_id, created_at DESC);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  provider text NOT NULL,
  payment_method text,
  provider_payment_id text,
  invoice_id text,

  amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  fee numeric(18,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  net_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','expired','refunded','cancelled')),

  checkout_url text,
  qr_string text,

  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  paid_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_order_idx
  ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_status_idx
  ON public.payments(status);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_uidx
  ON public.payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- ============================================================
-- INTERNAL SETTLEMENT
-- IMPORTANT: seller/platform split is private backend data.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  gross_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  payment_fee numeric(18,2) NOT NULL DEFAULT 0 CHECK (payment_fee >= 0),

  seller_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (seller_amount >= 0),
  platform_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (platform_amount >= 0),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','held','released','refunded')),

  available_at timestamptz,
  released_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  source text NOT NULL DEFAULT 'payment_link',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Non-unique lookup index. Settlement uses a transaction advisory lock
-- so existing historical duplicate rows cannot make this migration fail.
CREATE INDEX IF NOT EXISTS platform_earnings_order_idx
  ON public.platform_earnings(order_id)
  WHERE order_id IS NOT NULL;

-- ============================================================
-- WALLETS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  lifetime_earned numeric(18,2) NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  lifetime_withdrawn numeric(18,2) NOT NULL DEFAULT 0 CHECK (lifetime_withdrawn >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  type text NOT NULL
    CHECK (type IN ('earning','withdrawal','refund','adjustment','release','reversal')),

  direction text NOT NULL
    CHECK (direction IN ('credit','debit')),

  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  balance_before numeric(18,2) NOT NULL DEFAULT 0,
  balance_after numeric(18,2) NOT NULL DEFAULT 0,

  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  withdrawal_id uuid,

  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx
  ON public.wallet_transactions(user_id, created_at DESC);

-- ============================================================
-- WITHDRAWALS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.withdrawal_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  method_type text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method_id uuid REFERENCES public.withdrawal_methods(id) ON DELETE SET NULL,

  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  fee numeric(18,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  net_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','paid','rejected','cancelled')),

  admin_note text,
  provider_reference text,
  processed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS withdrawals_user_idx
  ON public.withdrawals(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'wallet_transactions_withdrawal_fk'
      AND n.nspname = 'public'
      AND t.relname = 'wallet_transactions'
  ) THEN
    ALTER TABLE public.wallet_transactions
      ADD CONSTRAINT wallet_transactions_withdrawal_fk
      FOREIGN KEY (withdrawal_id)
      REFERENCES public.withdrawals(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- ============================================================
-- ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.link_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_token text,

  pastelink_id uuid REFERENCES public.pastelinks(id) ON DELETE CASCADE,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE CASCADE,

  ip_hash text,
  visitor_hash text,
  user_agent text,
  referer text,
  country text,
  device_type text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (pastelink_id IS NOT NULL OR payment_link_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS link_views_paste_idx
  ON public.link_views(pastelink_id, created_at DESC);
CREATE INDEX IF NOT EXISTS link_views_payment_idx
  ON public.link_views(payment_link_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  event_name text NOT NULL,
  pastelink_id uuid REFERENCES public.pastelinks(id) ON DELETE CASCADE,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx
  ON public.analytics_events(created_at DESC);

-- ============================================================
-- COMMENTS / LIKES / FOLLOW
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pastelink_id uuid NOT NULL REFERENCES public.pastelinks(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.content_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_comments_paste_idx
  ON public.content_comments(pastelink_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.content_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pastelink_id uuid NOT NULL REFERENCES public.pastelinks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pastelink_id)
);

CREATE TABLE IF NOT EXISTS public.creator_followers (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, creator_id),
  CHECK (follower_id <> creator_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  link_url text,

  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications(user_id, created_at DESC);

-- ============================================================
-- ADMIN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION public.showlink_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pastelinks_updated_at ON public.pastelinks;
CREATE TRIGGER trg_pastelinks_updated_at
BEFORE UPDATE ON public.pastelinks
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pastelink_drafts_updated_at ON public.pastelink_drafts;
CREATE TRIGGER trg_pastelink_drafts_updated_at
BEFORE UPDATE ON public.pastelink_drafts
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pastelink_steps_updated_at ON public.pastelink_steps;
CREATE TRIGGER trg_pastelink_steps_updated_at
BEFORE UPDATE ON public.pastelink_steps
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_payment_links_updated_at ON public.payment_links;
CREATE TRIGGER trg_payment_links_updated_at
BEFORE UPDATE ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_order_settlements_updated_at ON public.order_settlements;
CREATE TRIGGER trg_order_settlements_updated_at
BEFORE UPDATE ON public.order_settlements
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

DROP TRIGGER IF EXISTS trg_withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER trg_withdrawals_updated_at
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.showlink_touch_updated_at();

-- ============================================================
-- PROFILE CREATION FROM SUPABASE AUTH
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_username text;
  final_username text;
BEGIN
  base_username := lower(
    regexp_replace(
      coalesce(new.raw_user_meta_data->>'username',
               split_part(coalesce(new.email,''),'@',1),
               'user'),
      '[^a-zA-Z0-9_]+', '', 'g'
    )
  );

  IF base_username = '' THEN
    base_username := 'user';
  END IF;

  final_username := left(base_username, 24);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) THEN
    final_username := left(base_username, 18) || '_' ||
      substr(replace(gen_random_uuid()::text,'-',''),1,6);
  END IF;

  INSERT INTO public.profiles (
    id, username, auth_email, display_name
  )
  VALUES (
    new.id,
    final_username,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', final_username)
  )
  ON CONFLICT (id) DO UPDATE
  SET auth_email = excluded.auth_email,
      updated_at = now();

  INSERT INTO public.wallets (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_showlink ON auth.users;
CREATE TRIGGER on_auth_user_created_showlink
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ADMIN CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
      AND is_banned = false
  );
$$;

-- ============================================================
-- SLUG GENERATOR
-- ============================================================

CREATE OR REPLACE FUNCTION public.showlink_random_slug(p_length integer DEFAULT 4)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  result text := '';
  i integer;
BEGIN
  IF p_length < 4 THEN
    p_length := 4;
  END IF;

  LOOP
    result := '';
    FOR i IN 1..p_length LOOP
      result := result || substr(alphabet, 1 + floor(random()*length(alphabet))::integer, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pastelinks WHERE slug = result
      UNION ALL
      SELECT 1 FROM public.payment_links WHERE slug = result
    );
  END LOOP;

  RETURN result;
END;
$$;

-- ============================================================
-- PASTELINK CREATION FLOW
-- task1 -> task2 -> task3 -> final
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_pastelink_draft()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_draft uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  INSERT INTO public.pastelink_drafts (owner_id, current_step)
  VALUES (auth.uid(), 'task1')
  RETURNING id INTO v_draft;

  INSERT INTO public.pastelink_steps (draft_id, step_key, step_order)
  VALUES
    (v_draft, 'task1', 1),
    (v_draft, 'task2', 2),
    (v_draft, 'task3', 3),
    (v_draft, 'final', 4);

  RETURN jsonb_build_object(
    'draft_id', v_draft,
    'current_step', 'task1',
    'steps', jsonb_build_array('task1','task2','task3','final')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_pastelink_step(
  p_draft_id uuid,
  p_step_key text,
  p_title text DEFAULT NULL,
  p_content_html text DEFAULT '',
  p_content_text text DEFAULT '',
  p_data jsonb DEFAULT '{}'::jsonb,
  p_is_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order integer;
  v_next text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT step_order
  INTO v_order
  FROM public.pastelink_steps s
  JOIN public.pastelink_drafts d ON d.id = s.draft_id
  WHERE s.draft_id = p_draft_id
    AND s.step_key = p_step_key
    AND d.owner_id = auth.uid();

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'STEP_NOT_FOUND';
  END IF;

  UPDATE public.pastelink_steps
  SET title = p_title,
      content_html = coalesce(p_content_html,''),
      content_text = coalesce(p_content_text,''),
      data = coalesce(p_data,'{}'::jsonb),
      is_completed = p_is_completed,
      completed_at = CASE WHEN p_is_completed THEN now() ELSE NULL END,
      updated_at = now()
  WHERE draft_id = p_draft_id
    AND step_key = p_step_key;

  v_next := CASE p_step_key
    WHEN 'task1' THEN 'task2'
    WHEN 'task2' THEN 'task3'
    WHEN 'task3' THEN 'final'
    ELSE 'completed'
  END;

  UPDATE public.pastelink_drafts
  SET current_step = CASE
        WHEN p_is_completed THEN v_next
        ELSE p_step_key
      END,
      updated_at = now()
  WHERE id = p_draft_id
    AND owner_id = auth.uid();

  RETURN jsonb_build_object(
    'draft_id', p_draft_id,
    'step', p_step_key,
    'completed', p_is_completed,
    'next_step', CASE WHEN p_is_completed THEN v_next ELSE p_step_key END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_pastelink_draft(
  p_draft_id uuid,
  p_title text,
  p_description text DEFAULT '',
  p_thumbnail_url text DEFAULT NULL,
  p_tags text[] DEFAULT '{}',
  p_password_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_draft public.pastelink_drafts%ROWTYPE;
  v_final public.pastelink_steps%ROWTYPE;
  v_id uuid;
  v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT d.* INTO v_draft
  FROM public.pastelink_drafts d
  WHERE d.id = p_draft_id
    AND d.owner_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_NOT_FOUND';
  END IF;

  SELECT s.* INTO v_final
  FROM public.pastelink_steps s
  WHERE s.draft_id = p_draft_id
    AND s.step_key = 'final';

  IF NOT FOUND OR NOT v_final.is_completed THEN
    RAISE EXCEPTION 'FINAL_STEP_NOT_COMPLETED';
  END IF;

  v_slug := public.showlink_random_slug(4);

  INSERT INTO public.pastelinks (
    owner_id, slug, title, description,
    content_html, content_text, thumbnail_url,
    tags, password_hash, status, visibility, published_at
  )
  VALUES (
    auth.uid(), v_slug, trim(p_title), coalesce(p_description,''),
    coalesce(v_final.content_html,''), coalesce(v_final.content_text,''),
    p_thumbnail_url, coalesce(p_tags,'{}'), p_password_hash,
    'published', 'public', now()
  )
  RETURNING id INTO v_id;

  UPDATE public.pastelink_drafts
  SET pastelink_id = v_id,
      current_step = 'completed',
      title = p_title,
      description = coalesce(p_description,''),
      content_html = coalesce(v_final.content_html,''),
      content_text = coalesce(v_final.content_text,''),
      thumbnail_url = p_thumbnail_url,
      password_hash = p_password_hash,
      tags = coalesce(p_tags,'{}'),
      updated_at = now()
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'slug', v_slug,
    'url', 'https://showlink.my.id/p/' || v_slug
  );
END;
$$;

-- ============================================================
-- CREATE PASTELINK
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_pastelink(
  p_title text,
  p_description text DEFAULT '',
  p_content_html text DEFAULT '',
  p_content_text text DEFAULT '',
  p_thumbnail_url text DEFAULT NULL,
  p_tags text[] DEFAULT '{}',
  p_password_hash text DEFAULT NULL,
  p_visibility text DEFAULT 'public'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF length(trim(coalesce(p_title,''))) = 0 THEN
    RAISE EXCEPTION 'TITLE_REQUIRED';
  END IF;

  v_slug := public.showlink_random_slug(4);

  INSERT INTO public.pastelinks (
    owner_id, slug, title, description,
    content_html, content_text, thumbnail_url,
    tags, password_hash, visibility,
    status, published_at
  )
  VALUES (
    auth.uid(), v_slug, trim(p_title), coalesce(p_description,''),
    coalesce(p_content_html,''), coalesce(p_content_text,''),
    p_thumbnail_url, coalesce(p_tags,'{}'),
    p_password_hash, coalesce(p_visibility,'public'),
    'published', now()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'slug', v_slug,
    'url', 'https://showlink.my.id/p/' || v_slug
  );
END;
$$;

-- ============================================================
-- CREATE PAYMENT LINK
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_payment_link(
  p_title text,
  p_description text,
  p_price numeric,
  p_pastelink_id uuid DEFAULT NULL,
  p_content_html text DEFAULT '',
  p_content_text text DEFAULT '',
  p_thumbnail_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_slug text;
  v_plan text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT lower(coalesce(plan, 'free'))
    INTO v_plan
  FROM public.profiles
  WHERE id = auth.uid();

  IF coalesce(v_plan, 'free') NOT IN ('vip', 'premium') THEN
    RAISE EXCEPTION 'PLAN_REQUIRED: Payment Link hanya tersedia untuk akun VIP dan Premium';
  END IF;

  IF p_price IS NULL OR p_price < 2000 OR p_price > 100000 THEN
    RAISE EXCEPTION 'INVALID_PRICE: Payment Link price must be between Rp2,000 and Rp100,000';
  END IF;

  IF p_pastelink_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pastelinks
    WHERE id = p_pastelink_id
      AND owner_id = auth.uid()
      AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'PASTELINK_NOT_OWNED';
  END IF;

  v_slug := public.showlink_random_slug(4);

  INSERT INTO public.payment_links (
    owner_id, slug, title, description, price,
    pastelink_id, content_html, content_text,
    thumbnail_url, status, published_at
  )
  VALUES (
    auth.uid(), v_slug, trim(p_title), coalesce(p_description,''),
    p_price, p_pastelink_id, coalesce(p_content_html,''),
    coalesce(p_content_text,''), p_thumbnail_url,
    'active', now()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'slug', v_slug,
    'url', 'https://showlink.my.id/p/' || v_slug,
    'checkout_url', 'https://showlink.my.id/p/' || v_slug
  );
END;
$$;

-- ============================================================
-- PUBLIC PASTELINK LOOKUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pastelink_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'title', p.title,
    'description', p.description,
    'content_html', p.content_html,
    'content_text', p.content_text,
    'thumbnail_url', p.thumbnail_url,
    'visibility', p.visibility,
    'has_password', p.password_hash IS NOT NULL,
    'allow_comments', p.allow_comments,
    'allow_copy', p.allow_copy,
    'allow_download', p.allow_download,
    'tags', p.tags,
    'views', p.views,
    'published_at', p.published_at,
    'is_paid', (pl.id IS NOT NULL),
    'payment_link_id', pl.id,
    'payment_link_slug', pl.slug,
    'price', pl.price,
    'currency', pl.currency
  )
  FROM public.pastelinks p
  LEFT JOIN LATERAL (
    SELECT x.*
    FROM public.payment_links x
    WHERE x.pastelink_id = p.id
      AND x.status IN ('active','paused')
      AND (x.expires_at IS NULL OR x.expires_at > now())
    ORDER BY x.created_at DESC
    LIMIT 1
  ) pl ON true
  WHERE p.slug = p_slug
    AND p.status = 'published'
    AND p.visibility <> 'private'
    AND (p.expires_at IS NULL OR p.expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.get_pastelink_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pastelink_by_slug(text) TO anon, authenticated;

-- ============================================================
-- PUBLIC PAYMENT LINK LOOKUP
-- Always returns checkout information first.
-- Content is intentionally not exposed before successful access.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_payment_link_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'title', p.title,
    'description', p.description,
    'thumbnail_url', p.thumbnail_url,
    'price', p.price,
    'currency', p.currency,
    'status', p.status,
    'sales_count', p.sales_count,
    'views', p.views,
    'checkout_url', 'https://showlink.my.id/p/' || p.slug,
    'requires_payment', true
  )
  FROM public.payment_links p
  WHERE p.slug = p_slug
    AND p.status = 'active'
    AND (p.expires_at IS NULL OR p.expires_at > now())
    AND (p.max_sales IS NULL OR p.sales_count < p.max_sales);
$$;

-- ============================================================
-- ORDER NUMBER
-- ============================================================

CREATE OR REPLACE FUNCTION public.showlink_order_number()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'SL-' ||
    to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
$$;

-- ============================================================
-- CREATE CHECKOUT ORDER
-- ============================================================

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
BEGIN
  IF auth.uid() IS NULL AND coalesce(trim(p_guest_access_token),'') = '' THEN
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

  v_order_number := public.showlink_order_number();

  INSERT INTO public.orders (
    buyer_id, seller_id, payment_link_id,
    order_number, item_title, amount, currency,
    status, guest_access_token, expires_at
  )
  VALUES (
    v_buyer, v_link.owner_id, v_link.id,
    v_order_number, v_link.title, v_link.price, v_link.currency,
    'pending', p_guest_access_token, now() + interval '30 minutes'
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'amount', v_link.price,
    'currency', v_link.currency,
    'payment_link_id', v_link.id,
    'checkout_url', 'https://showlink.my.id/p/' || v_link.slug
  );
END;
$$;

-- ============================================================
-- GRANT ACCESS AFTER PAYMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_payment_access(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_link public.payment_links%ROWTYPE;
  v_access uuid;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND status IN ('paid','completed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_PAID';
  END IF;

  SELECT * INTO v_link
  FROM public.payment_links
  WHERE id = v_order.payment_link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_LINK_NOT_FOUND';
  END IF;

  IF v_order.buyer_id IS NOT NULL THEN
    INSERT INTO public.content_access (
      buyer_id, guest_access_token, payment_link_id,
      pastelink_id, order_id, access_type
    )
    VALUES (
      v_order.buyer_id, v_order.guest_access_token, v_link.id,
      v_link.pastelink_id, v_order.id, 'paid'
    )
    ON CONFLICT (buyer_id, payment_link_id)
    DO UPDATE SET
      granted_at = now(),
      order_id = excluded.order_id,
      pastelink_id = excluded.pastelink_id
    RETURNING id INTO v_access;
  ELSE
    SELECT id INTO v_access
    FROM public.content_access
    WHERE guest_access_token = v_order.guest_access_token
      AND payment_link_id = v_link.id
    LIMIT 1;

    IF v_access IS NULL THEN
      INSERT INTO public.content_access (
        buyer_id, guest_access_token, payment_link_id,
        pastelink_id, order_id, access_type
      )
      VALUES (
        NULL, v_order.guest_access_token, v_link.id,
        v_link.pastelink_id, v_order.id, 'paid'
      )
      RETURNING id INTO v_access;
    ELSE
      UPDATE public.content_access
      SET granted_at = now(),
          order_id = v_order.id,
          pastelink_id = v_link.pastelink_id
      WHERE id = v_access;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'access_id', v_access,
    'order_id', v_order.id,
    'payment_link_id', v_link.id,
    'pastelink_id', v_link.pastelink_id,
    'unlocked', true
  );
END;
$$;

-- ============================================================
-- PUBLIC PAID CONTENT ACCESS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_paid_content(
  p_payment_link_slug text,
  p_guest_access_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_link public.payment_links%ROWTYPE;
  v_allowed boolean := false;
  v_content_html text := '';
  v_content_text text := '';
BEGIN
  SELECT * INTO v_link
  FROM public.payment_links
  WHERE slug = p_payment_link_slug
    AND status IN ('active','paused')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_LINK_NOT_FOUND';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.content_access a
      WHERE a.payment_link_id = v_link.id
        AND a.buyer_id = auth.uid()
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed AND coalesce(p_guest_access_token,'') <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.content_access a
      WHERE a.payment_link_id = v_link.id
        AND a.guest_access_token = p_guest_access_token
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'unlocked', false,
      'requires_payment', true,
      'id', v_link.id,
      'slug', v_link.slug,
      'title', v_link.title,
      'description', v_link.description,
      'thumbnail_url', v_link.thumbnail_url,
      'price', v_link.price,
      'currency', v_link.currency,
      'checkout_url', 'https://showlink.my.id/p/' || v_link.slug
    );
  END IF;

  IF v_link.pastelink_id IS NOT NULL THEN
    SELECT p.content_html, p.content_text
    INTO v_content_html, v_content_text
    FROM public.pastelinks p
    WHERE p.id = v_link.pastelink_id;
  ELSE
    v_content_html := v_link.content_html;
    v_content_text := v_link.content_text;
  END IF;

  RETURN jsonb_build_object(
    'unlocked', true,
    'requires_payment', true,
    'id', v_link.id,
    'slug', v_link.slug,
    'title', v_link.title,
    'description', v_link.description,
    'content_html', coalesce(v_content_html,''),
    'content_text', coalesce(v_content_text,''),
    'price', v_link.price,
    'currency', v_link.currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_paid_content(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paid_content(text, text) TO anon, authenticated;

-- ============================================================
-- INTERNAL PAYMENT SETTLEMENT
-- Called only by trusted payment webhook/admin backend.
-- ============================================================

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
  v_cfg public.platform_finance_config%ROWTYPE;
  v_fee numeric(18,2);
  v_seller numeric(18,2);
  v_platform numeric(18,2);
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.status IN ('paid','completed') THEN
    RETURN jsonb_build_object('ok', true, 'already_settled', true, 'order_id', v_order.id);
  END IF;

  SELECT * INTO v_cfg
  FROM public.platform_finance_config
  WHERE id = 1;

  v_fee := 0;
  v_seller := round((v_order.amount - v_fee) * v_cfg.seller_share_percent / 100, 2);
  v_platform := round((v_order.amount - v_fee) * v_cfg.platform_share_percent / 100, 2);

  UPDATE public.orders
  SET status = 'paid',
      paid_at = now(),
      updated_at = now(),
      payment_reference = coalesce(payment_reference, p_provider_payment_id),
      provider = coalesce(p_provider, provider),
      gateway_payload = coalesce(p_provider_payload, '{}'::jsonb)
  WHERE id = v_order.id;

  INSERT INTO public.order_settlements (
    order_id, seller_id, gross_amount, payment_fee,
    seller_amount, platform_amount, status, available_at, released_at
  )
  VALUES (
    v_order.id, v_order.seller_id, v_order.amount, v_fee,
    v_seller, v_platform, 'released', now(), now()
  )
  ON CONFLICT (order_id) DO UPDATE
  SET seller_amount = excluded.seller_amount,
      platform_amount = excluded.platform_amount,
      status = 'released',
      released_at = now(),
      updated_at = now();

  INSERT INTO public.platform_earnings (
    order_id, amount, source, description
  )
  VALUES (
    v_order.id, v_platform, 'payment_link', 'Platform settlement'
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
      user_id, type, direction, amount,
      balance_before, balance_after, order_id, description
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
    'settled', true
  );
END;
$$;

-- ============================================================
-- VIEW COUNTERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_pastelink_view(
  p_pastelink_id uuid,
  p_visitor_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pastelinks
  SET views = views + 1,
      unique_views = unique_views +
        CASE
          WHEN p_visitor_hash IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.link_views
            WHERE pastelink_id = p_pastelink_id
              AND visitor_hash = p_visitor_hash
          ) THEN 1
          ELSE 0
        END,
      updated_at = now()
  WHERE id = p_pastelink_id;

  INSERT INTO public.link_views (
    user_id, pastelink_id, visitor_hash
  )
  VALUES (auth.uid(), p_pastelink_id, p_visitor_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_link_view(
  p_payment_link_id uuid,
  p_visitor_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_links
  SET views = views + 1,
      unique_views = unique_views +
        CASE
          WHEN p_visitor_hash IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.link_views
            WHERE payment_link_id = p_payment_link_id
              AND visitor_hash = p_visitor_hash
          ) THEN 1
          ELSE 0
        END,
      updated_at = now()
  WHERE id = p_payment_link_id;

  INSERT INTO public.link_views (
    user_id, payment_link_id, visitor_hash
  )
  VALUES (auth.uid(), p_payment_link_id, p_visitor_hash);
END;
$$;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_finance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastelinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastelink_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastelink_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Drop known policies to keep reruns clean.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','site_settings','payment_settings','platform_finance_config',
        'pastelinks','pastelink_drafts','pastelink_steps','payment_links',
        'content_access','guest_buyers','orders','payments','order_settlements',
        'platform_earnings','wallets','wallet_transactions','withdrawal_methods',
        'withdrawals','link_views','analytics_events','content_comments',
        'content_likes','creator_followers','notifications','admin_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Profiles: public-safe fields are readable; private fields are not returned
-- by public RPCs. Owner can manage own profile.
CREATE POLICY profiles_select_own
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY profiles_update_own
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY profiles_insert_own
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Pastelinks
CREATE POLICY pastelinks_owner_all
ON public.pastelinks FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_current_user_admin());

-- Drafts and steps
CREATE POLICY pastelink_drafts_owner_all
ON public.pastelink_drafts FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY pastelink_steps_owner_all
ON public.pastelink_steps FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pastelink_drafts d
    WHERE d.id = draft_id
      AND (d.owner_id = auth.uid() OR public.is_current_user_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pastelink_drafts d
    WHERE d.id = draft_id
      AND (d.owner_id = auth.uid() OR public.is_current_user_admin())
  )
);

-- Payment links: only public checkout metadata is intended to be read.
-- Content is returned by RPC only after access.
CREATE POLICY payment_links_owner_all
ON public.payment_links FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_current_user_admin());

-- Access
CREATE POLICY content_access_owner_read
ON public.content_access FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR public.is_current_user_admin());

-- Orders
CREATE POLICY orders_buyer_read
ON public.orders FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_current_user_admin());

-- Payments
CREATE POLICY payments_owner_read
ON public.payments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.is_current_user_admin())
  )
);

-- Private finance tables: no direct browser access.
-- Admin/backend should use SECURITY DEFINER functions.
CREATE POLICY platform_finance_admin_only
ON public.platform_finance_config FOR ALL TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY order_settlements_admin_only
ON public.order_settlements FOR SELECT TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY platform_earnings_admin_only
ON public.platform_earnings FOR SELECT TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY wallets_owner_read
ON public.wallets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY wallet_transactions_owner_read
ON public.wallet_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY withdrawal_methods_owner_all
ON public.withdrawal_methods FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (user_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY withdrawals_owner_read
ON public.withdrawals FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin());

-- Analytics: owner/admin only for raw event data.
CREATE POLICY analytics_owner_read
ON public.analytics_events FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY link_views_owner_read
ON public.link_views FOR SELECT TO authenticated
USING (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.pastelinks p
    WHERE p.id = pastelink_id AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.payment_links p
    WHERE p.id = payment_link_id AND p.owner_id = auth.uid()
  )
);

-- Comments
CREATE POLICY comments_public_read
ON public.content_comments FOR SELECT TO anon, authenticated
USING (is_deleted = false);

CREATE POLICY comments_authenticated_insert
ON public.content_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY comments_owner_update
ON public.content_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (user_id = auth.uid() OR public.is_current_user_admin());

-- Likes/follows
CREATE POLICY likes_public_read
ON public.content_likes FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY likes_owner_write
ON public.content_likes FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY followers_public_read
ON public.creator_followers FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY followers_owner_write
ON public.creator_followers FOR ALL TO authenticated
USING (follower_id = auth.uid())
WITH CHECK (follower_id = auth.uid());

-- Notifications
CREATE POLICY notifications_owner_all
ON public.notifications FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (user_id = auth.uid() OR public.is_current_user_admin());

-- Site/payment public settings
CREATE POLICY site_settings_public_read
ON public.site_settings FOR SELECT TO anon, authenticated
USING (is_public = true);

CREATE POLICY site_settings_admin_write
ON public.site_settings FOR ALL TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY payment_settings_admin_only
ON public.payment_settings FOR ALL TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY admin_logs_admin_only
ON public.admin_logs FOR ALL TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- ============================================================
-- PUBLIC PROFILE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_profile(p_username text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'country', p.country
  )
  FROM public.profiles p
  WHERE lower(p.username) = lower(p_username)
    AND p.is_banned = false
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.pastelinks TO authenticated;
GRANT SELECT ON public.payment_links TO authenticated;
GRANT SELECT ON public.content_comments TO anon, authenticated;
GRANT SELECT ON public.content_likes TO anon, authenticated;
GRANT SELECT ON public.creator_followers TO anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.profiles,
   public.pastelinks,
   public.pastelink_drafts,
   public.pastelink_steps,
   public.payment_links,
   public.content_access,
   public.orders,
   public.payments,
   public.wallets,
   public.wallet_transactions,
   public.withdrawal_methods,
   public.withdrawals,
   public.analytics_events,
   public.content_comments,
   public.content_likes,
   public.creator_followers,
   public.notifications
TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pastelink_draft() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_pastelink_step(uuid,text,text,text,text,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_pastelink_draft(uuid,text,text,text,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pastelink(text,text,text,text,text,text[],text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_link(text,text,numeric,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pastelink_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_link_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_paid_content(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pastelink_view(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_link_view(uuid,text) TO anon, authenticated;

-- Trusted/backend settlement function.
REVOKE ALL ON FUNCTION public.settle_paid_order(uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_paid_order(uuid,text,text,jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.grant_payment_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_payment_access(uuid) TO service_role;

-- ============================================================
-- PUBLIC ACCESS CONTRACT
-- Public content is exposed through:
--   get_pastelink_by_slug()
--   get_payment_link_by_slug()
--   get_paid_content()
-- Direct table reads are intentionally restricted by RLS.
-- ============================================================

-- ============================================================
-- DEFAULT SITE CONFIG
-- ============================================================

INSERT INTO public.site_settings (key, value, is_public)
VALUES
  ('brand', '{"name":"ShowLink","domain":"showlink.my.id","tagline":"Create. Share. Get Paid."}', true),
  ('link_formats', '{"pastelink":"/p/{slug}","payment":"/p/{slug}"}', true),
  ('features', '{"pastelink":true,"payment_link":true,"code":false,"telegram":false}', true)
ON CONFLICT (key) DO UPDATE
SET value = excluded.value,
    is_public = excluded.is_public,
    updated_at = now();


-- ============================================================
-- END SHOWLINK MASTER DATABASE CORE
-- Payment Link pricing continues in this same transaction.
-- ============================================================

-- ============================================================
-- SHOWLINK PAYMENT LINK PRICING — FINAL / MASTER-COMPATIBLE / FINAL
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

-- ------------------------------------------------------------
-- 0. Canonical schema sanity check
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.payment_links') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.platform_finance_config') IS NULL THEN
    RAISE EXCEPTION 'SHOWLINK_PAYMENT_LINK_FINAL: canonical Master tables are missing';
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

  -- Never trust a caller-supplied buyer UUID.
  -- Logged-in buyers are priced from auth.uid(); anonymous buyers are guests.
  IF auth.uid() IS NOT NULL THEN
    SELECT lower(coalesce(plan, 'free'))
      INTO v_plan
    FROM public.profiles
    WHERE id = auth.uid();

    v_plan := coalesce(v_plan, 'free');

    IF v_plan NOT IN ('free','vip','premium') THEN
      v_plan := 'free';
    END IF;
  ELSE
    v_plan := 'guest';
  END IF;

  SELECT
    CASE v_plan
      WHEN 'vip' THEN vip_percent
      WHEN 'premium' THEN premium_percent
      WHEN 'free' THEN free_percent
      ELSE guest_percent
    END,
    cfg.platform_fee_percent
  INTO v_percent, v_platform_percent
  FROM public.payment_link_pricing_config AS cfg
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
  -- Serialize settlement attempts for the same order. This makes webhook
  -- retries/concurrent status checks idempotent without relying on a unique
  -- index that could fail on historical duplicate financial rows.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('showlink-payment-link-settlement:' || p_order_id::text, 0)
  );

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
  SELECT v_order.id, v_platform, 'payment_link', 'Payment Link platform fee 20%'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_earnings
    WHERE order_id = v_order.id
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

COMMIT;
