import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CircleCheckBig, CircleHelp, CircleX, Sparkles } from 'lucide-react'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'

const MotionButton = motion.button

export default function FlashcardExperience({ cards }) {
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewMarks, setReviewMarks] = useState({})

  const topics = useMemo(
    () => Array.from(new Set((cards || []).map((card) => card.topic || 'General'))).sort(),
    [cards],
  )

  const getQuestion = (card) => card?.q || card?.question || ''
  const getAnswer = (card) => card?.a || card?.answer || ''

  const scopedCards = useMemo(() => {
    if (!selectedTopic) return []
    return cards.filter((card) => (card.topic || 'General') === selectedTopic)
  }, [cards, selectedTopic])

  const activeCard = scopedCards[activeIndex]

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => goNext(),
    onSwipeRight: () => goPrev(),
  })

  const openTopic = (topic) => {
    setSelectedTopic(topic)
    setActiveIndex(0)
    setFlipped(false)
  }

  const goNext = () => {
    if (!scopedCards.length) return
    setActiveIndex((prev) => Math.min(prev + 1, scopedCards.length - 1))
    setFlipped(false)
  }

  const goPrev = () => {
    if (!scopedCards.length) return
    setActiveIndex((prev) => Math.max(prev - 1, 0))
    setFlipped(false)
  }

  const markCard = (value) => {
    if (!activeCard) return
    const key = `${selectedTopic}-${activeIndex}`
    setReviewMarks((prev) => ({ ...prev, [key]: value }))
  }

  if (!selectedTopic) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {topics.map((topic) => {
          const count = cards.filter((card) => (card.topic || 'General') === topic).length
          return (
            <button
              key={topic}
              onClick={() => openTopic(topic)}
              className="group rounded-2xl border border-white/10 bg-[#202020] p-6 text-left transition-all hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-[#242424]"
            >
              <span className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300">
                {count} cards
              </span>
              <h3 className="text-lg font-semibold text-white group-hover:text-cyan-100">{topic}</h3>
              <p className="mt-2 text-sm text-gray-400">Open focused mode with swipe navigation and quick confidence marking.</p>
            </button>
          )
        })}
      </div>
    )
  }

  const markKey = `${selectedTopic}-${activeIndex}`
  const markValue = reviewMarks[markKey]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <button
          onClick={() => setSelectedTopic(null)}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
        >
          Back To Topics
        </button>
        <p className="text-sm text-gray-300">{selectedTopic} · Card {activeIndex + 1}/{scopedCards.length}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={activeIndex === 0}
            className="rounded-md border border-white/20 p-2 text-gray-200 disabled:opacity-40"
          >
            <ArrowLeft size={14} />
          </button>
          <button
            onClick={goNext}
            disabled={activeIndex >= scopedCards.length - 1}
            className="rounded-md border border-white/20 p-2 text-gray-200 disabled:opacity-40"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div {...swipeHandlers} className="relative">
        <AnimatePresence mode="wait">
          <MotionButton
            key={`${selectedTopic}-${activeIndex}-${flipped ? 'answer' : 'question'}`}
            initial={{ opacity: 0, y: 18, rotateX: flipped ? -7 : 7 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -18, rotateX: flipped ? 7 : -7 }}
            transition={{ duration: 0.24 }}
            onClick={() => setFlipped((prev) => !prev)}
            className="w-full rounded-3xl border border-white/10 bg-[#1f1f1f] p-8 text-left shadow-[0_20px_45px_rgba(0,0,0,0.35)]"
          >
            {!flipped ? (
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                  <CircleHelp size={12} /> Prompt
                </span>
                <h3 className="text-2xl font-semibold leading-snug text-white">{getQuestion(activeCard)}</h3>
                <p className="inline-flex items-center gap-2 text-sm text-gray-400"><Sparkles size={14} /> Tap to flip · Swipe to navigate</p>
              </div>
            ) : (
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1 text-xs text-green-200">
                  <CircleCheckBig size={12} /> Answer
                </span>
                <p className="text-xl leading-relaxed text-gray-100">{getAnswer(activeCard)}</p>
              </div>
            )}
          </MotionButton>
        </AnimatePresence>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#181818] p-3">
        <p className="mb-3 text-sm text-gray-300">All Questions ({scopedCards.length})</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {scopedCards.map((card, idx) => (
            <button
              key={`${selectedTopic}-${idx}`}
              onClick={() => {
                setActiveIndex(idx)
                setFlipped(false)
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${idx === activeIndex ? 'border-cyan-300/50 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'}`}
            >
              {idx + 1}. {getQuestion(card) || 'Untitled prompt'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="mb-2 text-sm text-gray-300">How well do you know this card?</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => markCard('known')}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${markValue === 'known' ? 'bg-green-500/20 text-green-100 border border-green-300/40' : 'bg-white/5 text-gray-200 border border-white/15 hover:bg-white/10'}`}
          >
            Known
          </button>
          <button
            onClick={() => markCard('unknown')}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${markValue === 'unknown' ? 'bg-red-500/20 text-red-100 border border-red-300/40' : 'bg-white/5 text-gray-200 border border-white/15 hover:bg-white/10'}`}
          >
            Unknown
          </button>
          {markValue === 'unknown' && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              <CircleX size={12} /> This card should be reviewed again.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
