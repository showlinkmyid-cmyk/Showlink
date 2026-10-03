-- SHOWLINK SHORTLINK — CANONICAL FINAL FLOW + ANALYTICS + CPM
-- Run AFTER SHOWLINK_PAYMENT_LINK_CASHI_FINAL_FIXED.sql
-- FREE: Public -> Task1 -> Task2 -> Task3 -> FINAL -> Result
-- VIP: Public -> Task1 -> Task2 -> FINAL -> Result
-- PREMIUM: Public -> Task1 -> FINAL -> Result
-- Old SHORTLINK_FINAL_FLOW / SHORTLINK_FINAL_ANALYTICS_CPM /
-- SHORTLINK_DASHBOARD_WIRING_PATCH are consolidated here.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_plan_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
      CHECK (plan IN ('free','vip','premium'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.showlink_shortlinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content_text text NOT NULL DEFAULT '',
  destination_url text NOT NULL DEFAULT '',
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','paused','expired','deleted')),
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.showlink_shortlinks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS showlink_shortlinks_owner_idx ON public.showlink_shortlinks(owner_id);
CREATE INDEX IF NOT EXISTS showlink_shortlinks_status_idx ON public.showlink_shortlinks(status);
CREATE INDEX IF NOT EXISTS showlink_shortlinks_payment_idx ON public.showlink_shortlinks(payment_link_id);

DROP POLICY IF EXISTS showlink_shortlinks_owner_select ON public.showlink_shortlinks;
DROP POLICY IF EXISTS showlink_shortlinks_owner_insert ON public.showlink_shortlinks;
DROP POLICY IF EXISTS showlink_shortlinks_owner_update ON public.showlink_shortlinks;
DROP POLICY IF EXISTS showlink_shortlinks_owner_delete ON public.showlink_shortlinks;

CREATE POLICY showlink_shortlinks_owner_select ON public.showlink_shortlinks
  FOR SELECT TO authenticated USING (owner_id=auth.uid());
CREATE POLICY showlink_shortlinks_owner_insert ON public.showlink_shortlinks
  FOR INSERT TO authenticated WITH CHECK (owner_id=auth.uid());
CREATE POLICY showlink_shortlinks_owner_update ON public.showlink_shortlinks
  FOR UPDATE TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY showlink_shortlinks_owner_delete ON public.showlink_shortlinks
  FOR DELETE TO authenticated USING (owner_id=auth.uid());

-- Public metadata ONLY. Raw content is deliberately excluded.
CREATE OR REPLACE FUNCTION public.get_public_shortlink(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.showlink_shortlinks%ROWTYPE; payment_url text:=NULL;
BEGIN
  SELECT * INTO r FROM public.showlink_shortlinks
  WHERE slug=trim(p_slug) AND status='active' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Shortlink tidak ditemukan atau sudah tidak aktif.'); END IF;

  IF r.payment_link_id IS NOT NULL THEN
    SELECT '/p/'||pl.slug INTO payment_url FROM public.payment_links pl
    WHERE pl.id=r.payment_link_id AND pl.status='active' LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok',true,'id',r.id,'slug',r.slug,'title',r.title,
    'description',r.description,'tasks',COALESCE(r.tasks,'[]'::jsonb),
    'payment_url',payment_url
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_shortlink(text) TO anon,authenticated;

-- Called only by the unlocked result state. Keeps raw content out of public metadata.
CREATE OR REPLACE FUNCTION public.get_public_shortlink_content(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.showlink_shortlinks%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.showlink_shortlinks
  WHERE slug=trim(p_slug) AND status='active' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Shortlink tidak ditemukan atau sudah tidak aktif.'); END IF;
  RETURN jsonb_build_object(
    'ok',true,'id',r.id,'slug',r.slug,'title',r.title,
    'description',r.description,'content_text',r.content_text
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_shortlink_content(text) TO anon,authenticated;

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_settings(key,value,is_public)
VALUES('shortlink_cpm',jsonb_build_object('value',125),true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.showlink_shortlink_final_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlink_id uuid NOT NULL REFERENCES public.showlink_shortlinks(id) ON DELETE CASCADE,
  views bigint NOT NULL DEFAULT 0 CHECK (views>=0),
  ad_clicks bigint NOT NULL DEFAULT 0 CHECK (ad_clicks>=0),
  original_clicks bigint NOT NULL DEFAULT 0 CHECK (original_clicks>=0),
  telegram_clicks bigint NOT NULL DEFAULT 0 CHECK (telegram_clicks>=0),
  cpm numeric(18,4) NOT NULL DEFAULT 0 CHECK (cpm>=0),
  estimated_revenue numeric(18,4) NOT NULL DEFAULT 0 CHECK (estimated_revenue>=0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shortlink_id)
);
CREATE INDEX IF NOT EXISTS showlink_shortlink_final_stats_shortlink_idx
  ON public.showlink_shortlink_final_stats(shortlink_id);

CREATE OR REPLACE FUNCTION public.track_shortlink_final_event(
  p_slug text,p_event_name text,p_ad_slot text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.showlink_shortlinks%ROWTYPE; v_cpm numeric(18,4):=0;
v_views bigint:=0; v_revenue numeric(18,4):=0;
BEGIN
  SELECT * INTO r FROM public.showlink_shortlinks
  WHERE slug=trim(p_slug) AND status='active' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','shortlink_not_found'); END IF;

  SELECT COALESCE((value->>'value')::numeric,0) INTO v_cpm
  FROM public.site_settings WHERE key='shortlink_cpm' AND is_public=true LIMIT 1;

  INSERT INTO public.showlink_shortlink_final_stats(shortlink_id,cpm)
  VALUES(r.id,v_cpm)
  ON CONFLICT(shortlink_id) DO UPDATE SET cpm=EXCLUDED.cpm,updated_at=now();

  IF p_event_name='page_view' THEN
    UPDATE public.showlink_shortlink_final_stats SET views=views+1,updated_at=now() WHERE shortlink_id=r.id;
  ELSIF p_event_name='ad_click' THEN
    UPDATE public.showlink_shortlink_final_stats SET ad_clicks=ad_clicks+1,updated_at=now() WHERE shortlink_id=r.id;
  ELSIF p_event_name='original_click' THEN
    UPDATE public.showlink_shortlink_final_stats SET original_clicks=original_clicks+1,updated_at=now() WHERE shortlink_id=r.id;
  ELSIF p_event_name='telegram_join_click' THEN
    UPDATE public.showlink_shortlink_final_stats SET telegram_clicks=telegram_clicks+1,updated_at=now() WHERE shortlink_id=r.id;
  END IF;

  UPDATE public.showlink_shortlink_final_stats
  SET estimated_revenue=(views*cpm)/1000,updated_at=now() WHERE shortlink_id=r.id;

  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    INSERT INTO public.analytics_events(event_name,metadata)
    VALUES(p_event_name,jsonb_build_object('source','shortlink_final','slug',trim(p_slug),'ad_slot',p_ad_slot));
  END IF;

  SELECT views,estimated_revenue INTO v_views,v_revenue
  FROM public.showlink_shortlink_final_stats WHERE shortlink_id=r.id;

  RETURN jsonb_build_object('ok',true,'views',v_views,'cpm',v_cpm,'estimated_revenue',v_revenue);
END; $$;

GRANT EXECUTE ON FUNCTION public.track_shortlink_final_event(text,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_shortlink_final_stats(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; r public.showlink_shortlink_final_stats%ROWTYPE;
BEGIN
  SELECT id INTO sid FROM public.showlink_shortlinks WHERE slug=trim(p_slug) AND status='active' LIMIT 1;
  IF sid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','shortlink_not_found'); END IF;
  SELECT * INTO r FROM public.showlink_shortlink_final_stats WHERE shortlink_id=sid;
  RETURN jsonb_build_object('ok',true,'views',COALESCE(r.views,0),'ad_clicks',COALESCE(r.ad_clicks,0),
    'original_clicks',COALESCE(r.original_clicks,0),'telegram_clicks',COALESCE(r.telegram_clicks,0),
    'cpm',COALESCE(r.cpm,0),'estimated_revenue',COALESCE(r.estimated_revenue,0));
END; $$;

GRANT EXECUTE ON FUNCTION public.get_shortlink_final_stats(text) TO anon,authenticated;

CREATE OR REPLACE VIEW public.showlink_shortlink_final_dashboard AS
SELECT s.id shortlink_id,s.owner_id,s.slug,s.title,s.status,
  COALESCE(a.views,0) views,COALESCE(a.ad_clicks,0) ad_clicks,
  COALESCE(a.original_clicks,0) original_clicks,COALESCE(a.telegram_clicks,0) telegram_clicks,
  COALESCE(a.cpm,0) cpm,COALESCE(a.estimated_revenue,0) estimated_revenue,
  s.created_at,s.updated_at
FROM public.showlink_shortlinks s
LEFT JOIN public.showlink_shortlink_final_stats a ON a.shortlink_id=s.id;

ALTER VIEW public.showlink_shortlink_final_dashboard SET (security_invoker=true);
GRANT SELECT ON public.showlink_shortlink_final_dashboard TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shortlink_cpm_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cpm numeric(18,4):=125;
BEGIN
  IF NOT public.is_current_user_admin() THEN RETURN jsonb_build_object('ok',false,'error','admin_required'); END IF;
  SELECT COALESCE((value->>'value')::numeric,125) INTO v_cpm
  FROM public.site_settings WHERE key='shortlink_cpm' LIMIT 1;
  RETURN jsonb_build_object('ok',true,'cpm',v_cpm);
END; $$;

CREATE OR REPLACE FUNCTION public.set_shortlink_cpm_admin(p_cpm numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cpm numeric(18,4);
BEGIN
  IF NOT public.is_current_user_admin() THEN RETURN jsonb_build_object('ok',false,'error','admin_required'); END IF;
  IF p_cpm IS NULL OR p_cpm<0 OR p_cpm>1000000 THEN RETURN jsonb_build_object('ok',false,'error','invalid_cpm'); END IF;
  v_cpm:=round(p_cpm,4);
  INSERT INTO public.site_settings(key,value,is_public,updated_at)
  VALUES('shortlink_cpm',jsonb_build_object('value',v_cpm),true,now())
  ON CONFLICT(key) DO UPDATE SET value=jsonb_build_object('value',v_cpm),is_public=true,updated_at=now();
  UPDATE public.showlink_shortlink_final_stats
  SET cpm=v_cpm,estimated_revenue=(views*v_cpm)/1000,updated_at=now();
  RETURN jsonb_build_object('ok',true,'cpm',v_cpm);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_shortlink_cpm_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_shortlink_cpm_admin(numeric) TO authenticated;

COMMIT;
