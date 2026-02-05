import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTournamentStore } from '@/stores/tournamentStore'

/**
 * Hook that syncs tournament state with URL search parameters.
 * This ensures the URL contains all necessary state to restore the view after a refresh.
 *
 * URL params:
 * - t: tournament ID
 * - r: round ID
 * - p: player ID (current player being viewed/edited)
 * - i: identity player ID (who the user is)
 */
export function useUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    currentTournamentId,
    currentRoundId,
    currentPlayerId,
    identityPlayerId,
    setCurrentTournament,
    setCurrentRound,
    setCurrentPlayer,
    setIdentityPlayer
  } = useTournamentStore()

  // On mount: restore state from URL if present
  useEffect(() => {
    const urlTournamentId = searchParams.get('t')
    const urlRoundId = searchParams.get('r')
    const urlPlayerId = searchParams.get('p')
    const urlIdentityId = searchParams.get('i')

    // If URL has state that differs from store, update store
    if (urlTournamentId && urlTournamentId !== currentTournamentId) {
      setCurrentTournament(urlTournamentId)
    }
    if (urlRoundId && urlRoundId !== currentRoundId) {
      setCurrentRound(urlRoundId)
    }
    if (urlPlayerId && urlPlayerId !== currentPlayerId) {
      setCurrentPlayer(urlPlayerId)
    }
    if (urlIdentityId && urlIdentityId !== identityPlayerId) {
      setIdentityPlayer(urlIdentityId)
    }
  }, []) // Only run on mount

  // When store state changes, update URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    let changed = false

    // Update tournament ID
    if (currentTournamentId) {
      if (params.get('t') !== currentTournamentId) {
        params.set('t', currentTournamentId)
        changed = true
      }
    } else if (params.has('t')) {
      params.delete('t')
      changed = true
    }

    // Update round ID
    if (currentRoundId) {
      if (params.get('r') !== currentRoundId) {
        params.set('r', currentRoundId)
        changed = true
      }
    } else if (params.has('r')) {
      params.delete('r')
      changed = true
    }

    // Update player ID
    if (currentPlayerId) {
      if (params.get('p') !== currentPlayerId) {
        params.set('p', currentPlayerId)
        changed = true
      }
    } else if (params.has('p')) {
      params.delete('p')
      changed = true
    }

    // Update identity ID
    if (identityPlayerId) {
      if (params.get('i') !== identityPlayerId) {
        params.set('i', identityPlayerId)
        changed = true
      }
    } else if (params.has('i')) {
      params.delete('i')
      changed = true
    }

    if (changed) {
      setSearchParams(params, { replace: true })
    }
  }, [currentTournamentId, currentRoundId, currentPlayerId, identityPlayerId, searchParams, setSearchParams])
}
