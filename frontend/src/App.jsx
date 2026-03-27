import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { getAuthToken, requestJson, setAuthToken } from './lib/api'
import { AppStateProvider } from './state/AppStateContext'
import './App.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MyDecks = lazy(() => import('./pages/MyDecks'))
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const QuizResultsPage = lazy(() => import('./pages/QuizResultsPage'))

function App() {
  const [authUser, setAuthUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(() => !getAuthToken())

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      return
    }

    requestJson('/auth/me', { method: 'GET' }, 0, 15000)
      .then((res) => {
        setAuthUser(res?.user || null)
      })
      .catch(() => {
        setAuthToken(null)
        setAuthUser(null)
      })
      .finally(() => {
        setAuthChecked(true)
      })
  }, [])

  const authContext = useMemo(() => ({
    authUser,
    setAuthUser,
    logout: () => {
      setAuthToken(null)
      setAuthUser(null)
    },
  }), [authUser])

  if (!authChecked) {
    return <div className="min-h-screen bg-[#191919] text-white grid place-items-center">Initializing...</div>
  }

  return (
    <AppStateProvider>
      <Router>
        <Suspense fallback={<div className="min-h-screen bg-[#191919] text-white grid place-items-center">Loading...</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route
              path="/auth"
              element={<AuthPage authUser={authUser} setAuthUser={setAuthUser} />}
            />

            <Route
              path="/app"
              element={<Dashboard authUser={authUser} />}
            />

            <Route
              path="/my-decks"
              element={<MyDecks authUser={authUser} />}
            />

            <Route
              path="/knowledge-base"
              element={<KnowledgeBase />}
            />

            <Route
              path="/analytics"
              element={<AnalyticsPage authUser={authUser} />}
            />

            <Route
              path="/quiz-results"
              element={<QuizResultsPage />}
            />

            <Route
              path="/leaderboard"
              element={<LeaderboardPage authUser={authUser} />}
            />

            <Route
              path="/review"
              element={<ReviewPage authUser={authUser} />}
            />

            <Route
              path="/profile"
              element={<ProfilePage authContext={authContext} />}
            />

            {/* Redirect unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AppStateProvider>
  )
}

export default App
