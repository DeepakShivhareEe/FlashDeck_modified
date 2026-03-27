import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BookOpen, Brain, Home, Upload, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import LearningFlowStepper from '../components/workflow/LearningFlowStepper'
import DataStateView from '../components/ui/DataStateView'
import SkeletonBlock from '../components/ui/SkeletonBlock'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useAppState } from '../state/useAppState'
import { buildFallbackQuizFromCards, generateDeckFromFiles } from '../services/deckService'

const ACCEPTED_TYPES = '.pdf,.ppt,.pptx,.doc,.docx,.txt'
const MotionSection = motion.section
const MotionDiv = motion.div

export default function Dashboard({ authUser }) {
  const {
    state: { files, deckId, processing, lastError },
    actions,
  } = useAppState()

  const [processingProgress, setProcessingProgress] = useState(0)

  const generateDeckAction = useAsyncAction(async (selectedFiles) => {
    const progressTimer = window.setInterval(() => {
      setProcessingProgress((prev) => Math.min(prev + 7, 95))
    }, 220)

    try {
      const data = await generateDeckFromFiles(selectedFiles)
      setProcessingProgress(100)
      return data
    } finally {
      window.clearInterval(progressTimer)
    }
  }, {
    defaultError: 'Unable to generate deck',
    maxRetries: 2,
  })

  const activeFlowStep = useMemo(() => {
    if (processing) return 'Processing'
    if (deckId) return 'Flashcards'
    if (files.length > 0) return 'Upload'
    return 'Upload'
  }, [deckId, files.length, processing])

  const handleFileChange = (event) => {
    const nextFiles = event.target.files ? Array.from(event.target.files) : []
    actions.setFiles(nextFiles)
    actions.clearGeneratedData()
    actions.setError('')
  }

  const handleGenerate = async () => {
    if (!files.length) return

    actions.clearGeneratedData()
    actions.setProcessing(true)
    actions.setError('')
    setProcessingProgress(8)

    try {
      const data = await generateDeckAction.execute(files)
      console.info('[FlashDeck] Full response:', data)
      const cards = data?.cards || []
      const quiz = (data?.quiz && data.quiz.length > 0)
        ? data.quiz
        : buildFallbackQuizFromCards(cards, 10)
      console.info('[FlashDeck] Generated counts:', {
        cards: Array.isArray(cards) ? cards.length : 0,
        quiz: Array.isArray(quiz) ? quiz.length : 0,
        flowcharts: Array.isArray(data?.flowcharts) ? data.flowcharts.length : 0,
      })
      actions.setGeneratedData({
        cards,
        quiz,
        flowcharts: data?.flowcharts || [],
        deckName: data?.deck_name || '',
        deckId: data?.deck_id || null,
      })
    } catch (error) {
      actions.setError(error?.message || 'Generation failed')
      actions.setProcessing(false)
    }
  }

  const handleRetry = async () => {
    if (!files.length) return
    actions.setProcessing(true)
    actions.setError('')
    setProcessingProgress(12)
    try {
      const data = await generateDeckAction.retry()
      const cards = data?.cards || []
      const quiz = (data?.quiz && data.quiz.length > 0)
        ? data.quiz
        : buildFallbackQuizFromCards(cards, 10)
      console.info('[FlashDeck] Retry response:', data)
      actions.setGeneratedData({
        cards,
        quiz,
        flowcharts: data?.flowcharts || [],
        deckName: data?.deck_name || '',
        deckId: data?.deck_id || null,
      })
    } catch (error) {
      actions.setError(error?.message || 'Retry failed')
      actions.setProcessing(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#191919] p-6 font-sans text-gray-200">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-15%] top-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[460px] w-[460px] rounded-full bg-orange-600/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Zap size={16} className="text-orange-400" fill="currentColor" />
              <span className="text-sm font-medium tracking-wide text-gray-300">FlashDeck AI Workspace</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">Document To Active Learning</h1>
            <p className="mt-2 max-w-2xl text-gray-400">Upload files, let AI process them, then continue directly into flashcards, quiz, and analytics.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-full border border-white/10 bg-white/5 p-3 text-gray-300 hover:bg-white/10" title="Home">
              <Home size={18} />
            </Link>
            <Link to="/leaderboard" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Leaderboard</Link>
            {authUser ? (
              <>
                <Link to="/analytics" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Analytics</Link>
                <Link to="/review" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Daily Review</Link>
                <Link to="/profile" className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-xs hover:bg-cyan-500/30">Profile</Link>
              </>
            ) : (
              <Link to="/auth" className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-xs hover:bg-cyan-500/30">Login</Link>
            )}
          </div>
        </header>

        <LearningFlowStepper activeStep={activeFlowStep} />

        <AnimatePresence mode="wait">
          {!deckId && !processing && (
            <MotionSection
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24 }}
              className="mt-6 rounded-2xl border border-white/10 bg-[#202020]/95 p-8 shadow-2xl"
            >
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5">
                  <Upload size={26} className="text-cyan-300" />
                </div>
                <h2 className="text-2xl font-semibold text-white">Upload Learning Material</h2>
                <p className="mt-2 text-sm text-gray-400">Supports PDF, PPT, DOC, and TXT. Multiple files can be merged into one deck.</p>

                <label className="mt-6 block cursor-pointer rounded-xl border border-dashed border-white/20 bg-[#171717] px-6 py-8 hover:border-cyan-300/40 hover:bg-[#1c1c1c]">
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-sm text-gray-300">{files.length ? `${files.length} file(s) selected` : 'Click to choose files'}</p>
                </label>

                <button
                  onClick={handleGenerate}
                  disabled={!files.length || generateDeckAction.loading}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generateDeckAction.loading ? 'Generating...' : 'Generate FlashDeck'}
                  <ArrowRight size={16} />
                </button>

                {(lastError || generateDeckAction.error) && (
                  <div className="mt-5">
                    <DataStateView
                      state="error"
                      title="Generation failed"
                      message={lastError || generateDeckAction.error}
                      actionLabel="Retry"
                      onAction={handleRetry}
                    />
                  </div>
                )}
              </div>
            </MotionSection>
          )}

          {processing && (
            <MotionSection
              key="processing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24 }}
              className="mt-6 rounded-2xl border border-cyan-300/20 bg-[#202020]/95 p-8"
            >
              <h2 className="text-xl font-semibold text-white">Processing Files</h2>
              <p className="mt-1 text-sm text-gray-400">Extracting text, generating cards, creating quiz and flowcharts.</p>

              <div className="mt-4 h-2 rounded-full bg-white/10">
                <MotionDiv
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                  animate={{ width: `${processingProgress}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
              <p className="mt-2 text-xs text-cyan-100">{Math.floor(processingProgress)}% completed</p>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <SkeletonBlock className="h-24" />
                <SkeletonBlock className="h-24" />
                <SkeletonBlock className="h-24" />
                <SkeletonBlock className="h-24" />
              </div>
            </MotionSection>
          )}

          {deckId && !processing && (
            <MotionSection
              key="ready"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24 }}
              className="mt-6"
            >
              <DataStateView
                state="success"
                title="Deck generated successfully"
                message="Continue your flow with flashcards, quiz, and analytics."
              />

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Link to="/my-decks" className="group rounded-2xl border border-white/10 bg-[#202020] p-6 transition-all hover:-translate-y-1 hover:border-orange-300/40">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                    <BookOpen size={22} />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Flashcards + Quiz</h3>
                  <p className="mt-2 text-sm text-gray-400">Review cards, run interactive quiz, and submit results.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm text-white">Open Study Mode <ArrowRight size={14} /></span>
                </Link>

                <Link to="/knowledge-base" className="group rounded-2xl border border-white/10 bg-[#202020] p-6 transition-all hover:-translate-y-1 hover:border-cyan-300/40">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
                    <Brain size={22} />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Knowledge Base</h3>
                  <p className="mt-2 text-sm text-gray-400">Inspect generated flowcharts and ask questions about source documents.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm text-white">Open Knowledge View <ArrowRight size={14} /></span>
                </Link>
              </div>
            </MotionSection>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
