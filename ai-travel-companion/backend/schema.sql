-- AtlasGo Travel Companion schema draft. NOT DEPLOYED.
-- Create a separate Supabase project and review privacy/RLS before applying.
create extension if not exists pgcrypto;
create table if not exists public.travel_trips (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'New trip',
 input jsonb not null,
 status text not null default 'draft' check(status in ('draft','active','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists travel_trips_owner_date on public.travel_trips(owner_id,updated_at desc);
create table if not exists public.travel_trip_days (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.travel_trips(id) on delete cascade,
 day_index smallint not null check(day_index between 0 and 60),
 local_date date not null,
 city text not null,
 unique(trip_id,day_index)
);
create table if not exists public.travel_trip_stops (
 id uuid primary key default gen_random_uuid(),
 day_id uuid not null references public.travel_trip_days(id) on delete cascade,
 stop_index smallint not null check(stop_index>=0),
 title text not null,
 provider_place_id text,
 provider_name text,
 category text,
 notes text,
 source_metadata jsonb not null default '{}'::jsonb,
 unique(day_id,stop_index)
);
create table if not exists public.travel_trip_revisions (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.travel_trips(id) on delete cascade,
 requested_by uuid not null references auth.users(id) on delete cascade,
 instruction text not null,
 proposal jsonb not null,
 accepted_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.travel_trip_expenses (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.travel_trips(id) on delete cascade,
 category text not null,
 amount numeric(12,2) not null check(amount>=0),
 is_actual boolean not null default false,
 currency char(3) not null default 'THB',
 source text,
 created_at timestamptz not null default now()
);
create table if not exists public.travel_trip_shares (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.travel_trips(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.travel_api_usage (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 provider text not null,
 operation text not null,
 estimated_usd numeric(10,6),
 created_at timestamptz not null default now()
);
create index if not exists travel_api_usage_date on public.travel_api_usage(created_at);

alter table public.travel_trips enable row level security;
alter table public.travel_trip_days enable row level security;
alter table public.travel_trip_stops enable row level security;
alter table public.travel_trip_revisions enable row level security;
alter table public.travel_trip_expenses enable row level security;
alter table public.travel_trip_shares enable row level security;
alter table public.travel_api_usage enable row level security;

create policy "trips_owner_read" on public.travel_trips for select to authenticated
 using(owner_id=(select auth.uid()));
create policy "trips_owner_insert" on public.travel_trips for insert to authenticated
 with check(owner_id=(select auth.uid()));
create policy "trips_owner_update" on public.travel_trips for update to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "trips_owner_delete" on public.travel_trips for delete to authenticated
 using(owner_id=(select auth.uid()));

create policy "days_owner" on public.travel_trip_days for all to authenticated
 using(exists(select 1 from public.travel_trips t where t.id=trip_id and t.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.travel_trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "stops_owner" on public.travel_trip_stops for all to authenticated
 using(exists(select 1 from public.travel_trip_days d join public.travel_trips t on t.id=d.trip_id where d.id=day_id and t.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.travel_trip_days d join public.travel_trips t on t.id=d.trip_id where d.id=day_id and t.owner_id=(select auth.uid())));
create policy "revisions_owner" on public.travel_trip_revisions for all to authenticated
 using(exists(select 1 from public.travel_trips t where t.id=trip_id and t.owner_id=(select auth.uid())))
 with check(requested_by=(select auth.uid()) and exists(select 1 from public.travel_trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "expenses_owner" on public.travel_trip_expenses for all to authenticated
 using(exists(select 1 from public.travel_trips t where t.id=trip_id and t.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.travel_trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
-- Shares must be created/revoked through owner-authorized backend logic.
create policy "shares_owner_read" on public.travel_trip_shares for select to authenticated
 using(exists(select 1 from public.travel_trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
-- No client access to travel_api_usage; service-only logging.
