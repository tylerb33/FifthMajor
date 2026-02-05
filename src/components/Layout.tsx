import { Link, useLocation } from 'react-router-dom'
import { Trophy, Users, Flag, ClipboardList, Settings, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTournamentStore } from '@/stores/tournamentStore'
import { SyncIndicator } from './SyncIndicator'
import { Toaster } from './Toaster'
import { useRestoreSession } from '@/hooks/useRestoreSession'
import { useUrlState } from '@/hooks/useUrlState'

const navItems = [
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/scoring', icon: Flag, label: 'Scoring' },
  { path: '/scorecard', icon: ClipboardList, label: 'Scorecard' },
  { path: '/players', icon: Users, label: 'Players' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

// Routes that share the swipeable view
const swipeableRoutes = ['/leaderboard', '/scoring']

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { currentTournamentId } = useTournamentStore()
  const { isRestoring, error: restoreError } = useRestoreSession()

  // Sync state with URL params
  useUrlState()

  // Don't show nav on home/join screens
  const showNav = currentTournamentId && !['/', '/join', '/create'].includes(location.pathname)

  // Don't show header on landing page
  const showHeader = location.pathname !== '/'

  // Check if we're on a swipeable route (needs different layout)
  const isSwipeableRoute = swipeableRoutes.includes(location.pathname)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      {showHeader && (
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/FifthMajorLogo.png"
                alt="Fifth Major"
                className="h-10 w-auto object-contain"
              />
            </Link>
            <SyncIndicator />
          </div>
        </header>
      )}

      {/* Main content */}
      <main className={cn(
        "flex-1",
        // Swipeable view manages its own bottom padding for the dot indicators
        isSwipeableRoute ? "pb-16" : "pb-20"
      )}>
        {isRestoring ? (
          <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Restoring tournament data...</p>
            </div>
          </div>
        ) : restoreError ? (
          <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
            <div className="text-center">
              <p className="text-destructive">{restoreError}</p>
              <Link to="/" className="mt-4 inline-block text-primary hover:underline">
                Return to home
              </Link>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Bottom navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-around px-2">
            {navItems.map(({ path, icon: Icon, label }) => {
              // For swipeable routes, highlight both leaderboard and scoring based on current path
              const isActive = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive && 'fill-current')} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}
