-- Kilometre schema. Run once in Supabase → SQL Editor.
-- Every table is private to its owner via Row Level Security.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  language text not null default 'en' check (language in ('en', 'hi', 'kn')),
  platforms text[] not null default '{}',
  vehicle text not null default 'petrol' check (vehicle in ('petrol', 'ev', 'ecycle')),
  fuel_cost_per_km numeric not null default 2.5,
  monthly_emi numeric not null default 3200,
  monthly_phone_data numeric not null default 400,
  daily_target numeric not null default 1500,
  home_zone text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.screenshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sha256 text not null,
  platform text,
  kind text,
  uploaded_at timestamptz not null default now(),
  unique (user_id, sha256)
);

create table if not exists public.earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  date date not null,
  time time,
  order_id text,
  kind text not null default 'order' check (kind in ('order', 'daily_summary')),
  amount numeric not null default 0,
  incentive numeric not null default 0,
  tip numeric not null default 0,
  distance_km numeric,
  login_hours numeric,
  pickup text,
  source text not null default 'manual' check (source in ('screenshot', 'manual', 'voice', 'seed')),
  screenshot_id uuid references public.screenshots(id) on delete set null,
  confidence numeric,
  created_at timestamptz not null default now()
);
-- Same order id on the same platform can only exist once per rider.
create unique index if not exists earnings_order_unique
  on public.earnings (user_id, platform, order_id) where order_id is not null;
create index if not exists earnings_user_date on public.earnings (user_id, date);

create table if not exists public.wait_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id text,
  restaurant_name text not null,
  zone text,
  platform text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_min numeric not null,
  lat double precision,
  lng double precision,
  source text not null default 'timer',
  created_at timestamptz not null default now()
);
create index if not exists wait_logs_user on public.wait_logs (user_id, started_at);

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  issue_type text not null,
  dates text[] not null default '{}',
  description text not null default '',
  letter_en text not null,
  summary_local text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.screenshots enable row level security;
alter table public.earnings enable row level security;
alter table public.wait_logs enable row level security;
alter table public.appeals enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own screenshots" on public.screenshots;
create policy "own screenshots" on public.screenshots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own earnings" on public.earnings;
create policy "own earnings" on public.earnings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own waits" on public.wait_logs;
create policy "own waits" on public.wait_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own appeals" on public.appeals;
create policy "own appeals" on public.appeals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
