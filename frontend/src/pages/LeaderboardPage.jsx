import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { requestJson } from '../lib/api'

export default function LeaderboardPage() {
  const [scope, setScope] = useState('global')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    requestJson(`/leaderboard?scope=${scope}&limit=20`, { method: 'GET' }, 0, 20000)
      .then((res) => setRows(res?.rows || []))
      .catch((err) => setError(err?.message || 'Failed to load leaderboard'))
      .finally(() => setLoading(false))
  }, [scope])

  const switchScope = (nextScope) => {
    if (nextScope === scope) return
    setLoading(true)
    setError('')
    setScope(nextScope)
  }

  return (
    <div className="min-h-screen bg-[#0d111f] text-gray-100 p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-gray-400">Rankings by accuracy, score, and consistency.</p>
        </div>
        <Link to="/app" className="rounded-lg border border-white/10 px-3 py-2 text-sm">Dashboard</Link>
      </div>

      <div className="mb-4 flex gap-2 rounded-lg border border-white/10 bg-white/5 p-1 w-fit">
        <button
          onClick={() => switchScope('global')}
          className={`rounded-md px-3 py-1.5 text-sm ${scope === 'global' ? 'bg-white text-black' : 'text-gray-300'}`}
        >
          Global
        </button>
        <button
          onClick={() => switchScope('weekly')}
          className={`rounded-md px-3 py-1.5 text-sm ${scope === 'weekly' ? 'bg-white text-black' : 'text-gray-300'}`}
        >
          Weekly
        </button>
      </div>

      {loading && <p>Loading leaderboard...</p>}
      {error && <p className="text-red-300">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-[#172036] text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Quizzes</th>
                <th className="px-4 py-3 text-left">Avg Score</th>
                <th className="px-4 py-3 text-left">Accuracy %</th>
                <th className="px-4 py-3 text-left">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="border-t border-white/10 bg-[#101827]">
                  <td className="px-4 py-3 font-semibold">#{row.rank}</td>
                  <td className="px-4 py-3">{row.display_name}</td>
                  <td className="px-4 py-3">{row.quizzes}</td>
                  <td className="px-4 py-3">{row.average_score}</td>
                  <td className="px-4 py-3">{row.accuracy_percent}</td>
                  <td className="px-4 py-3">{row.total_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
