import { useState, useEffect } from 'react'
import { Minus, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getScoreName, getScoreClass, getDefaultStrokes } from '@/lib/utils/scoring'
import type { Hole } from '@/types'

interface HoleScoreEntryProps {
  hole: Hole
  currentStrokes?: number
  onScoreChange: (strokes: number) => void
  onNext?: () => void
}

export function HoleScoreEntry({
  hole,
  currentStrokes,
  onScoreChange,
  onNext
}: HoleScoreEntryProps) {
  const [strokes, setStrokes] = useState(currentStrokes ?? getDefaultStrokes(hole.par))
  const [hasChanged, setHasChanged] = useState(false)

  // Reset when hole changes
  useEffect(() => {
    setStrokes(currentStrokes ?? getDefaultStrokes(hole.par))
    setHasChanged(false)
  }, [hole.hole_number, currentStrokes, hole.par])

  const handleIncrement = () => {
    if (strokes < 15) {
      setStrokes(s => s + 1)
      setHasChanged(true)
    }
  }

  const handleDecrement = () => {
    if (strokes > 1) {
      setStrokes(s => s - 1)
      setHasChanged(true)
    }
  }

  const handleSave = () => {
    onScoreChange(strokes)
    setHasChanged(false)
    if (onNext) {
      onNext()
    }
  }

  const scoreName = getScoreName(strokes, hole.par)
  const scoreClass = getScoreClass(strokes, hole.par)

  return (
    <div className="flex h-full flex-col items-center justify-between py-4">
      {/* Hole Info */}
      <div className="text-center">
        <div className="text-5xl font-bold text-primary">
          Hole {hole.hole_number}
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-lg text-muted-foreground">
          <span>Par {hole.par}</span>
          {hole.yardage && (
            <>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span>{hole.yardage} yds</span>
            </>
          )}
        </div>
      </div>

      {/* Score Entry */}
      <div className="flex flex-col items-center">
        {/* Score Name */}
        <div className={cn(
          "mb-4 rounded-full px-4 py-1 text-sm font-medium",
          scoreClass
        )}>
          {scoreName}
        </div>

        {/* Score Controls */}
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            size="icon-lg"
            className="h-20 w-20 rounded-full text-3xl"
            onClick={handleDecrement}
            disabled={strokes <= 1}
          >
            <Minus className="h-8 w-8" />
          </Button>

          <div className="flex flex-col items-center">
            <div className={cn(
              "flex h-32 w-32 items-center justify-center rounded-full text-6xl font-bold",
              scoreClass
            )}>
              {strokes}
            </div>
            {currentStrokes && strokes !== currentStrokes && (
              <div className="mt-2 text-sm text-muted-foreground">
                was {currentStrokes}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="icon-lg"
            className="h-20 w-20 rounded-full text-3xl"
            onClick={handleIncrement}
            disabled={strokes >= 15}
          >
            <Plus className="h-8 w-8" />
          </Button>
        </div>
      </div>

      {/* Save Button */}
      <Button
        size="xl"
        className="w-full max-w-xs"
        onClick={handleSave}
        disabled={!hasChanged && currentStrokes !== undefined}
      >
        <Check className="mr-2 h-5 w-5" />
        {currentStrokes === undefined
          ? 'Save Score'
          : hasChanged
            ? 'Update Score'
            : onNext
              ? 'Next Hole'
              : 'Saved'}
      </Button>
    </div>
  )
}
