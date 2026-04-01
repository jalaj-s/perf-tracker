-- ============================================
-- Leagues Migration
-- Run this in Supabase Dashboard > SQL Editor
-- AFTER the initial schema.sql has been run
-- ============================================

-- Step 1: Create leagues table
create table leagues (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  format      text not null check (format in ('7v7', '11v11')),
  location    text,
  organizer   text,
  is_coed     boolean default false,
  created_at  timestamptz default now(),

  unique(user_id, name)
);

create index idx_leagues_user on leagues(user_id);

alter table leagues enable row level security;

create policy "Users manage own leagues"
  on leagues for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Step 2: Migrate existing league data from match_details
-- Creates leagues from unique (user_id, league, format) combinations
-- Skips rows where league is null
insert into leagues (user_id, name, format)
select distinct user_id, league, format
from match_details
where league is not null
on conflict (user_id, name) do nothing;

-- Step 3: Add league_id column to match_details
alter table match_details add column league_id uuid references leagues(id) on delete restrict;

-- Step 4: Populate league_id from existing league text + format
update match_details md
set league_id = l.id
from leagues l
where l.user_id = md.user_id
  and l.name = md.league
  and l.format = md.format;

-- Step 5: Convert position from text to text[]
alter table match_details alter column position type text[] using
  case when position is not null then array[position] else null end;

-- Step 6: Rename position to positions
alter table match_details rename column position to positions;

-- Step 7: Make league_id not null (all existing rows should be populated or null league rows get a default)
-- First, create a catch-all league for any matches with null league
do $$
declare
  uid uuid;
  lid uuid;
begin
  for uid in
    select distinct user_id from match_details where league_id is null
  loop
    insert into leagues (user_id, name, format)
    values (uid, 'Pickup', '7v7')
    on conflict (user_id, name) do nothing;

    select id into lid from leagues where user_id = uid and name = 'Pickup';

    update match_details set league_id = lid where user_id = uid and league_id is null;
  end loop;
end $$;

alter table match_details alter column league_id set not null;

-- Step 8: Drop old columns
alter table match_details drop column league;
alter table match_details drop column format;

-- Step 9: Update match_details index (old one referenced format, position)
drop index if exists idx_match_details_user_format_position;
create index idx_match_details_user_league on match_details(user_id, league_id);
