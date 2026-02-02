import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface TournamentState {
  // Current tournament context
  currentTournamentId: string | null
  currentRoundId: string | null
  currentPlayerId: string | null // Tournament player ID for score entry
  isAdmin: boolean

  // Actions
  setCurrentTournament: (id: string | null) => void
  setCurrentRound: (id: string | null) => void
  setCurrentPlayer: (id: string | null) => void
  setIsAdmin: (isAdmin: boolean) => void
  verifyAdminPin: (pin: string, correctPin: string) => boolean
  clearSession: () => void
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set) => ({
      currentTournamentId: null,
      currentRoundId: null,
      currentPlayerId: null,
      isAdmin: false,

      setCurrentTournament: (id) => set({ currentTournamentId: id }),
      setCurrentRound: (id) => set({ currentRoundId: id }),
      setCurrentPlayer: (id) => set({ currentPlayerId: id }),
      setIsAdmin: (isAdmin) => set({ isAdmin }),

      verifyAdminPin: (pin, correctPin) => {
        const isValid = pin === correctPin
        if (isValid) {
          set({ isAdmin: true })
        }
        return isValid
      },

      clearSession: () => set({
        currentTournamentId: null,
        currentRoundId: null,
        currentPlayerId: null,
        isAdmin: false
      })
    }),
    {
      name: 'fifthmajor-tournament',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentTournamentId: state.currentTournamentId,
        currentRoundId: state.currentRoundId,
        currentPlayerId: state.currentPlayerId
        // Don't persist isAdmin for security
      })
    }
  )
)
