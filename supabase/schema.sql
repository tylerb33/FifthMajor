-- Fifth Major Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tournaments table
create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  share_code text unique not null,
  admin_pin text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);

-- Courses table
create table courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  par integer not null default 72,
  created_at timestamptz default now()
);

-- Holes table
create table holes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) on delete cascade not null,
  hole_number integer not null check (hole_number >= 1 and hole_number <= 18),
  par integer not null check (par >= 3 and par <= 6),
  yardage integer,
  unique(course_id, hole_number)
);

-- Players table
create table players (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- Tournament Players (links players to tournaments with handicap)
create table tournament_players (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  handicap integer not null default 0,
  group_number integer not null default 1,
  unique(tournament_id, player_id)
);

-- Rounds table
create table rounds (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade not null,
  course_id uuid references courses(id) not null,
  round_number integer not null,
  date date not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed')),
  created_at timestamptz default now(),
  unique(tournament_id, round_number)
);

-- Scores table
create table scores (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid references rounds(id) on delete cascade not null,
  tournament_player_id uuid references tournament_players(id) on delete cascade not null,
  hole_number integer not null check (hole_number >= 1 and hole_number <= 18),
  strokes integer not null check (strokes >= 1 and strokes <= 15),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(round_id, tournament_player_id, hole_number)
);

-- Enable Row Level Security (RLS) on all tables
alter table tournaments enable row level security;
alter table courses enable row level security;
alter table holes enable row level security;
alter table players enable row level security;
alter table tournament_players enable row level security;
alter table rounds enable row level security;
alter table scores enable row level security;

-- Policies: Allow all operations for now (public access)
-- In production, you'd want to add authentication

create policy "Allow all access to tournaments" on tournaments for all using (true) with check (true);
create policy "Allow all access to courses" on courses for all using (true) with check (true);
create policy "Allow all access to holes" on holes for all using (true) with check (true);
create policy "Allow all access to players" on players for all using (true) with check (true);
create policy "Allow all access to tournament_players" on tournament_players for all using (true) with check (true);
create policy "Allow all access to rounds" on rounds for all using (true) with check (true);
create policy "Allow all access to scores" on scores for all using (true) with check (true);

-- Enable realtime for scores (so leaderboard updates live)
alter publication supabase_realtime add table scores;

-- Index for faster score lookups
create index scores_round_player_idx on scores(round_id, tournament_player_id);
create index scores_tournament_player_idx on scores(tournament_player_id);
create index tournament_share_code_idx on tournaments(share_code);
