import { Link, useLocation } from 'react-router-dom'
import { Trophy, Users, Flag, ClipboardList, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTournamentStore } from '@/stores/tournamentStore'
import { SyncIndicator } from './SyncIndicator'

const navItems = [
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/scoring', icon: Flag, label: 'Scoring' },
  { path: '/scorecard', icon: ClipboardList, label: 'Scorecard' },
  { path: '/players', icon: Users, label: 'Players' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { currentTournamentId } = useTournamentStore()

  // Don't show nav on home/join screens
  const showNav = currentTournamentId && !['/', '/join', '/create'].includes(location.pathname)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="font-semibold">FifthMajor</span>
          </Link>
          <SyncIndicator />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-around px-2">
            {navItems.map(({ path, icon: Icon, label }) => {
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
    </div>
  )
}
