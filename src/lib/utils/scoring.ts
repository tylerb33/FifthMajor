import type { Score, TournamentPlayer, LeaderboardEntry, RoundScore, Hole } from '@/types'

/**
 * Calculate net score from gross score and handicap
 * Net = Gross + Handicap (handicap is negative for good players)
 * Example: 92 gross with -15 handicap = 77 net
 */
export function calculateNetScore(grossScore: number, handicap: number): number {
  return grossScore + handicap
}

/**
 * Calculate gross score from array of hole scores
 */
export function calculateGrossScore(scores: Pick<Score, 'strokes'>[]): number {
  return scores.reduce((total, score) => total + score.strokes, 0)
}

/**
 * Calculate score relative to par
 * Returns a string like "-2", "E", or "+3"
 */
export function formatScoreToPar(score: number, par: number): string {
  const diff = score - par
  if (diff === 0) return 'E'
  if (diff > 0) return `+${diff}`
  return `${diff}`
}

/**
 * Get the score name for a hole (birdie, bogey, etc.)
 */
export function getScoreName(strokes: number, par: number): string {
  const diff = strokes - par

  if (strokes === 1) return 'Hole in One'
  if (diff <= -3) return 'Albatross'
  if (diff === -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double Bogey'
  if (diff === 3) return 'Triple Bogey'
  return `+${diff}`
}

/**
 * Get CSS class for score styling based on relation to par
 */
export function getScoreClass(strokes: number, par: number): string {
  const diff = strokes - par

  if (diff <= -2) return 'text-green-700 bg-green-100' // Eagle or better
  if (diff === -1) return 'text-green-600 bg-green-50' // Birdie
  if (diff === 0) return 'text-gray-700' // Par
  if (diff === 1) return 'text-orange-600 bg-orange-50' // Bogey
  if (diff === 2) return 'text-red-500 bg-red-50' // Double bogey
  return 'text-red-700 bg-red-100' // Triple bogey or worse
}

/**
 * Calculate leaderboard entries from scores
 */
export function calculateLeaderboard(
  tournamentPlayers: (TournamentPlayer & { player: { name: string } })[],
  scoresByPlayer: Map<string, { roundId: string; roundNumber: number; scores: Score[] }[]>,
  _courseParByRound: Map<string, number>
): LeaderboardEntry[] {
  return tournamentPlayers.map(tp => {
    const playerRounds = scoresByPlayer.get(tp.id) || []

    const roundScores: RoundScore[] = playerRounds.map(round => {
      const gross = calculateGrossScore(round.scores)
      const holesCompleted = round.scores.length

      return {
        round_id: round.roundId,
        round_number: round.roundNumber,
        gross,
        net: gross + tp.handicap,
        holes_completed: holesCompleted
      }
    })

    const totalGross = roundScores.reduce((sum, r) => sum + r.gross, 0)
    const totalNet = roundScores.reduce((sum, r) => sum + r.net, 0)

    // For current round display
    const currentRound = roundScores[roundScores.length - 1]

    return {
      tournament_player_id: tp.id,
      player_name: tp.player.name,
      handicap: tp.handicap,
      group_number: tp.group_number,
      gross_score: currentRound?.gross || 0,
      net_score: currentRound?.net || 0,
      holes_completed: currentRound?.holes_completed || 0,
      round_scores: roundScores,
      total_gross: totalGross,
      total_net: totalNet
    }
  }).sort((a, b) => {
    // Sort by total net score (lower is better)
    // If tied, sort by total gross
    if (a.total_net !== b.total_net) return a.total_net - b.total_net
    return a.total_gross - b.total_gross
  })
}

/**
 * Calculate running score through a specific hole
 */
export function calculateRunningScore(
  scores: Score[],
  throughHole: number,
  holes: Hole[]
): { gross: number; toPar: number } {
  const relevantScores = scores.filter(s => s.hole_number <= throughHole)
  const gross = calculateGrossScore(relevantScores)

  const parThroughHole = holes
    .filter(h => h.hole_number <= throughHole)
    .reduce((sum, h) => sum + h.par, 0)

  return {
    gross,
    toPar: gross - parThroughHole
  }
}

/**
 * Get default strokes for a hole based on par
 */
export function getDefaultStrokes(par: number): number {
  return par
}

/**
 * Validate a score entry
 */
export function validateScore(strokes: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(strokes)) {
    return { valid: false, error: 'Score must be a whole number' }
  }
  if (strokes < 1) {
    return { valid: false, error: 'Score must be at least 1' }
  }
  if (strokes > 15) {
    return { valid: false, error: 'Score cannot exceed 15' }
  }
  return { valid: true }
}
