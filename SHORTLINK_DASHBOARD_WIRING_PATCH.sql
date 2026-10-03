-- SHOWLINK SHORTLINK DASHBOARD WIRING
-- Run this AFTER SHORTLINK_FINAL_ANALYTICS_CPM.sql.
-- This patch is idempotent and ensures the dashboard can read Final stats.

BEGIN;

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (key,value,is_public)
VALUES ('shortlink_cpm', jsonb_build_object('value',125), true)
ON CONFLICT (key) DO NOTHING;

-- Keep the dashboard view owner-scoped through security_invoker + RLS.
ALTER VIEW public.showlink_shortlink_final_dashboard
SET (security_invoker = true);

GRANT SELECT ON public.showlink_shortlink_final_dashboard TO authenticated;

COMMIT;
