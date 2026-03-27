import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeHelp, CircleCheckBig, CircleX, Mic, MicOff, Volume2 } from 'lucide-react'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useQuizEngine } from '../../hooks/useQuizEngine'
import { buildFallbackQuizFromCards, generateQuizForDeck, submitQuizAttempt } from '../../services/deckService'
import DataStateView from '../ui/DataStateView'

const MotionDiv = motion.div
const MotionButton = motion.button

export default function QuizExperience({ quiz, cards, deckId, authUser, onQuizUpdate, onQuizFinished }) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizeQuestion = (item) => ({
    ...item,
    question: item?.question ?? item?.q ?? '',
    options: Array.isArray(item?.options) ? item.options : [],
    explanation: item?.explanation ?? item?.answer ?? '',
    correct_index: Number.isInteger(item?.correct_index) ? item.correct_index : 0,
  })

  const submitAction = useAsyncAction(async (payload) => submitQuizAttempt(payload), {
    defaultError: 'Failed to submit quiz attempt',
  })

  const regenerateAction = useAsyncAction(async (difficulty) => {
    const res = await generateQuizForDeck({ deckId, cards, difficulty, questionCount: 10 })
    return res?.quiz || []
  }, {
    defaultError: 'Failed to regenerate quiz',
    maxRetries: 2,
  })

  const quizEngine = useQuizEngine({
    quizItems: quiz,
    deckId,
    onSubmit: async ({ difficulty, score, total, durationSeconds, answers, quizItems }) => {
      setIsSubmitting(true)
      const answerPayload = quizItems.map((item, index) => ({
        question: item.question,
        selected_index: answers[index] ?? -1,
        correct_index: item.correct_index,
        explanation: item.explanation,
        topic: item.topic || 'General',
        answer: item.options?.[item.correct_index] || item.explanation || '',
      }))

      try {
        await submitAction.execute({
          deckId,
          difficulty,
          score,
          totalQuestions: total,
          durationSeconds,
          answers: answerPayload,
        })
      } catch {
        // Keep user flow resilient even if sync fails.
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  const {
    state: {
      difficulty,
      currentIndex,
      timerMode,
      timePerQuestion,
      fullQuizTime,
      remainingSeconds,
      paused,
      voiceEnabled,
      total,
      current,
      selected,
      isAnswered,
      score,
      finished,
      showExplanation,
    },
    actions,
  } = quizEngine

  const progressPercent = useMemo(() => {
    if (!total) return 0
    return ((currentIndex + 1) / total) * 100
  }, [currentIndex, total])

  const safeCurrent = current ? normalizeQuestion(current) : null

  if (!quiz || !quiz.length) {
    return (
      <DataStateView
        state="empty"
        title="Quiz not available"
        message="No quiz questions found for this deck yet."
        actionLabel={regenerateAction.loading ? undefined : 'Generate Quiz'}
        onAction={regenerateAction.loading ? undefined : async () => {
          try {
            const nextQuiz = await regenerateAction.execute('medium')
            const finalQuiz = nextQuiz.length ? nextQuiz : buildFallbackQuizFromCards(cards, 10)
            onQuizUpdate(finalQuiz)
            actions.setDifficulty('medium')
            actions.resetQuiz()
          } catch {
            // Error handled by action state.
          }
        }}
      />
    )
  }

  const regenerateQuiz = async (nextDifficulty) => {
    try {
      const nextQuiz = await regenerateAction.execute(nextDifficulty)
      const finalQuiz = nextQuiz.length ? nextQuiz : buildFallbackQuizFromCards(cards, 10)
      onQuizUpdate(finalQuiz)
      actions.setDifficulty(nextDifficulty)
      actions.resetQuiz()
    } catch {
      // Error is handled by action state.
    }
  }

  const listenForVoiceAnswer = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.toLowerCase() || ''
      const mapping = { a: 0, b: 1, c: 2, d: 3, one: 0, two: 1, three: 2, four: 3 }
      const key = Object.keys(mapping).find((entry) => transcript.includes(entry))
      if (key !== undefined) {
        actions.selectOption(mapping[key])
      }
    }
    recognition.start()
  }

  const readCurrentQuestion = () => {
    if (!('speechSynthesis' in window) || !safeCurrent) return
    const speech = new SpeechSynthesisUtterance(`${safeCurrent.question}. Options: ${safeCurrent.options.join(', ')}`)
    speech.rate = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(speech)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-[#202020] p-4 md:grid-cols-4">
        <div>
          <p className="mb-1 text-xs text-gray-400">Difficulty</p>
          <select
            value={difficulty}
            onChange={(event) => regenerateQuiz(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-[#101010] px-2 py-2 text-sm"
            disabled={regenerateAction.loading}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs text-gray-400">Timer Mode</p>
          <select
            value={timerMode}
            onChange={(event) => actions.setTimerMode(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-[#101010] px-2 py-2 text-sm"
          >
            <option value="per-question">Per Question</option>
            <option value="full-quiz">Full Quiz</option>
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs text-gray-400">Seconds</p>
          <input
            type="number"
            min={10}
            max={1800}
            value={timerMode === 'per-question' ? timePerQuestion : fullQuizTime}
            onChange={(event) => {
              const value = Math.max(10, Number(event.target.value) || 10)
              if (timerMode === 'per-question') actions.setTimePerQuestion(value)
              else actions.setFullQuizTime(value)
            }}
            className="w-full rounded-md border border-white/15 bg-[#101010] px-2 py-2 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={() => actions.setPaused()}
            className="rounded-md border border-white/20 px-3 py-2 text-sm"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => actions.setVoiceEnabled()}
            className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-300"
          >
            {voiceEnabled ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        </div>
      </div>

      {(regenerateAction.loading || regenerateAction.error) && (
        <DataStateView
          state={regenerateAction.loading ? 'loading' : 'error'}
          title={regenerateAction.loading ? 'Regenerating quiz...' : 'Quiz regeneration failed'}
          message={regenerateAction.loading ? 'Building a new quiz set for this difficulty.' : regenerateAction.error}
          actionLabel={!regenerateAction.loading ? 'Retry' : undefined}
          onAction={!regenerateAction.loading ? () => regenerateAction.retry() : undefined}
        />
      )}

      <div className="rounded-xl border border-white/10 bg-[#202020] p-4">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
          <span>Question {currentIndex + 1}/{total}</span>
          <span>Score {score}/{total}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <MotionDiv
            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.26 }}
          />
        </div>
        <p className={`mt-3 text-sm ${remainingSeconds <= 10 ? 'text-red-300' : 'text-cyan-200'}`}>
          Time left: {formatSeconds(remainingSeconds)}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <MotionDiv
          key={currentIndex}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -28 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-white/10 bg-[#202020] p-6 md:p-8"
        >
          <h3 className="mb-5 text-xl font-semibold text-white">{safeCurrent?.question || 'Question unavailable'}</h3>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={readCurrentQuestion}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-cyan-200"
            >
              <Volume2 size={14} /> Read Question
            </button>
            <button
              onClick={listenForVoiceAnswer}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-3 py-2 text-indigo-200"
            >
              <Mic size={14} /> Voice Answer
            </button>
          </div>

          <div className="space-y-3">
            {(safeCurrent?.options || []).map((option, idx) => {
              const isCorrect = idx === safeCurrent.correct_index
              const isSelected = selected === idx

              let stateClass = 'border-white/10 hover:border-white/20 bg-[#232323]'
              if (isAnswered && isCorrect) stateClass = 'border-green-400/60 bg-green-500/10'
              if (isAnswered && isSelected && !isCorrect) stateClass = 'border-red-400/60 bg-red-500/10'

              return (
                <MotionButton
                  key={`${currentIndex}-${idx}`}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => actions.selectOption(idx)}
                  className={`w-full rounded-lg border p-4 text-left transition-all ${stateClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-200">{option}</span>
                    {isAnswered && isCorrect && <CircleCheckBig size={18} className="text-green-400" />}
                    {isAnswered && isSelected && !isCorrect && <CircleX size={18} className="text-red-400" />}
                  </div>
                </MotionButton>
              )
            })}
          </div>

          {isAnswered && (
            <p className={`mt-4 text-sm font-medium ${selected === safeCurrent?.correct_index ? 'text-green-300' : 'text-red-300'}`}>
              {selected === safeCurrent?.correct_index ? 'Correct answer selected.' : 'Incorrect. Correct option is highlighted.'}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => actions.toggleExplanation(currentIndex)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-500/15 px-4 py-2 text-blue-300"
            >
              <BadgeHelp size={16} /> {showExplanation[currentIndex] ? 'Hide Explanation' : 'View Explanation'}
            </button>
          </div>

          {showExplanation[currentIndex] && (
            <div className="mt-3 rounded-lg border border-white/10 bg-[#1a1a1a] p-4 text-gray-300">
              {safeCurrent?.explanation}
            </div>
          )}

          <div className="mt-7 flex items-center justify-between">
            <button
              onClick={actions.goPrev}
              disabled={currentIndex === 0}
              className="rounded-lg border border-white/15 px-4 py-2 text-gray-200 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={actions.goNext}
              disabled={currentIndex >= total - 1}
              className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </MotionDiv>
      </AnimatePresence>

      {finished && (
        <MotionDiv
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 p-6 text-center"
        >
          <h4 className="mb-2 text-xl font-semibold text-white">Quiz Complete</h4>
          <p className="text-gray-200">Final Score: {score}/{total}</p>
          {isSubmitting && <p className="mt-3 text-xs text-cyan-200">Syncing attempt...</p>}
          {submitAction.error && <p className="mt-3 text-xs text-red-200">{submitAction.error}</p>}
          {!authUser && <p className="mt-2 text-xs text-gray-300">Login to sync attempts and analytics.</p>}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                onQuizFinished?.({
                  score,
                  total,
                  difficulty,
                  completedAt: new Date().toISOString(),
                })
              }}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white"
            >
              View Results
            </button>
            <button
              onClick={actions.resetQuiz}
              className="rounded-lg bg-white px-4 py-2 font-medium text-black"
            >
              Retry Quiz
            </button>
          </div>
        </MotionDiv>
      )}
    </div>
  )
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
