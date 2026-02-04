import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, AlertCircle, Users, Shield, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const {
    currentTournamentId,
    currentRoundId,
    currentPlayerId,
    identityPlayerId,
    isAdmin,
    setCurrentRound,
    setCurrentPlayer,
    setIdentityPlayer,
    verifyAdminPin
  } = useTournamentStore()
  const [currentHole, setCurrentHole] = useState(1)
  const [hasAutoSelected, setHasAutoSelected] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)

  // Fetch tournament for admin PIN
  const tournament = useLiveQuery(
    () => currentTournamentId ? db.tournaments.get(currentTournamentId) : undefined,
    [currentTournamentId]
  )

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

  // Get identity player's info (for group-based permissions)
  const identityPlayer = tournamentPlayers?.find(tp => tp.id === identityPlayerId)
  const identityGroupNumber = identityPlayer?.group_number

  // Group players by group number
  const playersByGroup = (tournamentPlayers || []).reduce((acc, tp) => {
    const group = tp.group_number || 1
    if (!acc[group]) acc[group] = []
    acc[group].push(tp)
    return acc
  }, {} as Record<number, typeof tournamentPlayers>)

  // Determine which players current user can score for
  const canScoreFor = (playerId: string): boolean => {
    if (isAdmin) return true
    if (!identityPlayerId) return false
    const targetPlayer = tournamentPlayers?.find(tp => tp.id === playerId)
    return targetPlayer?.group_number === identityGroupNumber
  }

  // Check if currently editing someone else's score
  const isEditingOther = currentPlayerId && identityPlayerId && currentPlayerId !== identityPlayerId
  const editingPlayer = tournamentPlayers?.find(tp => tp.id === currentPlayerId)

  // Handle player selection with permission check
  const handlePlayerSelect = (playerId: string) => {
    if (canScoreFor(playerId)) {
      setCurrentPlayer(playerId)
    } else {
      // Need admin access
      setPendingPlayerId(playerId)
      setShowPinDialog(true)
    }
  }

  // Handle admin PIN submission
  const handlePinSubmit = () => {
    if (!tournament) return
    if (verifyAdminPin(pinInput, tournament.admin_pin)) {
      setShowPinDialog(false)
      setPinInput('')
      setPinError('')
      if (pendingPlayerId) {
        setCurrentPlayer(pendingPlayerId)
        setPendingPlayerId(null)
      }
    } else {
      setPinError('Incorrect PIN')
    }
  }

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

  // No identity set - ask who they are
  if (!identityPlayerId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Who are you?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select your name to start scoring. You'll be able to enter scores for yourself and your group members.
            </p>
            {tournamentPlayers && tournamentPlayers.length > 0 ? (
              <Select onValueChange={setIdentityPlayer} value={identityPlayerId || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(playersByGroup).map(([groupNum, players]) => (
                    <SelectGroup key={groupNum}>
                      <SelectLabel>Group {groupNum}</SelectLabel>
                      {players?.map(tp => (
                        <SelectItem key={tp.id} value={tp.id}>
                          {tp.player?.name || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectGroup>
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

  // No player selected for scoring (shouldn't happen with identity set, but just in case)
  if (!currentPlayerId) {
    setCurrentPlayer(identityPlayerId)
    return null
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with player/round selection */}
      <div className="border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <Select onValueChange={handlePlayerSelect} value={currentPlayerId}>
            <SelectTrigger className="h-8 w-auto border-none bg-transparent px-2 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Show identity player's group first */}
              {identityGroupNumber && playersByGroup[identityGroupNumber] && (
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Your Group ({identityGroupNumber})
                  </SelectLabel>
                  {playersByGroup[identityGroupNumber]?.map(tp => (
                    <SelectItem key={tp.id} value={tp.id}>
                      {tp.player?.name || 'Unknown'}
                      {tp.id === identityPlayerId && ' (You)'}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {/* Show other groups for admins or with lock icon */}
              {Object.entries(playersByGroup)
                .filter(([groupNum]) => Number(groupNum) !== identityGroupNumber)
                .map(([groupNum, players]) => (
                  <SelectGroup key={groupNum}>
                    <SelectLabel className="flex items-center gap-1">
                      {!isAdmin && <Lock className="h-3 w-3" />}
                      {isAdmin && <Shield className="h-3 w-3" />}
                      Group {groupNum}
                    </SelectLabel>
                    {players?.map(tp => (
                      <SelectItem key={tp.id} value={tp.id}>
                        {tp.player?.name || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectGroup>
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

      {/* Indicator when editing someone else's scores */}
      {isEditingOther && (
        <div className={cn(
          "flex items-center justify-center gap-2 py-2 text-sm",
          isAdmin ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
        )}>
          {isAdmin ? <Shield className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          <span>
            Entering scores for <strong>{editingPlayer?.player?.name}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setCurrentPlayer(identityPlayerId)}
          >
            Back to me
          </Button>
        </div>
      )}

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

      {/* Admin PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={(open) => {
        setShowPinDialog(open)
        if (!open) {
          setPinInput('')
          setPinError('')
          setPendingPlayerId(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Access Required</DialogTitle>
            <DialogDescription>
              Enter the admin PIN to edit scores for players outside your group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Admin PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className="text-center text-2xl tracking-widest"
              />
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            </div>
            <Button className="w-full" onClick={handlePinSubmit}>
              Verify PIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
