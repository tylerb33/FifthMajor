import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getScoreName, getScoreClass } from '@/lib/utils/scoring'
import { Celebration } from '@/components/Celebration'
import type { Hole } from '@/types'

interface QuickScoreEntryProps {
  hole: Hole
  currentStrokes?: number
  onScoreChange: (strokes: number) => void
  onNext?: () => void
}

// Trigger haptic feedback if available
function triggerHaptic(intensity: 'light' | 'medium' | 'heavy' = 'medium') {
  if ('vibrate' in navigator) {
    const duration = intensity === 'light' ? 10 : intensity === 'medium' ? 25 : 50
    navigator.vibrate(duration)
  }
}

export function QuickScoreEntry({
  hole,
  currentStrokes,
  onScoreChange,
  onNext
}: QuickScoreEntryProps) {
  const [justSaved, setJustSaved] = useState<number | null>(null)
  const [celebration, setCelebration] = useState<'eagle' | 'birdie' | null>(null)

  // Generate score range based on par
  // Show from eagle (-2) to +4 over par, with reasonable bounds
  const minScore = Math.max(1, hole.par - 2)
  const maxScore = hole.par + 4
  const scores = Array.from(
    { length: maxScore - minScore + 1 },
    (_, i) => minScore + i
  )

  const handleCelebrationComplete = useCallback(() => {
    setCelebration(null)
  }, [])

  const handleScoreSelect = (strokes: number) => {
    const diff = strokes - hole.par

    // Trigger celebration for good scores
    if (diff <= -2) {
      setCelebration('eagle')
      triggerHaptic('heavy')
    } else if (diff === -1) {
      setCelebration('birdie')
      triggerHaptic('medium')
    } else {
      triggerHaptic('light')
    }

    setJustSaved(strokes)
    onScoreChange(strokes)

    // Auto-advance after celebration (longer delay for celebrations)
    const delay = diff <= -2 ? 2000 : diff === -1 ? 1500 : 400

    if (onNext) {
      setTimeout(() => {
        setJustSaved(null)
        onNext()
      }, delay)
    } else {
      setTimeout(() => setJustSaved(null), delay)
    }
  }

  const getScoreLabel = (strokes: number): string => {
    const diff = strokes - hole.par
    if (diff <= -3) return 'Ace!'
    if (diff === -2) return 'Eagle'
    if (diff === -1) return 'Birdie'
    if (diff === 0) return 'Par'
    if (diff === 1) return 'Bogey'
    if (diff === 2) return 'Dbl'
    return `+${diff}`
  }

  const selectedScore = justSaved ?? currentStrokes

  return (
    <>
      {/* Celebration overlay */}
      <Celebration type={celebration} onComplete={handleCelebrationComplete} />

      <div className="flex h-full flex-col items-center justify-between py-6">
        {/* Hole Info */}
        <div className="text-center">
          <div className="text-6xl font-bold text-primary">
            {hole.hole_number}
          </div>
          <div className="mt-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Hole
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-lg">
            <div className="text-center">
              <div className="text-3xl font-bold">{hole.par}</div>
              <div className="text-xs text-muted-foreground">PAR</div>
            </div>
            {hole.yardage && (
              <div className="text-center">
                <div className="text-3xl font-bold">{hole.yardage}</div>
                <div className="text-xs text-muted-foreground">YDS</div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Score Buttons */}
        <div className="w-full max-w-md px-4">
          {/* Score name display */}
          {selectedScore && (
            <div className={cn(
              "mb-6 text-center transition-all duration-200",
              justSaved && "scale-110"
            )}>
              <div className={cn(
                "inline-block rounded-full px-6 py-2 text-lg font-bold",
                getScoreClass(selectedScore, hole.par)
              )}>
                {getScoreName(selectedScore, hole.par)}
              </div>
            </div>
          )}

          {/* Score buttons row */}
          <div className="flex justify-center gap-2">
            {scores.map(score => {
              const isSelected = selectedScore === score
              const diff = score - hole.par

              return (
                <button
                  key={score}
                  onClick={() => handleScoreSelect(score)}
                  className={cn(
                    "flex h-16 w-16 flex-col items-center justify-center rounded-xl text-lg font-bold transition-all duration-150 active:scale-95",
                    isSelected
                      ? cn(
                          "ring-2 ring-offset-2 scale-105",
                          diff <= -2 && "bg-amber-500 text-white ring-amber-500",
                          diff === -1 && "bg-green-500 text-white ring-green-500",
                          diff === 0 && "bg-slate-600 text-white ring-slate-600",
                          diff === 1 && "bg-orange-500 text-white ring-orange-500",
                          diff >= 2 && "bg-red-500 text-white ring-red-500"
                        )
                      : cn(
                          "bg-muted hover:bg-muted/80",
                          diff <= -2 && "text-amber-600 hover:bg-amber-100",
                          diff === -1 && "text-green-600 hover:bg-green-50",
                          diff === 0 && "text-slate-700 hover:bg-slate-100",
                          diff === 1 && "text-orange-600 hover:bg-orange-50",
                          diff >= 2 && "text-red-600 hover:bg-red-50"
                        )
                  )}
                >
                  <span className="text-2xl">{score}</span>
                  <span className={cn(
                    "text-[10px] font-medium",
                    isSelected ? "text-white/80" : "text-muted-foreground"
                  )}>
                    {getScoreLabel(score)}
                  </span>
                </button>
              )
            })}
          </div>

          {/* More scores hint */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Swipe left/right to change holes
          </div>
        </div>

        {/* Current status */}
        <div className="text-center">
          {justSaved && celebration ? (
            <div className={cn(
              "text-lg font-bold",
              celebration === 'eagle' ? "text-amber-500" : "text-green-500"
            )}>
              {celebration === 'eagle' ? 'Amazing shot!' : 'Nice birdie!'}
            </div>
          ) : justSaved ? (
            <div className="text-lg font-medium text-green-600">
              Saved! Moving to next hole...
            </div>
          ) : currentStrokes ? (
            <div className="text-sm text-muted-foreground">
              Tap a score to update
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Tap your score
            </div>
          )}
        </div>
      </div>
    </>
  )
}
