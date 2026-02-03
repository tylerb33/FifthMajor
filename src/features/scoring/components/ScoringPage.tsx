import { useState, useEffect, useRef, useCallback } from 'react'
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
import { getScoreClass } from '@/lib/utils/scoring'
import { QuickScoreEntry } from './QuickScoreEntry'

// Custom hook for swipe gestures
function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const touchEnd = useRef<{ x: number; y: number } | null>(null)

  const minSwipeDistance = 50

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEnd.current = null
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return

    const distanceX = touchStart.current.x - touchEnd.current.x
    const distanceY = touchStart.current.y - touchEnd.current.y
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY)

    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        onSwipeLeft() // Swiped left = next hole
      } else {
        onSwipeRight() // Swiped right = previous hole
      }
    }

    touchStart.current = null
    touchEnd.current = null
  }, [onSwipeLeft, onSwipeRight])

  return { onTouchStart, onTouchMove, onTouchEnd }
}

export function ScoringPage() {
  const navigate = useNavigate()
  const { currentTournamentId, currentRoundId, currentPlayerId, setCurrentRound, setCurrentPlayer } = useTournamentStore()
  const [currentHole, setCurrentHole] = useState(1)
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

  // Fetch available rounds with course info
  const rounds = useLiveQuery(
    async () => {
      if (!currentTournamentId) return []
      const roundsList = await db.rounds
        .where('tournament_id')
        .equals(currentTournamentId)
        .toArray()

      // Get course names for each round
      const courseIds = [...new Set(roundsList.map(r => r.course_id))]
      const courses = await db.courses.bulkGet(courseIds)
      const courseMap = new Map(courses.filter(Boolean).map(c => [c!.id, c!]))

      return roundsList.map(r => ({
        ...r,
        course: courseMap.get(r.course_id)
      })).sort((a, b) => a.round_number - b.round_number)
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

  // Auto-select first incomplete hole when data loads
  useEffect(() => {
    if (hasAutoSelected || !playerScores || !roundWithCourse?.holes) return

    const completedHoles = new Set(playerScores.map(s => s.hole_number))
    const firstIncomplete = roundWithCourse.holes.find(h => !completedHoles.has(h.hole_number))

    if (firstIncomplete) {
      setCurrentHole(firstIncomplete.hole_number)
    } else if (roundWithCourse.holes.length > 0) {
      // All holes complete, go to last hole
      setCurrentHole(18)
    }

    setHasAutoSelected(true)
  }, [playerScores, roundWithCourse?.holes, hasAutoSelected])

  // Reset auto-selection when player or round changes
  useEffect(() => {
    setHasAutoSelected(false)
  }, [currentPlayerId, currentRoundId])

  const currentHoleData = roundWithCourse?.holes.find(h => h.hole_number === currentHole)
  const currentScore = playerScores?.find(s => s.hole_number === currentHole)

  // Handle score update
  const handleScoreUpdate = async (strokes: number) => {
    if (!currentRoundId || !currentPlayerId || !currentHoleData) return

    const now = new Date().toISOString()

    // Query database directly to find existing score (avoids stale state issues)
    const existingScores = await db.scores
      .where('[round_id+tournament_player_id+hole_number]')
      .equals([currentRoundId, currentPlayerId, currentHole])
      .toArray()

    const existingScore = existingScores[0]

    // If there are duplicate scores for this hole, clean them up
    if (existingScores.length > 1) {
      const idsToDelete = existingScores.slice(1).map(s => s.id)
      await db.scores.bulkDelete(idsToDelete)
    }

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
  const goToPreviousHole = useCallback(() => {
    if (currentHole > 1) {
      setCurrentHole(h => h - 1)
    }
  }, [currentHole])

  const goToNextHole = useCallback(() => {
    if (currentHole < 18) {
      setCurrentHole(h => h + 1)
    }
  }, [currentHole])

  // Swipe handlers
  const swipeHandlers = useSwipe(goToNextHole, goToPreviousHole)

  // Get current player's handicap
  const currentPlayerHandicap = tournamentPlayers?.find(tp => tp.id === currentPlayerId)?.handicap ?? 0

  // Calculate total score across all completed holes
  const totalScore = (() => {
    if (!playerScores?.length || !roundWithCourse?.holes) {
      return { gross: 0, net: 0 }
    }

    const gross = playerScores.reduce((sum, s) => sum + s.strokes, 0)
    const completedHoleNumbers = new Set(playerScores.map(s => s.hole_number))
    const parForCompletedHoles = roundWithCourse.holes
      .filter(h => completedHoleNumbers.has(h.hole_number))
      .reduce((sum, h) => sum + h.par, 0)

    // Net = (gross + handicap) - par
    const net = (gross + currentPlayerHandicap) - parForCompletedHoles

    return {
      gross,
      net
    }
  })()

  // No round selected
  if (!currentRoundId || !rounds?.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
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
                      Round {round.round_number} - {round.course?.name || 'No course'}
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
      <div className="flex h-full flex-col items-center justify-center p-4">
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
    <div className="flex h-full flex-col">
      {/* Header with player/round selection */}
      <div className="border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <Select onValueChange={setCurrentPlayer} value={currentPlayerId}>
            <SelectTrigger className="h-8 w-auto border-none bg-transparent px-2 font-medium">
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
          <Select onValueChange={setCurrentRound} value={currentRoundId || undefined}>
            <SelectTrigger className="h-8 w-auto border-none bg-transparent px-2 text-muted-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rounds?.map(round => (
                <SelectItem key={round.id} value={round.id}>
                  R{round.round_number} - {round.course?.name || 'No course'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Total Score Display */}
      <div className="flex items-center justify-center gap-6 border-b py-3">
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums">{totalScore.gross || '-'}</div>
          <div className="text-xs text-muted-foreground">Gross</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <div className={cn(
            "text-2xl font-bold tabular-nums",
            totalScore.net < 0 ? 'text-green-600' : totalScore.net > 0 ? 'text-red-600' : ''
          )}>
            {totalScore.gross ? (totalScore.net === 0 ? 'E' : totalScore.net > 0 ? `+${totalScore.net}` : totalScore.net) : '-'}
          </div>
          <div className="text-xs text-muted-foreground">Net</div>
        </div>
      </div>

      {/* Hole Navigation */}
      <div className="flex items-center justify-between border-b px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousHole}
          disabled={currentHole <= 1}
          className="h-10 w-10"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="flex gap-1 overflow-x-auto px-2 scrollbar-hide">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
            const holeScore = playerScores?.find(s => s.hole_number === hole)
            const holeData = roundWithCourse?.holes.find(h => h.hole_number === hole)
            const isCompleted = !!holeScore

            return (
              <button
                key={hole}
                onClick={() => setCurrentHole(hole)}
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all",
                  hole === currentHole
                    ? "bg-primary text-primary-foreground scale-110 shadow-md"
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
          className="h-10 w-10"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Main Score Entry - with swipe support */}
      <div
        className="flex-1 touch-pan-y"
        {...swipeHandlers}
      >
        {currentHoleData ? (
          <QuickScoreEntry
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
