-- Run ONLY in a dedicated Supabase project for Ken Affiliate Studio.
-- Requires a Supabase project with email / social login providers configured separately.
-- Every exposed table has RLS and user ownership checks.

create table if not exists public.workspace_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint workspace_data_json_is_object check (jsonb_typeof(data) = 'object')
);

alter table public.workspace_data enable row level security;
revoke all on public.workspace_data from anon;
grant select, insert, update, delete on public.workspace_data to authenticated;

drop policy if exists "Owners can read workspace" on public.workspace_data;
create policy "Owners can read workspace" on public.workspace_data for select to authenticated
 using ((select auth.uid()) = user_id);
drop policy if exists "Owners can insert workspace" on public.workspace_data;
create policy "Owners can insert workspace" on public.workspace_data for insert to authenticated
 with check ((select auth.uid()) = user_id);
drop policy if exists "Owners can update workspace" on public.workspace_data;
create policy "Owners can update workspace" on public.workspace_data for update to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
drop policy if exists "Owners can delete workspace" on public.workspace_data;
create policy "Owners can delete workspace" on public.workspace_data for delete to authenticated
 using ((select auth.uid()) = user_id);

-- Character reference images are private: use signed URLs, not public bucket URLs.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('character-assets','character-assets',false,921600,array['image/jpeg','image/png','image/webp'])
 on conflict (id) do update set public=false,file_size_limit=921600,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Users read their own character images" on storage.objects;
create policy "Users read their own character images" on storage.objects
 for select to authenticated
 using (bucket_id='character-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload their own character images" on storage.objects;
create policy "Users upload their own character images" on storage.objects
 for insert to authenticated
 with check (bucket_id='character-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their own character images" on storage.objects;
create policy "Users delete their own character images" on storage.objects
 for delete to authenticated
 using (bucket_id='character-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- AI usage log. No generic access and no client-side deletion to bypass per-user quota.
create table if not exists public.ai_usage_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check (mode in ('campaign','character','ideas')),
 created_at timestamptz not null default now()
);
alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon;
grant select, insert on public.ai_usage_events to authenticated;
drop policy if exists "Users view their AI request count" on public.ai_usage_events;
create policy "Users view their AI request count" on public.ai_usage_events
 for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users record AI usage" on public.ai_usage_events;
create policy "Users record AI usage" on public.ai_usage_events
 for insert to authenticated with check ((select auth.uid()) = user_id);
create index if not exists ai_usage_events_user_day_idx on public.ai_usage_events(user_id,created_at desc);