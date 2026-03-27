import { useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BarChart3, CheckCircle2, RefreshCw, Target } from 'lucide-react'
import LearningFlowStepper from '../components/workflow/LearningFlowStepper'
import DataStateView from '../components/ui/DataStateView'
import { useAppState } from '../state/useAppState'

export default function QuizResultsPage() {
  const {
    state: { latestQuizResult },
    actions,
  } = useAppState()
  const navigate = useNavigate()

  useEffect(() => {
    actions.setWorkflowStep('results')
  }, [actions])

  if (!latestQuizResult) {
    return <Navigate to="/my-decks" replace />
  }

  const percentage = latestQuizResult.total > 0
    ? Math.round((latestQuizResult.score / latestQuizResult.total) * 100)
    : 0

  const grade = percentage >= 85 ? 'Excellent' : percentage >= 65 ? 'Good' : 'Needs Review'

  return (
    <div className="min-h-screen bg-[#161616] p-6 text-gray-200 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <LearningFlowStepper activeStep="Results" />

        <div className="rounded-2xl border border-white/10 bg-[#202020] p-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-green-300/30 bg-green-500/10 px-3 py-1 text-xs text-green-200">
            <CheckCircle2 size={12} /> Quiz Completed
          </span>

          <h1 className="mt-4 text-3xl font-bold text-white">{grade}</h1>
          <p className="mt-2 text-gray-300">{latestQuizResult.deckName || 'Deck'} · {latestQuizResult.difficulty} difficulty</p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
            <ResultTile label="Score" value={`${latestQuizResult.score}/${latestQuizResult.total}`} />
            <ResultTile label="Accuracy" value={`${percentage}%`} />
            <ResultTile label="Completed" value={formatDate(latestQuizResult.completedAt)} />
          </div>

          <div className="mx-auto mt-6 h-2 max-w-xl rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/my-decks"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              <RefreshCw size={14} /> Practice Again
            </Link>
            <Link
              to="/analytics"
              onClick={() => actions.setWorkflowStep('analytics')}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
            >
              <BarChart3 size={14} /> Open Analytics
            </Link>
          </div>
        </div>

        {percentage < 65 && (
          <DataStateView
            state="error"
            title="Focus on weak areas"
            message="Use flashcards with unknown marks before attempting the next quiz round."
            actionLabel="Back To Deck"
            onAction={() => navigate('/my-decks')}
          />
        )}

        {percentage >= 65 && (
          <DataStateView
            state="success"
            title="Momentum unlocked"
            message="Continue to analytics to track trend and weak topics over time."
            actionLabel="Go To Analytics"
            onAction={() => navigate('/analytics')}
          />
        )}
      </div>
    </div>
  )
}

function ResultTile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-white"><Target size={14} /> {value}</p>
    </div>
  )
}

function formatDate(dateString) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return 'Now'
  }
  return date.toLocaleString()
}
