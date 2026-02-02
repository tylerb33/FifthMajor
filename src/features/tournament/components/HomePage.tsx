import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Plus, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useTournamentStore } from '@/stores/tournamentStore'
import { db } from '@/lib/db/schema'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

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
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo/Hero */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Trophy className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold">FifthMajor</h1>
          <p className="mt-2 text-muted-foreground">
            Golf tournament scoring made simple
          </p>
        </div>

        {/* Join Tournament */}
        <Card>
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
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button
              className="w-full"
              onClick={handleJoin}
              disabled={isJoining}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isJoining ? 'Joining...' : 'Join Tournament'}
            </Button>
          </CardContent>
        </Card>

        {/* Create Tournament */}
        <div className="text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Or start a new tournament
          </p>
          <Button
            variant="outline"
            className="w-full"
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
