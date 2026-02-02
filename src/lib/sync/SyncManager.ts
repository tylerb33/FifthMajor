import { db, type LocalScore, type SyncQueueItem } from '@/lib/db/schema'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { isOnline } from '@/lib/utils'

type SyncStatus = 'idle' | 'syncing' | 'error'
type SyncListener = (status: SyncStatus, pendingCount: number) => void

class SyncManager {
  private listeners: Set<SyncListener> = new Set()
  private status: SyncStatus = 'idle'
  private syncInProgress = false
  private retryTimeout: ReturnType<typeof setTimeout> | null = null

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onOnline())
      window.addEventListener('offline', () => this.onOffline())
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    // Immediately notify with current status
    this.notifyListeners()
    return () => this.listeners.delete(listener)
  }

  private async notifyListeners() {
    const pendingCount = await this.getPendingCount()
    this.listeners.forEach(listener => listener(this.status, pendingCount))
  }

  private async getPendingCount(): Promise<number> {
    const pendingScores = await db.scores
      .where('sync_status')
      .equals('pending')
      .count()
    const queueItems = await db.syncQueue.count()
    return pendingScores + queueItems
  }

  private onOnline() {
    console.log('[SyncManager] Online, starting sync')
    this.startSync()
  }

  private onOffline() {
    console.log('[SyncManager] Offline')
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
  }

  /**
   * Queue a score for syncing
   */
  async queueScore(score: Omit<LocalScore, 'sync_status'>): Promise<void> {
    await db.scores.put({
      ...score,
      sync_status: 'pending'
    })
    this.notifyListeners()

    // Try to sync immediately if online
    if (isOnline()) {
      this.startSync()
    }
  }

  /**
   * Queue a generic item for syncing
   */
  async queueItem(item: Omit<SyncQueueItem, 'id' | 'created_at' | 'attempts'>): Promise<void> {
    await db.syncQueue.add({
      ...item,
      created_at: new Date().toISOString(),
      attempts: 0
    })
    this.notifyListeners()

    if (isOnline()) {
      this.startSync()
    }
  }

  /**
   * Start the sync process
   */
  async startSync(): Promise<void> {
    if (this.syncInProgress || !isOnline() || !isSupabaseConfigured()) {
      return
    }

    this.syncInProgress = true
    this.status = 'syncing'
    this.notifyListeners()

    try {
      await this.syncScores()
      await this.syncQueueItems()
      this.status = 'idle'
    } catch (error) {
      console.error('[SyncManager] Sync error:', error)
      this.status = 'error'
      // Retry after 30 seconds
      this.retryTimeout = setTimeout(() => this.startSync(), 30000)
    } finally {
      this.syncInProgress = false
      this.notifyListeners()
    }
  }

  /**
   * Sync pending scores to Supabase
   */
  private async syncScores(): Promise<void> {
    const pendingScores = await db.scores
      .where('sync_status')
      .equals('pending')
      .toArray()

    for (const score of pendingScores) {
      try {
        // Update status to syncing
        await db.scores.update(score.id, { sync_status: 'syncing' })

        // Upsert to Supabase (using round_id, tournament_player_id, hole_number as unique key)
        const { error } = await supabase
          .from('scores')
          .upsert({
            round_id: score.round_id,
            tournament_player_id: score.tournament_player_id,
            hole_number: score.hole_number,
            strokes: score.strokes,
            updated_at: score.updated_at
          }, {
            onConflict: 'round_id,tournament_player_id,hole_number'
          })

        if (error) throw error

        // Mark as synced
        await db.scores.update(score.id, {
          sync_status: 'synced',
          error_message: undefined
        })
      } catch (error) {
        console.error('[SyncManager] Error syncing score:', error)
        await db.scores.update(score.id, {
          sync_status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  /**
   * Process generic sync queue items
   */
  private async syncQueueItems(): Promise<void> {
    const items = await db.syncQueue
      .orderBy('created_at')
      .toArray()

    for (const item of items) {
      try {
        await this.processQueueItem(item)
        await db.syncQueue.delete(item.id!)
      } catch (error) {
        console.error('[SyncManager] Error processing queue item:', error)
        const attempts = (item.attempts || 0) + 1

        if (attempts >= 3) {
          // Give up after 3 attempts
          await db.syncQueue.delete(item.id!)
        } else {
          await db.syncQueue.update(item.id!, {
            attempts,
            last_error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    const { entity_type, action, payload } = item

    switch (action) {
      case 'create':
        await supabase.from(entity_type + 's').insert(payload)
        break
      case 'update':
        await supabase.from(entity_type + 's').update(payload).eq('id', item.entity_id)
        break
      case 'delete':
        await supabase.from(entity_type + 's').delete().eq('id', item.entity_id)
        break
    }
  }

  /**
   * Pull latest data from Supabase and update local DB
   */
  async pullFromServer(tournamentId: string): Promise<void> {
    if (!isOnline() || !isSupabaseConfigured()) return

    try {
      // Fetch tournament data
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single()

      if (tournament) {
        await db.tournaments.put({ ...tournament, synced_at: new Date().toISOString() })
      }

      // Fetch tournament players
      const { data: tournamentPlayers } = await supabase
        .from('tournament_players')
        .select('*, player:players(*)')
        .eq('tournament_id', tournamentId)

      if (tournamentPlayers) {
        for (const tp of tournamentPlayers) {
          const { player, ...tpData } = tp
          await db.tournamentPlayers.put({ ...tpData, synced_at: new Date().toISOString() })
          if (player) {
            await db.players.put({ ...player, synced_at: new Date().toISOString() })
          }
        }
      }

      // Fetch rounds and scores
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*, course:courses(*, holes(*))')
        .eq('tournament_id', tournamentId)

      if (rounds) {
        for (const round of rounds) {
          const { course, ...roundData } = round
          await db.rounds.put({ ...roundData, synced_at: new Date().toISOString() })

          if (course) {
            const { holes, ...courseData } = course
            await db.courses.put({ ...courseData, synced_at: new Date().toISOString() })

            if (holes) {
              for (const hole of holes) {
                await db.holes.put({ ...hole, synced_at: new Date().toISOString() })
              }
            }
          }

          // Fetch scores for this round
          const { data: scores } = await supabase
            .from('scores')
            .select('*')
            .eq('round_id', round.id)

          if (scores) {
            for (const score of scores) {
              // Only update if server version is newer
              const existingScore = await db.scores.get(score.id)
              if (!existingScore || new Date(score.updated_at) > new Date(existingScore.updated_at)) {
                await db.scores.put({
                  ...score,
                  local_id: existingScore?.local_id || score.id,
                  sync_status: 'synced'
                })
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[SyncManager] Error pulling from server:', error)
    }
  }

  /**
   * Force retry all failed items
   */
  async retryFailed(): Promise<void> {
    await db.scores
      .where('sync_status')
      .equals('error')
      .modify({ sync_status: 'pending' })

    this.startSync()
  }

  /**
   * Clear all local data
   */
  async clearLocalData(): Promise<void> {
    await db.scores.clear()
    await db.syncQueue.clear()
    await db.tournaments.clear()
    await db.courses.clear()
    await db.holes.clear()
    await db.players.clear()
    await db.tournamentPlayers.clear()
    await db.rounds.clear()
    this.notifyListeners()
  }
}

export const syncManager = new SyncManager()
