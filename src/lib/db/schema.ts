import Dexie, { type EntityTable } from 'dexie'

// Local database types (mirror server types but with sync metadata)
export interface LocalTournament {
  id: string
  name: string
  share_code: string
  admin_pin: string
  status: 'draft' | 'active' | 'completed'
  start_date: string
  end_date: string
  created_at: string
  synced_at?: string
}

export interface LocalCourse {
  id: string
  name: string
  par: number
  created_at: string
  synced_at?: string
}

export interface LocalHole {
  id: string
  course_id: string
  hole_number: number
  par: number
  yardage: number | null
  synced_at?: string
}

export interface LocalPlayer {
  id: string
  name: string
  created_at: string
  synced_at?: string
}

export interface LocalTournamentPlayer {
  id: string
  tournament_id: string
  player_id: string
  handicap: number
  group_number: number
  synced_at?: string
}

export interface LocalRound {
  id: string
  tournament_id: string
  course_id: string
  round_number: number
  date: string
  status: 'upcoming' | 'in_progress' | 'completed'
  created_at: string
  synced_at?: string
}

export interface LocalScore {
  id: string
  local_id: string // Unique local identifier for optimistic updates
  round_id: string
  tournament_player_id: string
  hole_number: number
  strokes: number
  created_at: string
  updated_at: string
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  error_message?: string
}

export interface SyncQueueItem {
  id?: number
  entity_type: 'score' | 'tournament' | 'player' | 'round'
  entity_id: string
  action: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  created_at: string
  attempts: number
  last_error?: string
}

// Define the database
class FifthMajorDB extends Dexie {
  tournaments!: EntityTable<LocalTournament, 'id'>
  courses!: EntityTable<LocalCourse, 'id'>
  holes!: EntityTable<LocalHole, 'id'>
  players!: EntityTable<LocalPlayer, 'id'>
  tournamentPlayers!: EntityTable<LocalTournamentPlayer, 'id'>
  rounds!: EntityTable<LocalRound, 'id'>
  scores!: EntityTable<LocalScore, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>

  constructor() {
    super('FifthMajorDB')

    this.version(1).stores({
      tournaments: 'id, share_code, status',
      courses: 'id, name',
      holes: 'id, course_id, [course_id+hole_number]',
      players: 'id, name',
      tournamentPlayers: 'id, tournament_id, player_id, [tournament_id+player_id]',
      rounds: 'id, tournament_id, [tournament_id+round_number]',
      scores: 'id, local_id, round_id, tournament_player_id, [round_id+tournament_player_id+hole_number], sync_status',
      syncQueue: '++id, entity_type, entity_id, created_at'
    })
  }
}

export const db = new FifthMajorDB()

// Helper to generate UUIDs for local records
export function generateLocalId(): string {
  return `local_${crypto.randomUUID()}`
}

// Helper to check if an ID is a local (unsynced) ID
export function isLocalId(id: string): boolean {
  return id.startsWith('local_')
}
