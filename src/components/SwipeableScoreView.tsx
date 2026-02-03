import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { LeaderboardPage } from '@/features/leaderboard/components/LeaderboardPage'
import { ScoringPage } from '@/features/scoring/components/ScoringPage'

type View = 'leaderboard' | 'scoring'

export function SwipeableScoreView() {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine initial view from URL
  const initialView: View = location.pathname === '/scoring' ? 'scoring' : 'leaderboard'
  const [currentView, setCurrentView] = useState<View>(initialView)
  const [isAnimating, setIsAnimating] = useState(false)

  // Swipe state
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const touchCurrent = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)

  // Sync view with URL changes (e.g., from bottom nav)
  useEffect(() => {
    const newView: View = location.pathname === '/scoring' ? 'scoring' : 'leaderboard'
    if (newView !== currentView) {
      setCurrentView(newView)
    }
  }, [location.pathname])

  const switchToView = useCallback((view: View) => {
    if (view === currentView || isAnimating) return

    setIsAnimating(true)
    setCurrentView(view)

    // Update URL without full navigation
    navigate(view === 'leaderboard' ? '/leaderboard' : '/scoring', { replace: true })

    setTimeout(() => setIsAnimating(false), 300)
  }, [currentView, isAnimating, navigate])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    }
    touchCurrent.current = e.targetTouches[0].clientX
  }, [isAnimating])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || isAnimating) return

    const currentX = e.targetTouches[0].clientX
    const currentY = e.targetTouches[0].clientY
    touchCurrent.current = currentX

    const deltaX = currentX - touchStart.current.x
    const deltaY = currentY - touchStart.current.y

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      // Prevent vertical scroll during horizontal swipe
      e.preventDefault()

      // Apply resistance at edges
      let offset = deltaX
      if ((currentView === 'leaderboard' && deltaX > 0) ||
          (currentView === 'scoring' && deltaX < 0)) {
        offset = deltaX * 0.3 // Resistance at edges
      }

      setDragOffset(offset)
    }
  }, [currentView, isAnimating])

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchCurrent.current) {
      touchStart.current = null
      touchCurrent.current = null
      setDragOffset(0)
      return
    }

    const deltaX = touchCurrent.current - touchStart.current.x
    const deltaTime = Date.now() - touchStart.current.time
    const velocity = Math.abs(deltaX) / deltaTime

    // Determine if swipe should trigger view change
    const threshold = 80 // pixels
    const velocityThreshold = 0.3 // pixels per ms

    const shouldSwitch = Math.abs(deltaX) > threshold || velocity > velocityThreshold

    if (shouldSwitch) {
      if (deltaX < 0 && currentView === 'leaderboard') {
        // Swiped left on leaderboard -> go to scoring
        switchToView('scoring')
      } else if (deltaX > 0 && currentView === 'scoring') {
        // Swiped right on scoring -> go to leaderboard
        switchToView('leaderboard')
      }
    }

    touchStart.current = null
    touchCurrent.current = null
    setDragOffset(0)
  }, [currentView, switchToView])

  return (
    <div className="flex flex-col h-full">
      {/* Swipeable container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={cn(
            "flex h-full transition-transform",
            !dragOffset && "duration-300 ease-out"
          )}
          style={{
            transform: `translateX(calc(${currentView === 'scoring' ? '-50%' : '0%'} + ${dragOffset}px))`,
            width: '200%'
          }}
        >
          {/* Leaderboard View */}
          <div className="w-1/2 h-full overflow-y-auto">
            <LeaderboardPage />
          </div>

          {/* Scoring View */}
          <div className="w-1/2 h-full overflow-y-auto">
            <ScoringPage />
          </div>
        </div>
      </div>

      {/* View indicators */}
      <div className="flex justify-center gap-2 py-2 bg-background">
        <button
          onClick={() => switchToView('leaderboard')}
          className={cn(
            "h-1.5 rounded-full transition-all",
            currentView === 'leaderboard'
              ? "w-6 bg-primary"
              : "w-1.5 bg-muted-foreground/30"
          )}
          aria-label="View leaderboard"
        />
        <button
          onClick={() => switchToView('scoring')}
          className={cn(
            "h-1.5 rounded-full transition-all",
            currentView === 'scoring'
              ? "w-6 bg-primary"
              : "w-1.5 bg-muted-foreground/30"
          )}
          aria-label="View scoring"
        />
      </div>
    </div>
  )
}
