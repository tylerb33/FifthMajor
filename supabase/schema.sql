-- FifthMajor Golf Tournament Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  share_code TEXT NOT NULL UNIQUE,
  admin_pin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for share code lookups
CREATE INDEX idx_tournaments_share_code ON tournaments(share_code);

-- Courses table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  par INTEGER NOT NULL DEFAULT 72,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Holes table
CREATE TABLE holes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INTEGER NOT NULL CHECK (par BETWEEN 3 AND 5),
  yardage INTEGER,
  UNIQUE(course_id, hole_number)
);

-- Create index for hole lookups
CREATE INDEX idx_holes_course ON holes(course_id, hole_number);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tournament Players (links players to tournaments with handicap)
CREATE TABLE tournament_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  handicap INTEGER NOT NULL DEFAULT 0,
  group_number INTEGER NOT NULL DEFAULT 1 CHECK (group_number BETWEEN 1 AND 10),
  UNIQUE(tournament_id, player_id)
);

-- Create indexes for tournament player lookups
CREATE INDEX idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_players_player ON tournament_players(player_id);

-- Rounds table
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id),
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 10),
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, round_number)
);

-- Create index for round lookups
CREATE INDEX idx_rounds_tournament ON rounds(tournament_id);

-- Scores table
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  tournament_player_id UUID NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL CHECK (strokes BETWEEN 1 AND 15),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, tournament_player_id, hole_number)
);

-- Create indexes for score lookups
CREATE INDEX idx_scores_round ON scores(round_id);
CREATE INDEX idx_scores_player ON scores(tournament_player_id);
CREATE INDEX idx_scores_round_player ON scores(round_id, tournament_player_id);

-- Enable Row Level Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we're using share codes, not auth)
-- In production, you might want more restrictive policies

-- Tournaments: Anyone can read, create
CREATE POLICY "Allow public read access to tournaments" ON tournaments
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tournaments" ON tournaments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to tournaments" ON tournaments
  FOR UPDATE USING (true);

-- Courses: Anyone can read, create
CREATE POLICY "Allow public read access to courses" ON courses
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert to courses" ON courses
  FOR INSERT WITH CHECK (true);

-- Holes: Anyone can read, create
CREATE POLICY "Allow public read access to holes" ON holes
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert to holes" ON holes
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to holes" ON holes
  FOR UPDATE USING (true);

-- Players: Anyone can read, create
CREATE POLICY "Allow public read access to players" ON players
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert to players" ON players
  FOR INSERT WITH CHECK (true);

-- Tournament Players: Anyone can read, create, update
CREATE POLICY "Allow public read access to tournament_players" ON tournament_players
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tournament_players" ON tournament_players
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to tournament_players" ON tournament_players
  FOR UPDATE USING (true);

-- Rounds: Anyone can read, create, update
CREATE POLICY "Allow public read access to rounds" ON rounds
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert to rounds" ON rounds
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to rounds" ON rounds
  FOR UPDATE USING (true);

-- Scores: Anyone can read, create, update
CREATE POLICY "Allow public read access to scores" ON scores
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert to scores" ON scores
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to scores" ON scores
  FOR UPDATE USING (true);

-- Enable realtime for scores table
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_players;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for scores updated_at
CREATE TRIGGER update_scores_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
