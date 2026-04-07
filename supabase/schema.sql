-- Fantasy Flagstick — Database Schema
-- Supabase PostgreSQL
-- Auth: Clerk (user IDs are text in format 'user_xxx', NOT uuid)
-- Execute tables in this exact order

-- Helper: get current Clerk user ID from JWT
create or replace function requesting_user_id() returns text
  language sql stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      null
    )
  $$;

-- ============================================================
-- TOURNAMENTS
-- ============================================================
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  course text not null,
  course_short text not null,
  par int not null default 72,
  start_date date not null,
  end_date date not null,
  current_round int not null default 1,
  status text not null default 'upcoming', -- upcoming | active | complete
  theme text not null default 'masters',   -- masters | open | usopen | pga
  active boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================================
-- HOLES
-- ============================================================
create table holes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  number int not null,
  par int not null,
  name text not null,
  yards int not null,
  avg_score numeric(4,2),
  birdie_pct numeric(5,2),
  eagle_pct numeric(5,2),
  bogey_pct numeric(5,2),
  water_hazard boolean default false,
  difficulty_rank int,
  unique(tournament_id, number)
);

-- ============================================================
-- PLAYERS (field for this tournament)
-- ============================================================
create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  name_full text not null,
  country text not null,
  world_ranking int,
  datagolf_id text,
  espn_id text,
  -- Pricing (updated each round)
  price_r1 int not null default 10,
  price_r2 int,
  price_r3 int,
  price_r4 int,
  current_price int not null default 10,
  price_direction text default 'flat', -- up | down | flat
  -- Current round stats
  current_round_score int default 0,
  holes_completed int default 0,
  total_score int default 0,
  status text default 'active',  -- active | cut | wd | dq
  created_at timestamptz default now()
);

-- ============================================================
-- HOLE SCORES (live, updated as players complete holes)
-- ============================================================
create table hole_scores (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  round int not null,
  hole_number int not null,
  score int,
  score_vs_par int,
  is_water boolean default false,
  confirmed boolean default false,
  confirmed_at timestamptz,
  unique(tournament_id, player_id, round, hole_number)
);

-- ============================================================
-- LEAGUES
-- NOTE: created_by is Clerk user ID (text), not uuid
-- ============================================================
create table leagues (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  code text unique not null,
  created_by text not null,            -- Clerk user ID e.g. 'user_xxx'
  type text default 'tournament',      -- tournament | global
  max_players int default 50,
  created_at timestamptz default now()
);

-- ============================================================
-- LEAGUE MEMBERS
-- NOTE: user_id is Clerk user ID (text), not uuid
-- ============================================================
create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade,
  user_id text not null,               -- Clerk user ID e.g. 'user_xxx'
  display_name text,
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

-- ============================================================
-- PICKS
-- NOTE: user_id is Clerk user ID (text), not uuid
-- ============================================================
create table picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade,
  user_id text not null,               -- Clerk user ID e.g. 'user_xxx'
  tournament_id uuid references tournaments(id) on delete cascade,
  round int not null,
  hole_number int not null,
  player_id uuid references players(id) on delete cascade,
  price_paid int not null,
  is_locked boolean default false,
  locked_at timestamptz,
  score_vs_par int,
  is_postman boolean default false,
  is_mulligan_used boolean default false,
  mulligan_replacement_player_id uuid references players(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(league_id, user_id, round, hole_number)
);

-- ============================================================
-- CHIPS (one row per user per tournament)
-- NOTE: user_id is Clerk user ID (text), not uuid
-- ============================================================
create table chips (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade,
  user_id text not null,               -- Clerk user ID e.g. 'user_xxx'
  tournament_id uuid references tournaments(id) on delete cascade,
  -- Sponsorship Deal: +£25m for one round
  sponsorship_used boolean default false,
  sponsorship_round int,
  -- Postman: doubles one player's score for entire round (per round)
  postman_r1_player_id uuid references players(id),
  postman_r2_player_id uuid references players(id),
  postman_r3_player_id uuid references players(id),
  postman_r4_player_id uuid references players(id),
  -- Mulligan: swap one locked pick (once per tournament)
  mulligan_used boolean default false,
  mulligan_round int,
  mulligan_hole int,
  unique(league_id, user_id, tournament_id)
);

-- ============================================================
-- MATCH PLAY
-- NOTE: player1_id/player2_id are Clerk user IDs (text)
-- ============================================================
create table match_play (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  round int not null,
  player1_id text not null,            -- Clerk user ID
  player2_id text not null,            -- Clerk user ID
  player1_holes_won int default 0,
  player2_holes_won int default 0,
  holes_halved int default 0,
  status text default 'in_progress',   -- in_progress | player1_won | player2_won | halved
  created_at timestamptz default now()
);

-- ============================================================
-- PROFILES (public user data)
-- NOTE: id is Clerk user ID (text), not uuid
-- ============================================================
create table profiles (
  id text primary key,                 -- Clerk user ID e.g. 'user_xxx'
  display_name text,
  avatar_emoji text default '🏌️',
  total_majors_played int default 0,
  all_time_score int default 0,
  -- Pro Mode architecture (future — DO NOT build yet)
  age_verified boolean default false,
  date_of_birth date,
  age_verified_at timestamptz,
  pro_mode_enabled boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- TROPHIES
-- NOTE: user_id is Clerk user ID (text)
-- ============================================================
create table trophies (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,               -- Clerk user ID
  tournament_id uuid references tournaments(id) on delete cascade,
  league_id uuid references leagues(id) on delete cascade,
  type text not null,
  name text not null,
  detail text,
  year int not null,
  earned_at timestamptz default now()
);

-- ============================================================
-- PRICE HISTORY (for sparklines / audit)
-- ============================================================
create table price_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  round int not null,
  hole_number int not null,
  price int not null,
  recorded_at timestamptz default now()
);

-- ============================================================
-- BEAT THE BOOKIE (supplemental spec section 2)
-- ============================================================
create table beat_the_bookie (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  round int not null,
  pre_round_prob numeric(6,4),
  current_prob numeric(6,4),
  performance_index numeric(8,2),
  direction text,               -- 'up' | 'down'
  pre_round_odds_display text,  -- '40/1'
  current_odds_display text,    -- 'playing like 9/1'
  updated_at timestamptz default now(),
  unique(tournament_id, player_id, round)
);

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table hole_scores;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table picks;
alter publication supabase_realtime add table beat_the_bookie;

-- ============================================================
-- ROW LEVEL SECURITY
-- Uses requesting_user_id() which reads Clerk user ID from JWT sub claim
-- ============================================================
alter table profiles enable row level security;
alter table picks enable row level security;
alter table chips enable row level security;
alter table trophies enable row level security;
alter table league_members enable row level security;
alter table leagues enable row level security;

-- Profiles
create policy "Anyone can read profiles"
  on profiles for select using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (id = requesting_user_id());

create policy "Users can update own profile"
  on profiles for update using (id = requesting_user_id());

-- Leagues
create policy "Anyone can read leagues"
  on leagues for select using (true);

create policy "Authenticated users can create leagues"
  on leagues for insert with check (requesting_user_id() is not null);

-- League members
create policy "Anyone can read league members"
  on league_members for select using (true);

create policy "Users can join leagues"
  on league_members for insert with check (user_id = requesting_user_id());

-- Picks
create policy "Users can read picks in their leagues"
  on picks for select using (true);

create policy "Users can insert own picks"
  on picks for insert with check (user_id = requesting_user_id());

create policy "Users can update own unlocked picks"
  on picks for update using (
    user_id = requesting_user_id() and is_locked = false
  );

-- Chips
create policy "Users can read own chips"
  on chips for select using (user_id = requesting_user_id());

create policy "Users can insert own chips"
  on chips for insert with check (user_id = requesting_user_id());

create policy "Users can update own chips"
  on chips for update using (user_id = requesting_user_id());

-- Trophies
create policy "Anyone can read trophies"
  on trophies for select using (true);
