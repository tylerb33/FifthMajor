import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/lib/db/schema'

export function useRealtimeScores(tournamentId: string | null) {
  useEffect(() => {
    if (!tournamentId || !isSupabaseConfigured()) return

    // Subscribe to score changes for this tournament's rounds
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores'
        },
        async (payload) => {
          console.log('[Realtime] Score change:', payload)

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const score = payload.new as {
              id: string
              round_id: string
              tournament_player_id: string
              hole_number: number
              strokes: number
              created_at: string
              updated_at: string
            }

            // Update local DB
            const existing = await db.scores.get(score.id)
            if (!existing || new Date(score.updated_at) > new Date(existing.updated_at)) {
              await db.scores.put({
                ...score,
                local_id: existing?.local_id || score.id,
                sync_status: 'synced'
              })
            }
          } else if (payload.eventType === 'DELETE') {
            const score = payload.old as { id: string }
            await db.scores.delete(score.id)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `tournament_id=eq.${tournamentId}`
        },
        async (payload) => {
          console.log('[Realtime] Tournament player change:', payload)

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const tp = payload.new as {
              id: string
              tournament_id: string
              player_id: string
              handicap: number
              group_number: number
            }
            await db.tournamentPlayers.put({
              ...tp,
              synced_at: new Date().toISOString()
            })

            // Also fetch player if new
            if (payload.eventType === 'INSERT') {
              const { data: player } = await supabase
                .from('players')
                .select('*')
                .eq('id', tp.player_id)
                .single()

              if (player) {
                await db.players.put({
                  ...player,
                  synced_at: new Date().toISOString()
                })
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId])
}
