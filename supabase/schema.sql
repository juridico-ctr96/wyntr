create extension if not exists pgcrypto;

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('nba','tennis')),
  league text,
  event_id text not null,
  home_name text not null,
  away_name text not null,
  scheduled_at timestamptz,
  published_at timestamptz not null default now(),
  model_version text not null,
  home_probability numeric(6,3) not null check (home_probability >= 0 and home_probability <= 100),
  away_probability numeric(6,3) not null check (away_probability >= 0 and away_probability <= 100),
  projected_home_score numeric(7,2),
  projected_away_score numeric(7,2),
  confidence numeric(6,3),
  data_coverage numeric(6,3),
  integrity_risk numeric(6,3),
  features jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','correct','incorrect','void')),
  actual_home_score numeric(7,2),
  actual_away_score numeric(7,2),
  settled_at timestamptz,
  prediction_hash text not null,
  created_at timestamptz not null default now(),
  unique (sport, event_id, model_version)
);

create index if not exists predictions_sport_date_idx
  on public.predictions (sport, scheduled_at desc);

create index if not exists predictions_status_idx
  on public.predictions (status);

alter table public.predictions enable row level security;

drop policy if exists "public can read predictions" on public.predictions;
create policy "public can read predictions"
on public.predictions for select
using (true);

-- Inserts/settlements must go through the server-side API using SUPABASE_SERVICE_ROLE_KEY.
