-- ShowLink: Payment Link hanya untuk VIP & Premium
-- Jalankan setelah schema profiles/payment_links tersedia.
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT lower(coalesce(plan,'free')) INTO v_plan
  FROM public.profiles WHERE id=auth.uid();

  IF coalesce(v_plan,'free') NOT IN ('vip','premium') THEN
    RAISE EXCEPTION 'PLAN_REQUIRED: Payment Link hanya tersedia untuk akun VIP dan Premium';
  END IF;

  IF p_price IS NULL OR p_price < 2000 OR p_price > 100000 THEN
    RAISE EXCEPTION 'INVALID_PRICE: Payment Link price must be between Rp2,000 and Rp100,000';
  END IF;

  IF p_pastelink_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pastelinks
    WHERE id=p_pastelink_id AND owner_id=auth.uid() AND status='published'
  ) THEN RAISE EXCEPTION 'PASTELINK_NOT_OWNED'; END IF;

  v_slug := public.showlink_random_slug(4);

  INSERT INTO public.payment_links (
    owner_id,slug,title,description,price,pastelink_id,
    content_html,content_text,thumbnail_url,status,published_at
  ) VALUES (
    auth.uid(),v_slug,trim(p_title),coalesce(p_description,''),
    p_price,p_pastelink_id,coalesce(p_content_html,''),
    coalesce(p_content_text,''),p_thumbnail_url,'active',now()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',v_id,'slug',v_slug,
    'url','https://showlink.my.id/p/'||v_slug,
    'checkout_url','https://showlink.my.id/p/'||v_slug
  );
END;
$$;
