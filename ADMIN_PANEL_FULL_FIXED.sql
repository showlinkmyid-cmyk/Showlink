-- SHOWLINK ADMIN PANEL — FULL CONTROL
-- Run AFTER SHOWLINK_PAYMENT_LINK_CASHI_FINAL_FIXED.sql and SHORTLINK_FINAL_COMPLETE.sql
-- No service_role key is exposed to the browser.
-- Bootstrap admin email: saputrarmx190301@gmail.com

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings(key,value,is_public)
VALUES
 ('withdraw_manual_enabled','{"enabled":true}'::jsonb,false),
 ('withdraw_instant_enabled','{"enabled":true}'::jsonb,false),
 ('platform_maintenance','{"enabled":false,"message":"ShowLink sedang dalam maintenance."}'::jsonb,true),
 ('platform_theme','{"mode":"system","accent":"showlink"}'::jsonb,true)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id=auth.uid()
      AND is_banned=false
      AND (is_admin=true OR role='admin')
  )
  OR lower(coalesce((SELECT email FROM auth.users WHERE id=auth.uid()),'')) =
     'saputrarmx190301@gmail.com';
$$;

-- Bootstrap the requested Gmail account as an admin after it has authenticated.
CREATE OR REPLACE FUNCTION public.bootstrap_showlink_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE e text;
BEGIN
  SELECT lower(email) INTO e FROM auth.users WHERE id=auth.uid();
  IF e <> 'saputrarmx190301@gmail.com' THEN
    RAISE EXCEPTION 'ADMIN_EMAIL_NOT_ALLOWED';
  END IF;
  UPDATE public.profiles
    SET is_admin=true, role='admin', is_banned=false, updated_at=now()
  WHERE id=auth.uid();
  INSERT INTO public.admin_logs(admin_id,action,details)
  VALUES(auth.uid(),'bootstrap_admin',jsonb_build_object('email',e));
  RETURN jsonb_build_object('ok',true,'email',e);
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_showlink_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_guard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE total_users bigint; new_users bigint; active_users bigint; rare_users bigint; inactive_users bigint; banned_users bigint;
BEGIN
  PERFORM public.admin_guard();
  SELECT count(*) INTO total_users FROM public.profiles;
  SELECT count(*) INTO new_users FROM public.profiles WHERE created_at >= now()-interval '7 days';
  SELECT count(*) INTO banned_users FROM public.profiles WHERE is_banned;
  SELECT count(*) INTO active_users FROM auth.users u WHERE u.last_sign_in_at >= now()-interval '7 days';
  SELECT count(*) INTO rare_users FROM auth.users u WHERE u.last_sign_in_at < now()-interval '7 days' AND u.last_sign_in_at >= now()-interval '30 days';
  SELECT count(*) INTO inactive_users FROM auth.users u WHERE u.last_sign_in_at < now()-interval '30 days' OR u.last_sign_in_at IS NULL;
  RETURN jsonb_build_object('total_users',total_users,'new_users_7d',new_users,'active_users_7d',active_users,
    'rare_active_8_30d',rare_users,'inactive_30d_plus',inactive_users,'banned_users',banned_users,
    'total_balance',coalesce((SELECT sum(available_balance) FROM public.wallets),0),
    'pending_withdrawals',coalesce((SELECT count(*) FROM public.withdrawals WHERE status='pending'),0),
    'pending_withdrawal_amount',coalesce((SELECT sum(amount) FROM public.withdrawals WHERE status='pending'),0),
    'shortlinks',coalesce((SELECT count(*) FROM public.showlink_shortlinks WHERE status<>'deleted'),0),
    'pastelinks',coalesce((SELECT count(*) FROM public.pastelinks WHERE status<>'deleted'),0),
    'payment_links',coalesce((SELECT count(*) FROM public.payment_links WHERE status<>'deleted'),0));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_users(p_search text DEFAULT '', p_plan text DEFAULT 'all', p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.admin_guard();
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO result
  FROM (
    SELECT p.id,p.username,p.auth_email,p.display_name,p.plan,p.role,p.is_admin,p.is_banned,p.balance,p.pending_balance,
           p.total_earned,p.total_withdrawn,p.created_at,p.updated_at,u.last_sign_in_at,u.email
    FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id
    WHERE (coalesce(p_search,'')='' OR p.username ILIKE '%'||p_search||'%' OR coalesce(p.auth_email,u.email,'') ILIKE '%'||p_search||'%')
      AND (p_plan='all' OR p.plan=p_plan)
    ORDER BY p.created_at DESC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(0,p_offset)
  ) x;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_users(text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user(
  p_user_id uuid, p_plan text DEFAULT NULL, p_banned boolean DEFAULT NULL,
  p_balance numeric DEFAULT NULL, p_pending_balance numeric DEFAULT NULL, p_role text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.admin_guard();
  IF p_user_id=auth.uid() AND coalesce(p_banned,false)=true THEN RAISE EXCEPTION 'CANNOT_BAN_SELF'; END IF;
  IF p_plan IS NOT NULL AND p_plan NOT IN ('free','vip','premium') THEN RAISE EXCEPTION 'INVALID_PLAN'; END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('user','moderator','admin') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  UPDATE public.profiles SET
    plan=coalesce(p_plan,plan),
    is_banned=coalesce(p_banned,is_banned),
    balance=coalesce(p_balance,balance),
    pending_balance=coalesce(p_pending_balance,pending_balance),
    role=coalesce(p_role,role),
    is_admin=CASE WHEN p_role='admin' THEN true ELSE is_admin END,
    updated_at=now()
  WHERE id=p_user_id
  RETURNING to_jsonb(profiles) INTO v;
  IF p_balance IS NOT NULL OR p_pending_balance IS NOT NULL THEN
    INSERT INTO public.wallets(user_id,available_balance,pending_balance)
    VALUES(p_user_id,coalesce(p_balance,0),coalesce(p_pending_balance,0))
    ON CONFLICT(user_id) DO UPDATE SET
      available_balance=coalesce(p_balance,public.wallets.available_balance),
      pending_balance=coalesce(p_pending_balance,public.wallets.pending_balance),
      updated_at=now();
  END IF;
  IF v IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  INSERT INTO public.admin_logs(admin_id,action,target_type,target_id,details)
  VALUES(auth.uid(),'update_user','user',p_user_id,jsonb_build_object('plan',p_plan,'banned',p_banned,'balance',p_balance,'role',p_role));
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user(uuid,text,boolean,numeric,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user_profile(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'CANNOT_DELETE_SELF'; END IF;
  DELETE FROM public.profiles WHERE id=p_user_id;
  INSERT INTO public.admin_logs(admin_id,action,target_type,target_id)
  VALUES(auth.uid(),'delete_user_profile','user',p_user_id);
  RETURN jsonb_build_object('ok',true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_content(p_type text DEFAULT 'all', p_search text DEFAULT '', p_status text DEFAULT 'all', p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE out jsonb='[]'::jsonb;
BEGIN
  PERFORM public.admin_guard();
  IF p_type IN ('all','shortlink') THEN
    SELECT out || coalesce(jsonb_agg(jsonb_build_object('type','shortlink','id',s.id,'owner_id',s.owner_id,'slug',s.slug,'title',s.title,'description',s.description,'status',s.status,'views',s.views,'created_at',s.created_at,'updated_at',s.updated_at)),'[]'::jsonb) INTO out
    FROM public.showlink_shortlinks s WHERE (p_search='' OR s.slug ILIKE '%'||p_search||'%' OR s.title ILIKE '%'||p_search||'%') AND (p_status='all' OR s.status=p_status);
  END IF;
  IF p_type IN ('all','pastelink') THEN
    SELECT out || coalesce(jsonb_agg(jsonb_build_object('type','pastelink','id',p.id,'owner_id',p.owner_id,'slug',p.slug,'title',p.title,'description',p.description,'status',p.status,'views',p.views,'created_at',p.created_at,'updated_at',p.updated_at)),'[]'::jsonb) INTO out
    FROM public.pastelinks p WHERE (p_search='' OR p.slug ILIKE '%'||p_search||'%' OR p.title ILIKE '%'||p_search||'%') AND (p_status='all' OR p.status=p_status);
  END IF;
  IF p_type IN ('all','payment_link') THEN
    SELECT out || coalesce(jsonb_agg(jsonb_build_object('type','payment_link','id',p.id,'owner_id',p.owner_id,'slug',p.slug,'title',p.title,'description',p.description,'status',p.status,'price',p.price,'views',p.views,'sales_count',p.sales_count,'created_at',p.created_at,'updated_at',p.updated_at)),'[]'::jsonb) INTO out
    FROM public.payment_links p WHERE (p_search='' OR p.slug ILIKE '%'||p_search||'%' OR p.title ILIKE '%'||p_search||'%') AND (p_status='all' OR p.status=p_status);
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(q.x ORDER BY (q.x->>'created_at') DESC),'[]'::jsonb)
    FROM (
      SELECT x FROM jsonb_array_elements(out) x
      ORDER BY (x->>'created_at') DESC
      LIMIT greatest(1,least(p_limit,300))
    ) q
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_content(text,text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_edit_content(p_type text,p_id uuid,p_title text DEFAULT NULL,p_description text DEFAULT NULL,p_content_text text DEFAULT NULL,p_content_html text DEFAULT NULL,p_status text DEFAULT NULL,p_price numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_type='shortlink' THEN
    UPDATE public.showlink_shortlinks SET title=coalesce(p_title,title),description=coalesce(p_description,description),content_text=coalesce(p_content_text,content_text),status=coalesce(p_status,status),updated_at=now() WHERE id=p_id;
  ELSIF p_type='pastelink' THEN
    UPDATE public.pastelinks SET title=coalesce(p_title,title),description=coalesce(p_description,description),content_text=coalesce(p_content_text,content_text),content_html=coalesce(p_content_html,content_html),status=coalesce(p_status,status),updated_at=now() WHERE id=p_id;
  ELSIF p_type='payment_link' THEN
    UPDATE public.payment_links SET title=coalesce(p_title,title),description=coalesce(p_description,description),content_text=coalesce(p_content_text,content_text),content_html=coalesce(p_content_html,content_html),price=coalesce(p_price,price),status=coalesce(p_status,status),updated_at=now() WHERE id=p_id;
  ELSE RAISE EXCEPTION 'INVALID_CONTENT_TYPE'; END IF;
  INSERT INTO public.admin_logs(admin_id,action,target_type,target_id,details) VALUES(auth.uid(),'edit_content',p_type,p_id,jsonb_build_object('status',p_status));
  RETURN jsonb_build_object('ok',true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_edit_content(text,uuid,text,text,text,text,text,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_content(p_type text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_type='shortlink' THEN UPDATE public.showlink_shortlinks SET status='deleted',updated_at=now() WHERE id=p_id;
  ELSIF p_type='pastelink' THEN UPDATE public.pastelinks SET status='deleted',updated_at=now() WHERE id=p_id;
  ELSIF p_type='payment_link' THEN UPDATE public.payment_links SET status='deleted',updated_at=now() WHERE id=p_id;
  ELSE RAISE EXCEPTION 'INVALID_CONTENT_TYPE'; END IF;
  INSERT INTO public.admin_logs(admin_id,action,target_type,target_id) VALUES(auth.uid(),'delete_content',p_type,p_id);
  RETURN jsonb_build_object('ok',true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_content(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_withdrawals(p_status text DEFAULT 'all', p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
    SELECT w.*,p.username,p.auth_email,wm.method_type,wm.account_name,wm.account_number
    FROM public.withdrawals w JOIN public.profiles p ON p.id=w.user_id
    LEFT JOIN public.withdrawal_methods wm ON wm.id=w.method_id
    WHERE p_status='all' OR w.status=p_status
    ORDER BY w.created_at DESC LIMIT greatest(1,least(p_limit,300))
  ) x),'[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_withdrawals(text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_withdrawal_status(p_id uuid,p_status text,p_note text DEFAULT NULL,p_provider_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_status NOT IN ('pending','processing','paid','rejected','cancelled') THEN RAISE EXCEPTION 'INVALID_WITHDRAWAL_STATUS'; END IF;
  UPDATE public.withdrawals SET status=p_status,admin_note=coalesce(p_note,admin_note),provider_reference=coalesce(p_provider_reference,provider_reference),
    processed_by=auth.uid(),processed_at=CASE WHEN p_status IN ('paid','rejected','cancelled') THEN now() ELSE processed_at END,updated_at=now()
  WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND'; END IF;
  INSERT INTO public.admin_logs(admin_id,action,target_type,target_id,details) VALUES(auth.uid(),'withdrawal_status','withdrawal',p_id,jsonb_build_object('status',p_status));
  RETURN jsonb_build_object('ok',true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_withdrawal_status(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_settings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'cpm',coalesce((SELECT (value->>'value')::numeric FROM public.site_settings WHERE key='shortlink_cpm'),125),
    'manual_withdraw',coalesce((SELECT value->>'enabled' FROM public.site_settings WHERE key='withdraw_manual_enabled'),'true')::boolean,
    'instant_withdraw',coalesce((SELECT value->>'enabled' FROM public.site_settings WHERE key='withdraw_instant_enabled'),'true')::boolean,
    'maintenance',coalesce((SELECT value->>'enabled' FROM public.site_settings WHERE key='platform_maintenance'),'false')::boolean,
    'maintenance_message',coalesce((SELECT value->>'message' FROM public.site_settings WHERE key='platform_maintenance'),'ShowLink sedang dalam maintenance.'),
    'theme',coalesce((SELECT value FROM public.site_settings WHERE key='platform_theme'),'{"mode":"system","accent":"showlink"}'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_settings(p_cpm numeric DEFAULT NULL,p_manual boolean DEFAULT NULL,p_instant boolean DEFAULT NULL,p_maintenance boolean DEFAULT NULL,p_maintenance_message text DEFAULT NULL,p_theme_mode text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_cpm IS NOT NULL THEN
    IF p_cpm<0 OR p_cpm>1000000 THEN RAISE EXCEPTION 'INVALID_CPM'; END IF;
    INSERT INTO public.site_settings(key,value,is_public) VALUES('shortlink_cpm',jsonb_build_object('value',p_cpm),true)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,is_public=true,updated_at=now();
    UPDATE public.showlink_shortlink_final_stats SET cpm=p_cpm,estimated_revenue=(views*p_cpm)/1000,updated_at=now() WHERE id IS NOT NULL;
  END IF;
  IF p_manual IS NOT NULL THEN INSERT INTO public.site_settings(key,value) VALUES('withdraw_manual_enabled',jsonb_build_object('enabled',p_manual)) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now(); END IF;
  IF p_instant IS NOT NULL THEN INSERT INTO public.site_settings(key,value) VALUES('withdraw_instant_enabled',jsonb_build_object('enabled',p_instant)) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now(); END IF;
  IF p_maintenance IS NOT NULL THEN INSERT INTO public.site_settings(key,value,is_public) VALUES('platform_maintenance',jsonb_build_object('enabled',p_maintenance,'message',coalesce(p_maintenance_message,'ShowLink sedang dalam maintenance.')),true) ON CONFLICT(key) DO UPDATE SET value=excluded.value,is_public=true,updated_at=now();
  ELSIF p_maintenance_message IS NOT NULL THEN UPDATE public.site_settings SET value=jsonb_set(value,'{message}',to_jsonb(p_maintenance_message)),updated_at=now() WHERE key='platform_maintenance'; END IF;
  IF p_theme_mode IS NOT NULL AND p_theme_mode IN ('system','light','dark') THEN INSERT INTO public.site_settings(key,value,is_public) VALUES('platform_theme',jsonb_build_object('mode',p_theme_mode),true) ON CONFLICT(key) DO UPDATE SET value=excluded.value,is_public=true,updated_at=now(); END IF;
  INSERT INTO public.admin_logs(admin_id,action,details) VALUES(auth.uid(),'update_settings',jsonb_build_object('cpm',p_cpm,'manual',p_manual,'instant',p_instant,'maintenance',p_maintenance,'theme',p_theme_mode));
  RETURN public.admin_get_settings();
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_settings(numeric,boolean,boolean,boolean,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_announce(p_title text,p_message text,p_link_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint;
BEGIN
  PERFORM public.admin_guard();
  INSERT INTO public.notifications(user_id,type,title,message,link_url,metadata)
  SELECT id,'admin_announcement',left(p_title,200),left(coalesce(p_message,''),5000),p_link_url,jsonb_build_object('from_admin',true)
  FROM public.profiles WHERE is_banned=false;
  GET DIAGNOSTICS n=ROW_COUNT;
  INSERT INTO public.admin_logs(admin_id,action,details) VALUES(auth.uid(),'announcement',jsonb_build_object('recipients',n,'title',p_title));
  RETURN jsonb_build_object('ok',true,'recipients',n);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_announce(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_public_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'maintenance',coalesce((SELECT value FROM public.site_settings WHERE key='platform_maintenance' AND is_public=true),'{"enabled":false}'::jsonb),
    'theme',coalesce((SELECT value FROM public.site_settings WHERE key='platform_theme' AND is_public=true),'{"mode":"system"}'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_platform_public_settings() TO anon,authenticated;
