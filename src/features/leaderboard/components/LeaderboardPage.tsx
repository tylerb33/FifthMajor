import { useState, useEffect } from 'react'
import { RefreshCw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/schema'
import { syncManager } from '@/lib/sync/SyncManager'
import { cn } from '@/lib/utils'
import { useRealtimeScores } from '../hooks/useRealtimeScores'

export function LeaderboardPage() {
  const { currentTournamentId } = useTournamentStore()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedRound, setSelectedRound] = useState<string>('all')

  // Set up real-time subscription
  useRealtimeScores(currentTournamentId)

  // Fetch tournament
  const tournament = useLiveQuery(
    () => currentTournamentId ? db.tournaments.get(currentTournamentId) : undefined,
    [currentTournamentId]
  )

  // Fetch rounds
  const rounds = useLiveQuery(
    async () => {
      if (!currentTournamentId) return []
      return db.rounds
        .where('tournament_id')
        .equals(currentTournamentId)
        .sortBy('round_number')
    },
    [currentTournamentId]
  )

  // Fetch all players and their scores
  const leaderboard = useLiveQuery(
    async () => {
      if (!currentTournamentId) return []

      // Get all tournament players
      const tps = await db.tournamentPlayers
        .where('tournament_id')
        .equals(currentTournamentId)
        .toArray()

      // Get player names
      const playerIds = tps.map(tp => tp.player_id)
      const players = await db.players.bulkGet(playerIds)
      const playerMap = new Map(players.filter(Boolean).map(p => [p!.id, p!]))

      // Get all rounds
      const allRounds = await db.rounds
        .where('tournament_id')
        .equals(currentTournamentId)
        .toArray()

      // Get course par for each round
      const courseIds = [...new Set(allRounds.map(r => r.course_id))]
      const courses = await db.courses.bulkGet(courseIds)
      const courseMap = new Map(courses.filter(Boolean).map(c => [c!.id, c!]))

      // Build leaderboard entries
      const entries = await Promise.all(tps.map(async (tp) => {
        const playerName = playerMap.get(tp.player_id)?.name || 'Unknown'

        // Get all scores for this player
        const scores = await db.scores
          .where('tournament_player_id')
          .equals(tp.id)
          .toArray()

        // Group scores by round
        const scoresByRound = scores.reduce((acc, score) => {
          if (!acc[score.round_id]) acc[score.round_id] = []
          acc[score.round_id].push(score)
          return acc
        }, {} as Record<string, typeof scores>)

        // Calculate per-round scores
        const roundScores = allRounds.map(round => {
          const roundScoresList = scoresByRound[round.id] || []
          const gross = roundScoresList.reduce((sum, s) => sum + s.strokes, 0)
          const course = courseMap.get(round.course_id)
          const coursePar = course?.par || 72

          return {
            roundId: round.id,
            roundNumber: round.round_number,
            gross,
            holesCompleted: roundScoresList.length,
            coursePar
          }
        })

        // Calculate totals
        const totalGross = roundScores.reduce((sum, r) => sum + r.gross, 0)
        const totalPar = roundScores.reduce((sum, r) => {
          // Only count par for completed holes
          const holesRatio = r.holesCompleted / 18
          return sum + Math.round(r.coursePar * holesRatio)
        }, 0)
        const totalHolesCompleted = roundScores.reduce((sum, r) => sum + r.holesCompleted, 0)

        return {
          tournamentPlayerId: tp.id,
          playerName,
          handicap: tp.handicap,
          groupNumber: tp.group_number,
          roundScores,
          totalGross,
          totalNet: totalGross + tp.handicap,
          totalPar,
          totalHolesCompleted
        }
      }))

      // Sort by net score (ascending - lower is better)
      return entries.sort((a, b) => {
        // If both have completed the same rounds, compare net scores
        if (a.totalHolesCompleted === b.totalHolesCompleted) {
          return a.totalNet - b.totalNet
        }
        // Otherwise, players with more holes completed rank higher
        return b.totalHolesCompleted - a.totalHolesCompleted
      })
    },
    [currentTournamentId]
  )

  const handleRefresh = async () => {
    if (!currentTournamentId) return
    setIsRefreshing(true)
    await syncManager.pullFromServer(currentTournamentId)
    setIsRefreshing(false)
  }

  // Auto-select first round if available
  useEffect(() => {
    if (rounds?.length && selectedRound === 'all') {
      // Keep 'all' selected by default
    }
  }, [rounds, selectedRound])

  if (!tournament) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <img
            src="/FifthMajorLogo.png"
            alt="Fifth Major"
            className="mx-auto mb-4 h-24 w-auto object-contain"
          />
          <p>No tournament selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-muted-foreground">
            {tournament.status === 'completed' ? 'Final Results' : 'Live Leaderboard'}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Round Tabs */}
      <Tabs value={selectedRound} onValueChange={setSelectedRound}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">Overall</TabsTrigger>
          {rounds?.map(round => (
            <TabsTrigger key={round.id} value={round.id} className="flex-1">
              R{round.round_number}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overall Leaderboard */}
        <TabsContent value="all" className="mt-4">
          <LeaderboardTable
            entries={leaderboard || []}
            showAllRounds
            rounds={rounds || []}
          />
        </TabsContent>

        {/* Per-Round Leaderboards */}
        {rounds?.map(round => (
          <TabsContent key={round.id} value={round.id} className="mt-4">
            <LeaderboardTable
              entries={leaderboard || []}
              roundId={round.id}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

interface LeaderboardEntry {
  tournamentPlayerId: string
  playerName: string
  handicap: number
  groupNumber: number
  roundScores: {
    roundId: string
    roundNumber: number
    gross: number
    holesCompleted: number
    coursePar: number
  }[]
  totalGross: number
  totalNet: number
  totalPar: number
  totalHolesCompleted: number
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  showAllRounds?: boolean
  rounds?: { id: string; round_number: number }[]
  roundId?: string
}

function LeaderboardTable({ entries, showAllRounds, rounds, roundId }: LeaderboardTableProps) {
  // Filter and sort based on view
  const sortedEntries = [...entries].sort((a, b) => {
    if (roundId) {
      const aRound = a.roundScores.find(r => r.roundId === roundId)
      const bRound = b.roundScores.find(r => r.roundId === roundId)
      const aNet = (aRound?.gross || 0) + a.handicap
      const bNet = (bRound?.gross || 0) + b.handicap
      return aNet - bNet
    }
    return a.totalNet - b.totalNet
  })

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No scores recorded yet
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-sm">
              <th className="px-3 py-2 font-medium">Pos</th>
              <th className="px-3 py-2 font-medium">Player</th>
              {showAllRounds && rounds?.map(r => (
                <th key={r.id} className="px-3 py-2 text-center font-medium">
                  R{r.round_number}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium">Gross</th>
              <th className="px-3 py-2 text-center font-medium">Net</th>
              <th className="px-3 py-2 text-center font-medium">Thru</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry, index) => {
              const roundData = roundId
                ? entry.roundScores.find(r => r.roundId === roundId)
                : null
              const gross = roundId ? (roundData?.gross || 0) : entry.totalGross
              const net = roundId ? gross + entry.handicap : entry.totalNet
              const holes = roundId ? (roundData?.holesCompleted || 0) : entry.totalHolesCompleted
              const par = roundId ? (roundData?.coursePar || 72) : entry.totalPar

              // Calculate position (handle ties)
              let position = index + 1
              if (index > 0) {
                const prevEntry = sortedEntries[index - 1]
                const prevNet = roundId
                  ? (prevEntry.roundScores.find(r => r.roundId === roundId)?.gross || 0) + prevEntry.handicap
                  : prevEntry.totalNet
                if (net === prevNet) {
                  position = parseInt(String(index).replace(/T$/, '')) || index
                }
              }

              return (
                <tr key={entry.tournamentPlayerId} className="border-b last:border-0">
                  <td className="px-3 py-3 font-medium">
                    {index === 0 ? (
                      <span className="flex items-center gap-1">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        {position}
                      </span>
                    ) : (
                      position
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{entry.playerName}</div>
                    <div className="text-xs text-muted-foreground">
                      Hcp: {entry.handicap > 0 ? `+${entry.handicap}` : entry.handicap}
                    </div>
                  </td>
                  {showAllRounds && rounds?.map(r => {
                    const rd = entry.roundScores.find(rs => rs.roundId === r.id)
                    return (
                      <td key={r.id} className="px-3 py-3 text-center">
                        {rd && rd.holesCompleted > 0 ? rd.gross : '-'}
                      </td>
                    )
                  })}
                  <td className="px-3 py-3 text-center">{gross || '-'}</td>
                  <td className={cn(
                    "px-3 py-3 text-center font-semibold",
                    holes > 0 && (net - par < 0 ? 'text-green-600' : net - par > 0 ? 'text-red-600' : '')
                  )}>
                    {holes > 0 ? net : '-'}
                  </td>
                  <td className="px-3 py-3 text-center text-muted-foreground">
                    {holes > 0 ? (holes === 18 ? 'F' : holes) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
