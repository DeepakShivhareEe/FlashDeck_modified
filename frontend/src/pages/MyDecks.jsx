import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Home } from 'lucide-react'
import FlashcardExperience from '../components/deck/FlashcardExperience'
import QuizExperience from '../components/deck/QuizExperience'
import DataStateView from '../components/ui/DataStateView'
import { useAppState } from '../state/useAppState'
import { exportDeckCards } from '../services/deckService'

export default function MyDecks({ authUser }) {
  const {
    state: { cards, quiz, deckName, deckId },
    actions,
  } = useAppState()

  const [viewMode, setViewMode] = useState('cards')
  const [exportError, setExportError] = useState('')
  const cardsContainerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    actions.setWorkflowStep(viewMode === 'quiz' ? 'quiz' : 'flashcards')
  }, [actions, viewMode])

  useEffect(() => {
    console.info('[FlashDeck] Flashcards state:', {
      count: Array.isArray(cards) ? cards.length : 0,
      sample: Array.isArray(cards) && cards.length ? cards[0] : null,
    })
    console.info('[FlashDeck] Quiz state:', {
      count: Array.isArray(quiz) ? quiz.length : 0,
      sample: Array.isArray(quiz) && quiz.length ? quiz[0] : null,
    })
  }, [cards, quiz])

  if (!cards || cards.length === 0) {
    return (
      <div className="min-h-screen bg-[#191919] p-6 text-gray-200">
        <div className="mx-auto max-w-3xl">
          <DataStateView
            state="empty"
            title="No flashcards yet"
            message="Generate a deck from dashboard before opening study mode."
            actionLabel="Open Dashboard"
            onAction={() => window.location.assign('/app')}
          />
        </div>
      </div>
    )
  }

  const downloadPDF = async () => {
    setExportError('')
    try {
      const { blob } = await exportDeckCards({
        deckId,
        deckName,
        cards,
        format: 'pdf',
      })
      triggerDownload(blob, `flashdeck-${deckName || 'study'}.pdf`)
    } catch {
      if (!cardsContainerRef.current) {
        setExportError('Unable to export PDF for this deck.')
        return
      }

      try {
        const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ])
        const canvas = await html2canvas(cardsContainerRef.current, {
          backgroundColor: '#191919',
          scale: 2,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/png')
        const pdf = new JsPDF('p', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width

        if (pdfHeight > 297) {
          pdf.addPage()
          pdf.deletePage(1)
        }

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
        pdf.save(`flashdeck-${deckName || 'study'}.pdf`)
      } catch {
        setExportError('PDF export failed. Please retry.')
      }
    }
  }

  const downloadCSV = async () => {
    setExportError('')
    try {
      const { blob } = await exportDeckCards({
        deckId,
        deckName,
        cards,
        format: 'csv',
      })
      triggerDownload(blob, `flashdeck-${deckName || 'study'}.csv`)
    } catch {
      setExportError('CSV export failed. Please retry.')
    }
  }

  return (
    <div className="min-h-screen bg-[#191919] p-6 font-sans text-gray-200 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/app" className="rounded-full border border-white/10 bg-white/5 p-2 hover:bg-white/10" title="Back to Dashboard">
              <ArrowLeft size={18} />
            </Link>
            <Link to="/" className="rounded-full border border-white/10 bg-white/5 p-2 hover:bg-white/10" title="Home">
              <Home size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{deckName || 'Untitled Deck'}</h1>
              <p className="text-sm text-gray-400">{cards.length} cards · {quiz?.length || 0} quiz items</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-[#222] p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${viewMode === 'cards' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}
              >
                Flashcards
              </button>
              <button
                onClick={() => setViewMode('quiz')}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${viewMode === 'quiz' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}
              >
                Quiz
              </button>
            </div>

            {viewMode === 'cards' && (
              <>
                <button onClick={downloadPDF} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm hover:bg-[#333]">
                  <FileText size={15} /> PDF
                </button>
                <button onClick={downloadCSV} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm hover:bg-[#333]">
                  <FileText size={15} /> CSV
                </button>
              </>
            )}
          </div>
        </header>

        {exportError && (
          <DataStateView
            state="error"
            title="Export failed"
            message={exportError}
          />
        )}

        <section ref={cardsContainerRef}>
          {viewMode === 'cards' ? (
            <FlashcardExperience cards={cards} />
          ) : (
            <QuizExperience
              quiz={quiz || []}
              cards={cards || []}
              deckId={deckId}
              authUser={authUser}
              onQuizUpdate={(nextQuiz) => actions.setQuiz(nextQuiz)}
              onQuizFinished={(result) => {
                actions.setLatestQuizResult({
                  ...result,
                  deckId,
                  deckName,
                })
                actions.setWorkflowStep('results')
                navigate('/quiz-results')
              }}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
