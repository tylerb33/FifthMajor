import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId, type LocalScore } from '@/lib/db/schema'
import { syncManager } from '@/lib/sync/SyncManager'
import { cn } from '@/lib/utils'
import { getScoreClass, formatScoreToPar, calculateRunningScore } from '@/lib/utils/scoring'
import { HoleScoreEntry } from './HoleScoreEntry'

export function ScoringPage() {
  const navigate = useNavigate()
  const { currentTournamentId, currentRoundId, currentPlayerId, setCurrentRound, setCurrentPlayer } = useTournamentStore()
  const [currentHole, setCurrentHole] = useState(1)

  // Fetch available rounds
  const rounds = useLiveQuery(
    async () => {
      if (!currentTournamentId) return []
      return db.rounds
        .where('tournament_id')
        .equals(currentTournamentId)
        .toArray()
    },
    [currentTournamentId]
  )

  // Fetch tournament players for selection
  const tournamentPlayers = useLiveQuery(
    async () => {
      if (!currentTournamentId) return []
      const tps = await db.tournamentPlayers
        .where('tournament_id')
        .equals(currentTournamentId)
        .toArray()

      const playerIds = tps.map(tp => tp.player_id)
      const players = await db.players.bulkGet(playerIds)
      const playerMap = new Map(players.filter(Boolean).map(p => [p!.id, p!]))

      return tps.map(tp => ({
        ...tp,
        player: playerMap.get(tp.player_id)
      })).sort((a, b) => (a.player?.name || '').localeCompare(b.player?.name || ''))
    },
    [currentTournamentId]
  )

  // Fetch course and holes for current round
  const roundWithCourse = useLiveQuery(
    async () => {
      if (!currentRoundId) return null
      const round = await db.rounds.get(currentRoundId)
      if (!round) return null

      const course = await db.courses.get(round.course_id)
      const holes = course ? await db.holes
        .where('course_id')
        .equals(course.id)
        .sortBy('hole_number') : []

      return { round, course, holes }
    },
    [currentRoundId]
  )

  // Fetch current player's scores for this round
  const playerScores = useLiveQuery(
    async () => {
      if (!currentRoundId || !currentPlayerId) return []
      return db.scores
        .where('[round_id+tournament_player_id+hole_number]')
        .between(
          [currentRoundId, currentPlayerId, 0],
          [currentRoundId, currentPlayerId, 19]
        )
        .toArray()
    },
    [currentRoundId, currentPlayerId]
  )

  const currentHoleData = roundWithCourse?.holes.find(h => h.hole_number === currentHole)
  const currentScore = playerScores?.find(s => s.hole_number === currentHole)

  // Handle score update
  const handleScoreUpdate = async (strokes: number) => {
    if (!currentRoundId || !currentPlayerId || !currentHoleData) return

    const now = new Date().toISOString()
    const existingScore = playerScores?.find(s => s.hole_number === currentHole)

    const scoreData: LocalScore = {
      id: existingScore?.id || generateLocalId(),
      local_id: existingScore?.local_id || generateLocalId(),
      round_id: currentRoundId,
      tournament_player_id: currentPlayerId,
      hole_number: currentHole,
      strokes,
      created_at: existingScore?.created_at || now,
      updated_at: now,
      sync_status: 'pending'
    }

    // Save locally
    await db.scores.put(scoreData)

    // Queue for sync
    syncManager.queueScore(scoreData)
  }

  // Navigation
  const goToHole = (hole: number) => {
    if (hole >= 1 && hole <= 18) {
      setCurrentHole(hole)
    }
  }

  const goToPreviousHole = () => goToHole(currentHole - 1)
  const goToNextHole = () => goToHole(currentHole + 1)

  // Calculate running score
  const runningScore = roundWithCourse?.holes && playerScores
    ? calculateRunningScore(playerScores as any, currentHole, roundWithCourse.holes as any)
    : { gross: 0, toPar: 0 }

  // No round selected
  if (!currentRoundId || !rounds?.length) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Select Round</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rounds && rounds.length > 0 ? (
              <Select onValueChange={setCurrentRound} value={currentRoundId || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a round" />
                </SelectTrigger>
                <SelectContent>
                  {rounds.map(round => (
                    <SelectItem key={round.id} value={round.id}>
                      Round {round.round_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-center text-muted-foreground">
                <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                <p>No rounds created yet</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => navigate('/settings')}
                >
                  Go to Settings to create a round
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // No player selected
  if (!currentPlayerId) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Select Player</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tournamentPlayers && tournamentPlayers.length > 0 ? (
              <Select onValueChange={setCurrentPlayer} value={currentPlayerId || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Who's scoring?" />
                </SelectTrigger>
                <SelectContent>
                  {tournamentPlayers.map(tp => (
                    <SelectItem key={tp.id} value={tp.id}>
                      {tp.player?.name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-center text-muted-foreground">
                <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                <p>No players in tournament</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => navigate('/players')}
                >
                  Go to Players to add some
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      {/* Header with player/round selection */}
      <div className="border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <Select onValueChange={setCurrentPlayer} value={currentPlayerId}>
            <SelectTrigger className="h-8 w-auto border-none bg-transparent px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tournamentPlayers?.map(tp => (
                <SelectItem key={tp.id} value={tp.id}>
                  {tp.player?.name || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-muted-foreground">
            {roundWithCourse?.course?.name || 'Course'} - R{roundWithCourse?.round.round_number}
          </div>
        </div>
      </div>

      {/* Running Score Display */}
      <div className="flex items-center justify-center gap-4 border-b py-3">
        <div className="text-center">
          <div className="text-2xl font-bold">{runningScore.gross || '-'}</div>
          <div className="text-xs text-muted-foreground">Gross</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <div className={cn(
            "text-2xl font-bold",
            runningScore.toPar < 0 ? 'text-green-600' : runningScore.toPar > 0 ? 'text-red-600' : ''
          )}>
            {formatScoreToPar(runningScore.gross, roundWithCourse?.holes?.slice(0, currentHole).reduce((sum, h) => sum + h.par, 0) || 0)}
          </div>
          <div className="text-xs text-muted-foreground">To Par</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <div className="text-2xl font-bold">
            {playerScores?.length || 0}/18
          </div>
          <div className="text-xs text-muted-foreground">Holes</div>
        </div>
      </div>

      {/* Hole Navigation */}
      <div className="flex items-center justify-between border-b px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousHole}
          disabled={currentHole <= 1}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="flex gap-1 overflow-x-auto px-2">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
            const holeScore = playerScores?.find(s => s.hole_number === hole)
            const holeData = roundWithCourse?.holes.find(h => h.hole_number === hole)
            const isCompleted = !!holeScore

            return (
              <button
                key={hole}
                onClick={() => setCurrentHole(hole)}
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  hole === currentHole
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                      ? holeData ? getScoreClass(holeScore.strokes, holeData.par) : "bg-green-100"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {hole}
              </button>
            )
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextHole}
          disabled={currentHole >= 18}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Main Score Entry */}
      <div className="flex-1 p-4">
        {currentHoleData ? (
          <HoleScoreEntry
            hole={currentHoleData}
            currentStrokes={currentScore?.strokes}
            onScoreChange={handleScoreUpdate}
            onNext={currentHole < 18 ? goToNextHole : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No hole data available
          </div>
        )}
      </div>
    </div>
  )
}
