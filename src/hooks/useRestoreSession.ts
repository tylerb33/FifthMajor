import { useEffect, useState } from 'react'
import { useTournamentStore } from '@/stores/tournamentStore'
import { syncManager } from '@/lib/sync/SyncManager'
import { db } from '@/lib/db/schema'
import { isSupabaseConfigured } from '@/lib/supabase'
import { isOnline } from '@/lib/utils'

/**
 * Hook that restores tournament data from Supabase when:
 * - A tournament ID is stored in localStorage
 * - But the tournament data is missing from IndexedDB (e.g., after cache clear)
 *
 * This ensures the app recovers gracefully after a hard refresh.
 */
export function useRestoreSession() {
  const { currentTournamentId, clearSession } = useTournamentStore()
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function restoreIfNeeded() {
      if (!currentTournamentId) return

      try {
        // Check if tournament exists in local DB
        const localTournament = await db.tournaments.get(currentTournamentId)

        if (localTournament) {
          // Data exists locally, nothing to restore
          return
        }

        // Tournament ID exists but no local data - need to restore from server
        console.log('[useRestoreSession] Local data missing, attempting to restore from server')

        if (!isOnline()) {
          setError('You are offline. Unable to restore tournament data.')
          return
        }

        if (!isSupabaseConfigured()) {
          setError('Server not configured. Unable to restore tournament data.')
          clearSession()
          return
        }

        setIsRestoring(true)
        setError(null)

        // Pull tournament data from Supabase
        await syncManager.pullFromServer(currentTournamentId)

        // Verify data was restored
        const restoredTournament = await db.tournaments.get(currentTournamentId)

        if (!restoredTournament) {
          // Tournament doesn't exist on server either - clear the stale session
          console.warn('[useRestoreSession] Tournament not found on server, clearing session')
          setError('Tournament not found. It may have been deleted.')
          clearSession()
        } else {
          console.log('[useRestoreSession] Successfully restored tournament data')
        }
      } catch (err) {
        console.error('[useRestoreSession] Error restoring session:', err)
        setError('Failed to restore tournament data. Please try again.')
      } finally {
        setIsRestoring(false)
      }
    }

    restoreIfNeeded()
  }, [currentTournamentId, clearSession])

  return { isRestoring, error }
}
