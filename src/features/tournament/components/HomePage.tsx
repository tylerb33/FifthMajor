import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useTournamentStore } from '@/stores/tournamentStore'
import { db } from '@/lib/db/schema'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { syncManager } from '@/lib/sync/SyncManager'

export function HomePage() {
  const navigate = useNavigate()
  const { setCurrentTournament } = useTournamentStore()
  const [shareCode, setShareCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    if (!shareCode.trim()) {
      setError('Please enter a share code')
      return
    }

    setIsJoining(true)
    setError('')

    try {
      // First check local DB
      const localTournament = await db.tournaments
        .where('share_code')
        .equalsIgnoreCase(shareCode.trim())
        .first()

      if (localTournament) {
        setCurrentTournament(localTournament.id)
        navigate('/leaderboard')
        return
      }

      // If Supabase is configured, check there
      if (isSupabaseConfigured()) {
        const { data, error: fetchError } = await supabase
          .from('tournaments')
          .select('*')
          .ilike('share_code', shareCode.trim())
          .single()

        if (fetchError || !data) {
          setError('Tournament not found. Check the code and try again.')
          return
        }

        // Save to local DB
        await db.tournaments.put({
          ...data,
          synced_at: new Date().toISOString()
        })

        // Pull all related data (players, rounds, scores, etc.)
        await syncManager.pullFromServer(data.id)

        setCurrentTournament(data.id)
        navigate('/leaderboard')
      } else {
        setError('Tournament not found locally. Connect to sync with server.')
      }
    } catch (err) {
      console.error('Error joining tournament:', err)
      setError('Failed to join tournament. Please try again.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-green-200 via-white to-amber-50/30">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo/Hero */}
        <div className="text-center space-y-4">
          <div className="relative">
            {/* Subtle glow behind logo */}
            <div className="absolute inset-0 blur-2xl opacity-20 bg-gradient-to-r from-green-500 to-amber-500 -z-10 scale-150" />
            <img
              src="/FifthMajorLogo.png"
              alt="Fifth Major"
              className="mx-auto h-36 w-auto object-contain drop-shadow-xl"
            />
          </div>
          <p
            className="text-xl text-foreground/60 italic tracking-wide leading-relaxed"
            style={{ fontFamily: '"Playfair Display", serif' }}
          >
            A tradition like any other
          </p>
        </div>

        {/* Join Tournament */}
        <Card className="border-2 border-primary/10 shadow-lg bg-gradient-to-br from-white to-green-50/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Join Tournament</CardTitle>
            <CardDescription>Enter the share code to join</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shareCode">Share Code</Label>
              <Input
                id="shareCode"
                placeholder="e.g., GOLF24"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest font-semibold bg-green-50/30 border-primary/20 focus:border-primary/50 focus:ring-primary/20"
                maxLength={6}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button
              className="w-full shadow-md hover:shadow-lg transition-all"
              onClick={handleJoin}
              disabled={isJoining}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isJoining ? 'Joining...' : 'Join Tournament'}
            </Button>
          </CardContent>
        </Card>

        {/* Create Tournament */}
        <div className="text-center p-6 rounded-lg bg-gradient-to-br from-amber-50/50 to-transparent border border-amber-200/30">
          <Button
            variant="outline"
            className="w-full border-primary/20 hover:bg-primary/5"
            onClick={() => navigate('/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Tournament
          </Button>
        </div>
      </div>
    </div>
  )
}
