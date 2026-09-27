-- ShowLink public URL flow
-- Adds the public-read contracts used by /s/, /p/ and /u/.
-- Does NOT implement or fake a Cashi API. Cashi remains a server-side adapter.

ALTER TABLE IF EXISTS public.showlink_shortlinks
  ADD COLUMN IF NOT EXISTS tasks jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.showlink_sub4unlock_links
  ADD COLUMN IF NOT EXISTS tasks jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.get_public_shortlink(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v record;
BEGIN
  SELECT id,title,slug,status,tasks,destination_url
  INTO v
  FROM public.showlink_shortlinks
  WHERE slug = trim(p_slug) AND status = 'active'
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  RETURN jsonb_build_object('ok',true,'id',v.id,'title',v.title,'slug',v.slug,'tasks',coalesce(v.tasks,'[]'::jsonb),'destination_url',v.destination_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_sub4unlock(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v record;
BEGIN
  SELECT id,title,slug,status,tasks,destination_url
  INTO v
  FROM public.showlink_sub4unlock_links
  WHERE slug = trim(p_slug) AND status = 'active'
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  RETURN jsonb_build_object('ok',true,'id',v.id,'title',v.title,'slug',v.slug,'tasks',coalesce(v.tasks,'[]'::jsonb),'destination_url',v.destination_url);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_shortlink(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_sub4unlock(text) TO anon, authenticated;

-- Payment Link already has the canonical public RPCs:
-- get_payment_link_by_slug(text)
-- create_checkout_order(uuid,text)
-- get_paid_content(text,text)
-- Do not expose order settlement/payment secrets to the browser.
