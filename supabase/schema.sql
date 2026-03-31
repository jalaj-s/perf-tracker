-- ============================================
-- Soccer Performance Tracker — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- Activities: synced from Strava (runs + soccer only)
create table activities (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  strava_id       bigint,
  activity_type   text not null check (activity_type in ('match', 'run')),
  name            text,
  started_at      timestamptz not null,
  distance_miles  numeric(5,2),
  duration_minutes numeric(6,1),
  avg_pace        text,
  avg_heart_rate  integer,
  max_heart_rate  integer,
  calories        integer,
  elevation_gain_ft numeric(6,1),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique(user_id, strava_id)
);

-- Match details: soccer-specific data added after each game
create table match_details (
  id              uuid default gen_random_uuid() primary key,
  activity_id     uuid references activities(id) on delete cascade unique,
  user_id         uuid references auth.users(id) on delete cascade not null,
  league          text,
  format          text not null check (format in ('7v7', '11v11')),
  result          text,
  position        text,
  goals           integer default 0,
  assists         integer default 0,
  rating          integer check (rating between 1 and 10),
  notes           text,
  match_date      timestamptz not null,
  created_at      timestamptz default now()
);

-- Strava tokens: one row per user
create table strava_tokens (
  user_id           uuid references auth.users(id) on delete cascade primary key,
  access_token      text not null,
  refresh_token     text not null,
  expires_at        bigint not null,
  strava_athlete_id bigint,
  updated_at        timestamptz default now()
);

-- Indexes
create index idx_activities_user_type_date
  on activities(user_id, activity_type, started_at desc);

create index idx_match_details_user_format_position
  on match_details(user_id, format, position);

-- Row Level Security
alter table activities enable row level security;
alter table match_details enable row level security;
alter table strava_tokens enable row level security;

create policy "Users manage own activities"
  on activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own match details"
  on match_details for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own tokens"
  on strava_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
