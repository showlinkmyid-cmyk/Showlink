-- SHOWLINK FINAL SHORTLINK ANALYTICS + CPM
-- Run after SHORTLINK_FINAL_FLOW.sql.
-- Uses the existing analytics_events table when available, while keeping
-- a dedicated aggregate table for the ShowLink Dashboard.

BEGIN;

CREATE TABLE IF NOT EXISTS public.showlink_shortlink_final_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlink_id uuid NOT NULL REFERENCES public.showlink_shortlinks(id) ON DELETE CASCADE,
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  ad_clicks bigint NOT NULL DEFAULT 0 CHECK (ad_clicks >= 0),
  original_clicks bigint NOT NULL DEFAULT 0 CHECK (original_clicks >= 0),
  telegram_clicks bigint NOT NULL DEFAULT 0 CHECK (telegram_clicks >= 0),
  cpm numeric(18,4) NOT NULL DEFAULT 0 CHECK (cpm >= 0),
  estimated_revenue numeric(18,4) NOT NULL DEFAULT 0 CHECK (estimated_revenue >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shortlink_id)
);

CREATE INDEX IF NOT EXISTS showlink_shortlink_final_stats_shortlink_idx
ON public.showlink_shortlink_final_stats(shortlink_id);

CREATE OR REPLACE FUNCTION public.track_shortlink_final_event(
  p_slug text,
  p_event_name text,
  p_ad_slot text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.showlink_shortlinks%ROWTYPE;
  v_cpm numeric(18,4) := 0;
  v_views bigint := 0;
  v_revenue numeric(18,4) := 0;
BEGIN
  SELECT * INTO r
  FROM public.showlink_shortlinks
  WHERE slug=p_slug AND status='active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','shortlink_not_found');
  END IF;

  -- CPM is configurable. Set public.site_settings key "shortlink_cpm"
  -- to {"value":1000} (example) when you want an estimated CPM.
  SELECT COALESCE((value->>'value')::numeric,0)
    INTO v_cpm
  FROM public.site_settings
  WHERE key='shortlink_cpm' AND is_public=true
  LIMIT 1;

  INSERT INTO public.showlink_shortlink_final_stats(shortlink_id,cpm)
  VALUES(r.id,v_cpm)
  ON CONFLICT(shortlink_id) DO UPDATE
    SET cpm=v_cpm,updated_at=now();

  IF p_event_name='page_view' THEN
    UPDATE public.showlink_shortlink_final_stats
    SET views=views+1, updated_at=now()
    WHERE shortlink_id=r.id;
  ELSIF p_event_name='ad_click' THEN
    UPDATE public.showlink_shortlink_final_stats
    SET ad_clicks=ad_clicks+1, updated_at=now()
    WHERE shortlink_id=r.id;
  ELSIF p_event_name='original_click' THEN
    UPDATE public.showlink_shortlink_final_stats
    SET original_clicks=original_clicks+1, updated_at=now()
    WHERE shortlink_id=r.id;
  ELSIF p_event_name='telegram_join_click' THEN
    UPDATE public.showlink_shortlink_final_stats
    SET telegram_clicks=telegram_clicks+1, updated_at=now()
    WHERE shortlink_id=r.id;
  END IF;

  UPDATE public.showlink_shortlink_final_stats
  SET estimated_revenue=(views*cpm)/1000, updated_at=now()
  WHERE shortlink_id=r.id;

  -- Also record the event in the existing analytics stream when present.
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    INSERT INTO public.analytics_events(event_name,metadata)
    VALUES(
      p_event_name,
      jsonb_build_object('source','shortlink_final','slug',p_slug,'ad_slot',p_ad_slot)
    );
  END IF;

  SELECT views,estimated_revenue INTO v_views,v_revenue
  FROM public.showlink_shortlink_final_stats
  WHERE shortlink_id=r.id;

  RETURN jsonb_build_object(
    'ok',true,'views',v_views,'cpm',v_cpm,'estimated_revenue',v_revenue
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shortlink_final_stats(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
  r public.showlink_shortlink_final_stats%ROWTYPE;
BEGIN
  SELECT id INTO sid FROM public.showlink_shortlinks
  WHERE slug=p_slug AND status='active' LIMIT 1;
  IF sid IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','shortlink_not_found');
  END IF;

  SELECT * INTO r FROM public.showlink_shortlink_final_stats WHERE shortlink_id=sid;
  RETURN jsonb_build_object(
    'ok',true,
    'views',COALESCE(r.views,0),
    'ad_clicks',COALESCE(r.ad_clicks,0),
    'original_clicks',COALESCE(r.original_clicks,0),
    'telegram_clicks',COALESCE(r.telegram_clicks,0),
    'cpm',COALESCE(r.cpm,0),
    'estimated_revenue',COALESCE(r.estimated_revenue,0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_shortlink_final_event(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shortlink_final_stats(text) TO anon, authenticated;

-- Dashboard-friendly aggregate view.
CREATE OR REPLACE VIEW public.showlink_shortlink_final_dashboard AS
SELECT
  s.id AS shortlink_id,
  s.owner_id,
  s.slug,
  s.title,
  s.status,
  COALESCE(a.views,0) AS views,
  COALESCE(a.ad_clicks,0) AS ad_clicks,
  COALESCE(a.original_clicks,0) AS original_clicks,
  COALESCE(a.telegram_clicks,0) AS telegram_clicks,
  COALESCE(a.cpm,0) AS cpm,
  COALESCE(a.estimated_revenue,0) AS estimated_revenue,
  s.created_at,
  s.updated_at
FROM public.showlink_shortlinks s
LEFT JOIN public.showlink_shortlink_final_stats a ON a.shortlink_id=s.id;

COMMIT;
