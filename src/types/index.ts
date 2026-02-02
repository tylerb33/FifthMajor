// Database types matching Supabase schema

export interface Tournament {
  id: string
  name: string
  share_code: string
  admin_pin: string
  status: 'draft' | 'active' | 'completed'
  start_date: string
  end_date: string
  created_at: string
}

export interface Course {
  id: string
  name: string
  par: number
  created_at: string
}

export interface Hole {
  id: string
  course_id: string
  hole_number: number
  par: number
  yardage: number | null
}

export interface Player {
  id: string
  name: string
  created_at: string
}

export interface TournamentPlayer {
  id: string
  tournament_id: string
  player_id: string
  handicap: number
  group_number: number
  player?: Player
}

export interface Round {
  id: string
  tournament_id: string
  course_id: string
  round_number: number
  date: string
  status: 'upcoming' | 'in_progress' | 'completed'
  created_at: string
  course?: Course
}

export interface Score {
  id: string
  round_id: string
  tournament_player_id: string
  hole_number: number
  strokes: number
  created_at: string
  updated_at: string
  synced_at: string | null
  local_id?: string
}

// Computed types for UI
export interface LeaderboardEntry {
  tournament_player_id: string
  player_name: string
  handicap: number
  group_number: number
  gross_score: number
  net_score: number
  holes_completed: number
  round_scores: RoundScore[]
  total_gross: number
  total_net: number
}

export interface RoundScore {
  round_id: string
  round_number: number
  gross: number
  net: number
  holes_completed: number
}

// Sync types
export interface PendingScore {
  id: string
  local_id: string
  round_id: string
  tournament_player_id: string
  hole_number: number
  strokes: number
  created_at: string
  updated_at: string
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  error_message?: string
}

// Form types
export interface CreateTournamentInput {
  name: string
  start_date: string
  end_date: string
}

export interface CreatePlayerInput {
  name: string
  handicap: number
  group_number: number
}

export interface CreateCourseInput {
  name: string
  par: number
  holes: CreateHoleInput[]
}

export interface CreateHoleInput {
  hole_number: number
  par: number
  yardage?: number
}

export interface CreateRoundInput {
  course_id: string
  round_number: number
  date: string
}
