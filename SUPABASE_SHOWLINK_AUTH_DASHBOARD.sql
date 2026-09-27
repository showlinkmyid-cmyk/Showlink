-- SHOWLINK AUTH + PROFILE DATABASE
-- Email + username registration + Google OAuth profile support.
-- Run in Supabase SQL Editor. Passwords are managed only by Supabase Auth; never store plaintext passwords in public.profiles.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','premium','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_uidx
  on public.profiles (lower(username))
  where username is not null and username <> '';

create index if not exists profiles_email_idx on public.profiles(lower(email));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,email,username,display_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data->>'username'),''),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'),''),
      nullif(trim(new.raw_user_meta_data->>'username'),''),
      split_part(coalesce(new.email,''),'@',1)
    )
  )
  on conflict (id) do update set
    email=excluded.email,
    username=coalesce(excluded.username, public.profiles.username),
    display_name=coalesce(excluded.display_name, public.profiles.display_name),
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_profiles_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
revoke all on public.profiles from anon;
