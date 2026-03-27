import { createContext, useMemo, useReducer } from 'react'

const AppStateContext = createContext(null)

const initialState = {
  files: [],
  cards: [],
  quiz: [],
  flowcharts: [],
  deckName: '',
  deckId: null,
  workflowStep: 'upload',
  uploadProgress: 0,
  processing: false,
  lastError: '',
  latestQuizResult: null,
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return [value]
  return []
}

function appStateReducer(state, action) {
  switch (action.type) {
    case 'set-files':
      return {
        ...state,
        files: action.payload,
        uploadProgress: action.payload.length ? 100 : 0,
        workflowStep: action.payload.length ? 'upload' : 'upload',
        lastError: '',
      }
    case 'set-upload-progress':
      return {
        ...state,
        uploadProgress: action.payload,
      }
    case 'set-processing':
      return {
        ...state,
        processing: action.payload,
        workflowStep: action.payload ? 'processing' : state.workflowStep,
      }
    case 'set-workflow-step':
      return {
        ...state,
        workflowStep: action.payload || state.workflowStep,
      }
    case 'set-generated-data':
      return {
        ...state,
        cards: normalizeArray(action.payload.cards),
        quiz: normalizeArray(action.payload.quiz),
        flowcharts: normalizeArray(action.payload.flowcharts),
        deckName: action.payload.deckName || '',
        deckId: action.payload.deckId || null,
        processing: false,
        workflowStep: 'ready',
        lastError: '',
      }
    case 'set-quiz':
      return {
        ...state,
        quiz: normalizeArray(action.payload),
      }
    case 'set-flowcharts':
      return {
        ...state,
        flowcharts: normalizeArray(action.payload),
      }
    case 'set-latest-quiz-result':
      return {
        ...state,
        latestQuizResult: action.payload || null,
      }
    case 'set-error':
      return {
        ...state,
        lastError: action.payload || '',
        processing: false,
      }
    case 'clear-generated-data':
      return {
        ...state,
        cards: [],
        quiz: [],
        flowcharts: [],
        deckName: '',
        deckId: null,
        processing: false,
        workflowStep: state.files.length ? 'upload' : 'upload',
      }
    case 'reset-all':
      return {
        ...initialState,
      }
    default:
      return state
  }
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appStateReducer, initialState)

  const actions = useMemo(() => ({
    setFiles: (files) => dispatch({ type: 'set-files', payload: files }),
    setUploadProgress: (value) => dispatch({ type: 'set-upload-progress', payload: value }),
    setProcessing: (value) => dispatch({ type: 'set-processing', payload: value }),
    setWorkflowStep: (value) => dispatch({ type: 'set-workflow-step', payload: value }),
    setGeneratedData: (payload) => dispatch({ type: 'set-generated-data', payload }),
    setQuiz: (payload) => dispatch({ type: 'set-quiz', payload }),
    setFlowcharts: (payload) => dispatch({ type: 'set-flowcharts', payload }),
    setLatestQuizResult: (payload) => dispatch({ type: 'set-latest-quiz-result', payload }),
    setError: (message) => dispatch({ type: 'set-error', payload: message }),
    clearGeneratedData: () => dispatch({ type: 'clear-generated-data' }),
    resetAll: () => dispatch({ type: 'reset-all' }),
  }), [])

  const value = useMemo(() => ({ state, actions }), [actions, state])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export { AppStateContext }
