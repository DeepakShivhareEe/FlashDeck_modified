import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { requestJson } from '../lib/api'

export default function ReviewPage({ authUser }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authUser) return

    requestJson('/srs/review?limit=30', { method: 'GET' }, 0, 20000)
      .then((res) => setItems(res?.items || []))
      .catch((err) => setError(err?.message || 'Failed to load review queue'))
      .finally(() => setLoading(false))
  }, [authUser])

  const current = useMemo(() => items[index], [items, index])

  if (!authUser) {
    return <Navigate to="/auth" replace />
  }

  const submitAnswer = async (isCorrect) => {
    if (!current) return
    setSubmitting(true)
    try {
      await requestJson('/srs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck_id: current.deck_id,
          question: current.question,
          answer: current.answer,
          topic: current.topic,
          is_correct: isCorrect,
        }),
      }, 0, 20000)
      nextItem()
    } catch (err) {
      setError(err?.message || 'Failed to submit review result')
    } finally {
      setSubmitting(false)
    }
  }

  const nextItem = () => {
    setShowAnswer(false)
    if (index >= items.length - 1) {
      setItems([])
      return
    }
    setIndex((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-[#121826] text-gray-100 p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Review</h1>
          <p className="text-gray-400">Spaced repetition queue for due cards.</p>
        </div>
        <Link to="/app" className="rounded-lg border border-white/10 px-3 py-2 text-sm">Dashboard</Link>
      </div>

      {loading && <p>Loading daily review...</p>}
      {error && <p className="text-red-300">{error}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-gray-300">
          No due cards right now. Great work.
        </div>
      )}

      {!loading && current && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 max-w-3xl">
          <p className="text-sm text-gray-400 mb-4">Card {index + 1}/{items.length} · Topic: {current.topic || 'General'}</p>
          <h2 className="text-2xl font-semibold mb-6">{current.question}</h2>

          {!showAnswer ? (
            <button
              className="rounded-lg bg-cyan-400/20 border border-cyan-300/30 px-4 py-2 text-cyan-200"
              onClick={() => setShowAnswer(true)}
            >
              Show Answer
            </button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-[#0f1628] p-4 text-gray-200">
                {current.answer}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={submitting}
                  className="rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-2 text-red-200 disabled:opacity-50"
                  onClick={() => submitAnswer(false)}
                >
                  I missed it
                </button>
                <button
                  disabled={submitting}
                  className="rounded-lg bg-green-500/20 border border-green-400/30 px-4 py-2 text-green-200 disabled:opacity-50"
                  onClick={() => submitAnswer(true)}
                >
                  I got it right
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
