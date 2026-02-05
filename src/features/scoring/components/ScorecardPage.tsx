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
import { db } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { getScoreClass, formatScoreToPar } from '@/lib/utils/scoring'

export function ScorecardPage() {
  const {
    currentTournamentId,
    currentRoundId,
    currentPlayerId,
    setCurrentRound,
    setCurrentPlayer
  } = useTournamentStore()

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

  // Fetch tournament players
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

  // Fetch course and holes
  const courseData = useLiveQuery(
    async () => {
      if (!currentRoundId) return null
      const round = await db.rounds.get(currentRoundId)
      if (!round) return null

      const course = await db.courses.get(round.course_id)
      const holes = course ? await db.holes
        .where('course_id')
        .equals(course.id)
        .sortBy('hole_number') : []

      return { course, holes }
    },
    [currentRoundId]
  )

  // Fetch scores for selected player and round
  const scores = useLiveQuery(
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

  const selectedPlayer = tournamentPlayers?.find(tp => tp.id === currentPlayerId)

  // Calculate totals
  const frontNine = courseData?.holes.filter(h => h.hole_number <= 9) || []
  const backNine = courseData?.holes.filter(h => h.hole_number > 9) || []

  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0)
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0)
  const totalPar = (courseData?.course?.par || 72)

  const frontNineScore = scores?.filter(s => s.hole_number <= 9).reduce((sum, s) => sum + s.strokes, 0) || 0
  const backNineScore = scores?.filter(s => s.hole_number > 9).reduce((sum, s) => sum + s.strokes, 0) || 0
  const totalScore = frontNineScore + backNineScore

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Scorecard</h1>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          value={currentRoundId || undefined}
          onValueChange={setCurrentRound}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select round" />
          </SelectTrigger>
          <SelectContent>
            {rounds?.map(round => (
              <SelectItem key={round.id} value={round.id}>
                Round {round.round_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentPlayerId || undefined}
          onValueChange={setCurrentPlayer}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select player" />
          </SelectTrigger>
          <SelectContent>
            {tournamentPlayers?.map(tp => (
              <SelectItem key={tp.id} value={tp.id}>
                {tp.player?.name || 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {currentRoundId && currentPlayerId && courseData ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>{selectedPlayer?.player?.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                Handicap: {selectedPlayer?.handicap}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-center text-sm">
                {/* Front 9 */}
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-medium">Hole</th>
                    {frontNine.map(h => (
                      <th key={h.id} className="px-2 py-1.5 font-medium">{h.hole_number}</th>
                    ))}
                    <th className="px-2 py-1.5 font-medium bg-muted-foreground/10">Out</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-2 py-1.5 text-left text-muted-foreground">Par</td>
                    {frontNine.map(h => (
                      <td key={h.id} className="px-2 py-1.5">{h.par}</td>
                    ))}
                    <td className="px-2 py-1.5 font-medium bg-muted/30">{frontNinePar}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-2 py-1.5 text-left font-medium">Score</td>
                    {frontNine.map(h => {
                      const score = scores?.find(s => s.hole_number === h.hole_number)
                      return (
                        <td
                          key={h.id}
                          className={cn(
                            "px-2 py-1.5 font-medium",
                            score && getScoreClass(score.strokes, h.par)
                          )}
                        >
                          {score?.strokes || '-'}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5 font-bold bg-muted/30">
                      {frontNineScore || '-'}
                    </td>
                  </tr>
                </tbody>

                {/* Back 9 */}
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-medium">Hole</th>
                    {backNine.map(h => (
                      <th key={h.id} className="px-2 py-1.5 font-medium">{h.hole_number}</th>
                    ))}
                    <th className="px-2 py-1.5 font-medium bg-muted-foreground/10">In</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-2 py-1.5 text-left text-muted-foreground">Par</td>
                    {backNine.map(h => (
                      <td key={h.id} className="px-2 py-1.5">{h.par}</td>
                    ))}
                    <td className="px-2 py-1.5 font-medium bg-muted/30">{backNinePar}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 text-left font-medium">Score</td>
                    {backNine.map(h => {
                      const score = scores?.find(s => s.hole_number === h.hole_number)
                      return (
                        <td
                          key={h.id}
                          className={cn(
                            "px-2 py-1.5 font-medium",
                            score && getScoreClass(score.strokes, h.par)
                          )}
                        >
                          {score?.strokes || '-'}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5 font-bold bg-muted/30">
                      {backNineScore || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t bg-muted/50 p-3">
                <div className="flex justify-around text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">Gross</div>
                    <div className="text-xl font-bold">{totalScore || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">To Par</div>
                    <div className={cn(
                      "text-xl font-bold",
                      totalScore && (totalScore - totalPar < 0 ? 'text-green-600' : totalScore - totalPar > 0 ? 'text-red-600' : '')
                    )}>
                      {totalScore ? formatScoreToPar(totalScore, totalPar) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Net</div>
                    <div className="text-xl font-bold">
                      {totalScore ? totalScore + (selectedPlayer?.handicap || 0) : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a round and player to view scorecard
          </CardContent>
        </Card>
      )}
    </div>
  )
}
