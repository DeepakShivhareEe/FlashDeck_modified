import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { getAuthToken, requestJson, setAuthToken } from './lib/api'
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

function App() {
  // Global State lifted from Dashboard
  const [files, setFiles] = useState([])
  const [cards, setCards] = useState([])
  const [quiz, setQuiz] = useState([])
  const [flowcharts, setFlowcharts] = useState([])
  const [deckName, setDeckName] = useState("")
  const [deckId, setDeckId] = useState(null)
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
            element={
              <Dashboard
                files={files}
                setFiles={setFiles}
                setCards={setCards}
                setQuiz={setQuiz}
                setFlowcharts={setFlowcharts}
                setDeckName={setDeckName}
                setDeckId={setDeckId}
                deckId={deckId}
                authUser={authUser}
              />
            }
          />

          <Route
            path="/my-decks"
            element={
              <MyDecks
                cards={cards}
                quiz={quiz}
                deckName={deckName}
                deckId={deckId}
                authUser={authUser}
              />
            }
          />

          <Route
            path="/knowledge-base"
            element={
              <KnowledgeBase
                files={files}
                flowcharts={flowcharts}
                deckId={deckId}
                authUser={authUser}
              />
            }
          />

          <Route
            path="/analytics"
            element={<AnalyticsPage authUser={authUser} />}
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
  )
}

export default App
