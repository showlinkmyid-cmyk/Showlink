
-- SHOWLINK SHORTLINK FINAL FLOW
-- FREE: Task1 -> Task2 -> Task3 -> FINAL -> content
-- VIP:  Task1 -> Task2 -> FINAL -> content
-- PREMIUM: Task1 -> FINAL -> content
-- Paid path: Shortlink -> Payment Link -> paid -> content

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_plan_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_check
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

ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS content_text text NOT NULL DEFAULT '';
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS destination_url text NOT NULL DEFAULT '';
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS tasks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL;
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS views bigint NOT NULL DEFAULT 0;
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.showlink_shortlinks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS showlink_shortlinks_owner_idx
 ON public.showlink_shortlinks(owner_id);
CREATE INDEX IF NOT EXISTS showlink_shortlinks_status_idx
 ON public.showlink_shortlinks(status);
CREATE INDEX IF NOT EXISTS showlink_shortlinks_payment_idx
 ON public.showlink_shortlinks(payment_link_id);

CREATE OR REPLACE FUNCTION public.get_public_shortlink(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.showlink_shortlinks%ROWTYPE;
  payment_url text := NULL;
BEGIN
  SELECT * INTO r
  FROM public.showlink_shortlinks
  WHERE slug = p_slug
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','Shortlink tidak ditemukan atau sudah tidak aktif.');
  END IF;

  IF r.payment_link_id IS NOT NULL THEN
    SELECT '/p/' || slug INTO payment_url
    FROM public.payment_links
    WHERE id = r.payment_link_id
      AND status = 'active';
  END IF;

  UPDATE public.showlink_shortlinks
  SET views = views + 1, updated_at = now()
  WHERE id = r.id;

  RETURN jsonb_build_object(
    'ok',true,
    'id',r.id,
    'slug',r.slug,
    'title',r.title,
    'description',r.description,
    'content_text',r.content_text,
    'destination_url',r.destination_url,
    'tasks',COALESCE(r.tasks,'[]'::jsonb),
    'payment_url',payment_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_shortlink(text) TO anon, authenticated;

-- Keep public read through the RPC only.
ALTER TABLE public.showlink_shortlinks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS showlink_shortlinks_owner_select ON public.showlink_shortlinks;
DROP POLICY IF EXISTS showlink_shortlinks_owner_insert ON public.showlink_shortlinks;
DROP POLICY IF EXISTS showlink_shortlinks_owner_update ON public.showlink_shortlinks;
DROP POLICY IF EXISTS showlink_shortlinks_owner_delete ON public.showlink_shortlinks;

CREATE POLICY showlink_shortlinks_owner_select
ON public.showlink_shortlinks FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY showlink_shortlinks_owner_insert
ON public.showlink_shortlinks FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY showlink_shortlinks_owner_update
ON public.showlink_shortlinks FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY showlink_shortlinks_owner_delete
ON public.showlink_shortlinks FOR DELETE TO authenticated
USING (owner_id = auth.uid());

COMMIT;
