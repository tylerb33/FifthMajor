import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { SwipeableScoreView } from '@/components/SwipeableScoreView'
import { HomePage } from '@/features/tournament/components/HomePage'
import { CreateTournament } from '@/features/tournament/components/CreateTournament'
import { SettingsPage } from '@/features/tournament/components/SettingsPage'
import { PlayersPage } from '@/features/players/components/PlayersPage'
import { ScorecardPage } from '@/features/scoring/components/ScorecardPage'
import { useTournamentStore } from '@/stores/tournamentStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentTournamentId } = useTournamentStore()

  if (!currentTournamentId) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateTournament />} />

        {/* Protected routes - require tournament context */}
        {/* Leaderboard and Scoring share a swipeable view */}
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <SwipeableScoreView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scoring"
          element={
            <ProtectedRoute>
              <SwipeableScoreView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scorecard"
          element={
            <ProtectedRoute>
              <ScorecardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/players"
          element={
            <ProtectedRoute>
              <PlayersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
