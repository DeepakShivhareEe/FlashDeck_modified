import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { requestJson } from '../lib/api'
import { useAppState } from '../state/useAppState'

const CACHE_KEY = 'flashdeck_analytics_cache'

export default function AnalyticsPage({ authUser }) {
  const [loading, setLoading] = useState(() => !readCache())
  const [error, setError] = useState('')
  const [data, setData] = useState(() => readCache())
  const { actions } = useAppState()

  useEffect(() => {
    actions.setWorkflowStep('analytics')
  }, [actions])

  useEffect(() => {
    if (!authUser) {
      return
    }

    requestJson('/analytics', { method: 'GET' }, 0, 25000)
      .then((res) => {
        const payload = res?.analytics || null
        setData(payload)
        writeCache(payload)
      })
      .catch((err) => setError(err?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [authUser])

  const trend = useMemo(() => data?.trend || [], [data])

  if (!authUser) {
    return <Navigate to="/auth" replace />
  }

  return (
    <div className="min-h-screen bg-[#111827] text-gray-100 p-6 md:p-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-400">Track performance, accuracy, and weak topics.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/app" className="rounded-lg border border-white/10 px-3 py-2 text-sm">Dashboard</Link>
          <Link to="/leaderboard" className="rounded-lg border border-white/10 px-3 py-2 text-sm">Leaderboard</Link>
        </div>
      </header>

      {loading && <p>Loading analytics...</p>}
      {error && <p className="text-red-300">{error}</p>}

      {!loading && data && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label="Total Quizzes" value={data.total_quizzes} />
            <MetricCard label="Average Score" value={data.average_score} />
            <MetricCard label="Accuracy %" value={data.accuracy_percent} />
            <MetricCard label="Weak Topics" value={(data.weak_topics || []).length} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Accuracy Trend">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2f3b55" />
                  <XAxis dataKey="day" stroke="#9cb0d8" />
                  <YAxis stroke="#9cb0d8" />
                  <Tooltip />
                  <Line type="monotone" dataKey="accuracy" stroke="#2AE7C9" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Attempts Per Day">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2f3b55" />
                  <XAxis dataKey="day" stroke="#9cb0d8" />
                  <YAxis stroke="#9cb0d8" />
                  <Tooltip />
                  <Bar dataKey="attempts" fill="#2D88FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 text-xl font-semibold">Weak Topics</h2>
            {(data.weak_topics || []).length === 0 ? (
              <p className="text-gray-400">No weak-topic data yet. Submit a few quizzes first.</p>
            ) : (
              <ul className="space-y-2">
                {data.weak_topics.map((topic) => (
                  <li key={topic.topic} className="flex justify-between rounded-md bg-[#182239] px-3 py-2">
                    <span>{topic.topic}</span>
                    <span className="text-red-300">{topic.wrong_count} misses</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const age = Date.now() - parsed.timestamp
    if (age > 5 * 60 * 1000) {
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), value }))
  } catch {
    // Ignore cache write failures.
  }
}
