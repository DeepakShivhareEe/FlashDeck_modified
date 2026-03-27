import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

const DEFAULT_PER_QUESTION = 45
const DEFAULT_FULL_QUIZ = 300

function getStorageKey(deckId) {
  return `flashdeck_quiz_session_${deckId || 'local'}`
}

function createInitialState(deckId) {
  const fallback = {
    difficulty: 'medium',
    currentIndex: 0,
    answers: {},
    showExplanation: {},
    timerMode: 'per-question',
    timePerQuestion: DEFAULT_PER_QUESTION,
    fullQuizTime: DEFAULT_FULL_QUIZ,
    remainingSeconds: DEFAULT_PER_QUESTION,
    paused: false,
    voiceEnabled: false,
  }

  try {
    const raw = localStorage.getItem(getStorageKey(deckId))
    if (!raw) return fallback
    const saved = JSON.parse(raw)
    if (saved?.deckId !== (deckId || null)) return fallback

    return {
      ...fallback,
      currentIndex: saved.currentIndex || 0,
      answers: saved.answers || {},
      showExplanation: saved.showExplanation || {},
      difficulty: saved.difficulty || 'medium',
      timerMode: saved.timerMode || 'per-question',
      remainingSeconds: saved.remainingSeconds || DEFAULT_PER_QUESTION,
    }
  } catch {
    return fallback
  }
}

function quizReducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        ...action.payload,
      }
    case 'set-difficulty':
      return { ...state, difficulty: action.payload }
    case 'set-timer-mode':
      return {
        ...state,
        timerMode: action.payload,
        remainingSeconds: action.payload === 'per-question' ? state.timePerQuestion : state.fullQuizTime,
      }
    case 'set-time-per-question':
      return {
        ...state,
        timePerQuestion: action.payload,
        remainingSeconds: state.timerMode === 'per-question' ? action.payload : state.remainingSeconds,
      }
    case 'set-full-quiz-time':
      return {
        ...state,
        fullQuizTime: action.payload,
        remainingSeconds: state.timerMode === 'full-quiz' ? action.payload : state.remainingSeconds,
      }
    case 'toggle-paused':
      return { ...state, paused: !state.paused }
    case 'toggle-voice':
      return { ...state, voiceEnabled: !state.voiceEnabled }
    case 'set-current-index':
      return {
        ...state,
        currentIndex: action.payload,
        remainingSeconds: state.timerMode === 'per-question' ? state.timePerQuestion : state.remainingSeconds,
      }
    case 'select-option':
      if (state.answers[state.currentIndex] !== undefined) return state
      return {
        ...state,
        answers: { ...state.answers, [state.currentIndex]: action.payload },
      }
    case 'toggle-explanation':
      return {
        ...state,
        showExplanation: {
          ...state.showExplanation,
          [action.payload]: !state.showExplanation[action.payload],
        },
      }
    case 'go-next': {
      const nextIndex = Math.min(state.currentIndex + 1, action.total - 1)
      const answers = action.timedOut && state.answers[state.currentIndex] === undefined
        ? { ...state.answers, [state.currentIndex]: -1 }
        : state.answers

      return {
        ...state,
        currentIndex: nextIndex,
        answers,
        remainingSeconds: state.timerMode === 'per-question' ? state.timePerQuestion : state.remainingSeconds,
      }
    }
    case 'go-prev':
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
        remainingSeconds: state.timerMode === 'per-question' ? state.timePerQuestion : state.remainingSeconds,
      }
    case 'tick': {
      if (state.paused) return state
      const nextSeconds = Math.max(0, state.remainingSeconds - 1)

      if (nextSeconds > 0) {
        return { ...state, remainingSeconds: nextSeconds }
      }

      if (state.timerMode === 'full-quiz') {
        return { ...state, remainingSeconds: 0 }
      }

      const timedOutAnswers = state.answers[state.currentIndex] === undefined
        ? { ...state.answers, [state.currentIndex]: -1 }
        : state.answers

      return {
        ...state,
        answers: timedOutAnswers,
        currentIndex: Math.min(state.currentIndex + 1, action.total - 1),
        remainingSeconds: state.timePerQuestion,
      }
    }
    case 'reset':
      return {
        ...state,
        currentIndex: 0,
        answers: {},
        showExplanation: {},
        paused: false,
        remainingSeconds: state.timerMode === 'per-question' ? state.timePerQuestion : state.fullQuizTime,
      }
    default:
      return state
  }
}

export function useQuizEngine({ quizItems, deckId, onSubmit }) {
  const [state, dispatch] = useReducer(quizReducer, deckId, createInitialState)
  const startedAtRef = useRef(0)
  const submittedRef = useRef(false)

  const total = quizItems?.length || 0
  const current = quizItems?.[state.currentIndex] || null
  const selected = state.answers[state.currentIndex]
  const isAnswered = selected !== undefined

  const score = useMemo(() => {
    return Object.entries(state.answers).reduce((acc, [index, selectedIndex]) => {
      const question = quizItems?.[Number(index)]
      return acc + (question && question.correct_index === selectedIndex ? 1 : 0)
    }, 0)
  }, [quizItems, state.answers])

  const answeredCount = Object.keys(state.answers).length
  const finished = total > 0 && answeredCount === total

  useEffect(() => {
    if (!startedAtRef.current) {
      startedAtRef.current = Date.now()
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      dispatch({ type: 'tick', total: Math.max(total, 1) })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [total])

  useEffect(() => {
    // Rehydrate quiz session when switching decks.
    dispatch({ type: 'hydrate', payload: createInitialState(deckId) })
    submittedRef.current = false
    startedAtRef.current = Date.now()
  }, [deckId])

  useEffect(() => {
    // Keep active index inside bounds when quiz set changes.
    if (total > 0 && state.currentIndex >= total) {
      dispatch({ type: 'set-current-index', payload: 0 })
    }
  }, [state.currentIndex, total])

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(deckId), JSON.stringify({
        deckId: deckId || null,
        currentIndex: state.currentIndex,
        answers: state.answers,
        showExplanation: state.showExplanation,
        difficulty: state.difficulty,
        timerMode: state.timerMode,
        remainingSeconds: state.remainingSeconds,
      }))
    } catch {
      // Ignore local storage errors.
    }
  }, [deckId, state])

  useEffect(() => {
    if (!quizItems || !quizItems.length) return
    if (submittedRef.current) return
    if (!(finished || (state.timerMode === 'full-quiz' && state.remainingSeconds <= 0))) return

    submittedRef.current = true
    onSubmit?.({
      deckId,
      difficulty: state.difficulty,
      score,
      total,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      answers: state.answers,
      quizItems,
    })
  }, [deckId, finished, onSubmit, quizItems, score, state.answers, state.difficulty, state.remainingSeconds, state.timerMode, total])

  const resetQuiz = useCallback(() => {
    submittedRef.current = false
    startedAtRef.current = Date.now()
    dispatch({ type: 'reset' })
  }, [])

  return {
    state: {
      ...state,
      total,
      current,
      selected,
      isAnswered,
      score,
      finished,
    },
    actions: {
      setDifficulty: (value) => dispatch({ type: 'set-difficulty', payload: value }),
      setTimerMode: (value) => dispatch({ type: 'set-timer-mode', payload: value }),
      setTimePerQuestion: (value) => dispatch({ type: 'set-time-per-question', payload: value }),
      setFullQuizTime: (value) => dispatch({ type: 'set-full-quiz-time', payload: value }),
      setPaused: () => dispatch({ type: 'toggle-paused' }),
      setVoiceEnabled: () => dispatch({ type: 'toggle-voice' }),
      setCurrentIndex: (value) => dispatch({ type: 'set-current-index', payload: value }),
      selectOption: (option) => dispatch({ type: 'select-option', payload: option }),
      goNext: (timedOut = false) => dispatch({ type: 'go-next', total: Math.max(total, 1), timedOut }),
      goPrev: () => dispatch({ type: 'go-prev' }),
      resetQuiz,
      toggleExplanation: (idx) => dispatch({ type: 'toggle-explanation', payload: idx }),
    },
  }
}
