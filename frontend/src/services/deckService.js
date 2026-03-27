import { requestBlob, requestJson } from '../lib/api'

function safeParse(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function toArray(value) {
  const parsed = safeParse(value)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') return [parsed]
  return []
}

function normalizeCards(cards) {
  return toArray(cards)
    .map((card) => {
      if (!card || typeof card !== 'object') return null
      const q = card.q ?? card.question ?? card.front ?? ''
      const a = card.a ?? card.answer ?? card.back ?? ''
      if (!q && !a) return null
      return {
        ...card,
        q,
        a,
      }
    })
    .filter(Boolean)
}

function normalizeQuiz(quiz) {
  return toArray(quiz)
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const options = Array.isArray(item.options) ? item.options : []
      const question = item.question ?? item.q ?? ''
      const explanation = item.explanation ?? item.answer ?? ''
      const correctIndex = Number.isInteger(item.correct_index)
        ? item.correct_index
        : Number.isInteger(item.correctIndex)
          ? item.correctIndex
          : 0
      if (!question) return null
      return {
        ...item,
        question,
        options,
        explanation,
        correct_index: correctIndex,
      }
    })
    .filter(Boolean)
}

function normalizeFlowcharts(flowcharts) {
  return toArray(flowcharts)
    .map((item) => (typeof item === 'string' ? item : ''))
    .filter(Boolean)
}

export function buildFallbackQuizFromCards(cards, questionCount = 10) {
  const normalizedCards = normalizeCards(cards)
  if (!normalizedCards.length) return []

  const pool = normalizedCards
    .map((card) => ({ question: card.q, answer: card.a, topic: card.topic || 'General' }))
    .filter((item) => item.question && item.answer)

  if (!pool.length) return []

  const count = Math.min(questionCount, pool.length)
  const result = []

  for (let i = 0; i < count; i += 1) {
    const base = pool[i]
    const distractors = pool
      .filter((candidate, idx) => idx !== i)
      .map((candidate) => candidate.answer)
      .filter((answer) => answer && answer !== base.answer)
      .slice(0, 3)

    while (distractors.length < 3) {
      distractors.push('None of the above')
    }

    const options = [base.answer, ...distractors].slice(0, 4)
    const shuffled = [...options].sort(() => Math.random() - 0.5)
    const correctIndex = shuffled.findIndex((option) => option === base.answer)

    result.push({
      question: base.question,
      options: shuffled,
      correct_index: correctIndex >= 0 ? correctIndex : 0,
      explanation: base.answer,
      topic: base.topic,
    })
  }

  return result
}

export async function generateDeckFromFiles(files) {
  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
  })

  const data = await requestJson('/generate', {
    method: 'POST',
    body: formData,
  }, 1, 180000)

  // Keep full arrays and normalize mixed response shapes from backend/LLM wrappers.
  return {
    ...data,
    cards: normalizeCards(data?.cards),
    quiz: normalizeQuiz(data?.quiz),
    flowcharts: normalizeFlowcharts(data?.flowcharts),
  }
}

export async function generateQuizForDeck({ deckId, cards, difficulty = 'medium', questionCount = 10 }) {
  const res = await requestJson('/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deck_id: deckId,
      cards,
      question_count: questionCount,
      difficulty,
    }),
  }, 0, 90000)

  return {
    ...res,
    quiz: normalizeQuiz(res?.quiz),
  }
}

export async function submitQuizAttempt({
  deckId,
  difficulty,
  score,
  totalQuestions,
  durationSeconds,
  answers,
}) {
  return requestJson('/submit-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deck_id: deckId,
      difficulty,
      score,
      total_questions: totalQuestions,
      duration_seconds: durationSeconds,
      answers,
    }),
  }, 0, 20000)
}

export async function exportDeckCards({ deckId, deckName, cards, format }) {
  return requestBlob('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deck_id: deckId,
      deck_name: deckName || 'FlashDeck',
      cards,
      format,
    }),
  }, 30000)
}
