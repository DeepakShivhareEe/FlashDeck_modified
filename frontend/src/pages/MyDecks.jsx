import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Sparkles, Filter, Home, FileText, CircleCheckBig, CircleX, BadgeHelp, Mic, MicOff, Volume2, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { requestBlob, requestJson } from '../lib/api'

export default function MyDecks({ cards, quiz, deckName, deckId, authUser }) {
    const [selectedTopic, setSelectedTopic] = useState(null)
    const [viewMode, setViewMode] = useState('cards')
    const cardsRef = useRef(null)

    // Group cards by topic
    const topics = selectedTopic ? [] : Array.from(new Set(cards.map(c => c.topic || "General"))).sort()

    const filteredCards = selectedTopic
        ? cards.filter(c => (c.topic || "General") === selectedTopic)
        : []

    if (!cards || cards.length === 0) {
        return (
            <div className="min-h-screen bg-[#191919] text-gray-200 flex flex-col items-center justify-center">
                <BookOpen size={64} className="text-gray-700 mb-6" />
                <h2 className="text-xl font-medium text-gray-400">No Flashcards Generated Yet</h2>
                <Link to="/app" className="mt-6 text-orange-400 hover:text-orange-300">
                    Go back to Dashboard
                </Link>
            </div>
        )
    }

    const downloadPDF = async () => {
        if (!cardsRef.current || filteredCards.length === 0) return;
        try {
            const { blob } = await requestBlob('/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deck_id: deckId,
                    deck_name: deckName || 'FlashDeck',
                    cards: filteredCards,
                    format: 'pdf',
                }),
            })
            triggerDownload(blob, `flashdeck-${selectedTopic || 'all'}.pdf`)
        } catch {
            // Safe fallback to client rendering if export API is unavailable.
            const canvas = await html2canvas(cardsRef.current, {
                backgroundColor: '#191919',
                scale: 2,
                logging: false,
            })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width

            if (pdfHeight > 297) {
                pdf.addPage()
                pdf.deletePage(1)
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            } else {
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            }
            pdf.save(`flashdeck-${selectedTopic || 'all'}.pdf`)
        }
    }

    const downloadCSV = async () => {
        const exportCards = selectedTopic ? filteredCards : cards
        if (!exportCards?.length) return
        try {
            const { blob } = await requestBlob('/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deck_id: deckId,
                    deck_name: deckName || 'FlashDeck',
                    cards: exportCards,
                    format: 'csv',
                }),
            })
            triggerDownload(blob, `flashdeck-${selectedTopic || 'all'}.csv`)
        } catch {
            alert('CSV export failed')
        }
    }

    return (
        <div className="min-h-screen bg-[#191919] text-gray-200 font-sans p-6 md:p-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                    <Link to="/app" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors" title="Back to Dashboard">
                        <ArrowLeft size={20} />
                    </Link>
                    <Link to="/" className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors" title="Go Home">
                        <Home size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{deckName || "Untitled Deck"}</h1>
                        <p className="text-sm text-gray-500">{selectedTopic ? `Topic: ${selectedTopic}` : `${cards.length} Cards Total`}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#222] p-1">
                    <button
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'cards' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}
                    >
                        Flashcards
                    </button>
                    <button
                        onClick={() => setViewMode('quiz')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'quiz' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}
                    >
                        Quiz
                    </button>
                </div>

                {/* Export Controls for Topic View */}
                {selectedTopic && viewMode === 'cards' && (
                    <div className="flex gap-2">
                        <button onClick={downloadPDF} className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#333] rounded-lg text-sm border border-white/10 transition-colors">
                            <FileText size={16} /> PDF
                        </button>
                        <button onClick={downloadCSV} className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#333] rounded-lg text-sm border border-white/10 transition-colors">
                            <FileText size={16} /> CSV
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            {viewMode === 'quiz' ? (
                <QuizSection quiz={quiz || []} cards={cards || []} deckId={deckId} authUser={authUser} />
            ) : !selectedTopic ? (
                // Topic Grid
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topics.map(topic => {
                        const count = cards.filter(c => (c.topic || "General") === topic).length
                        return (
                            <div key={topic} onClick={() => setSelectedTopic(topic)} className="bg-[#202020] border border-white/5 p-8 rounded-2xl hover:border-orange-500/50 hover:bg-[#252525] transition-all cursor-pointer group">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="p-2 bg-orange-500/10 rounded-lg">
                                        <Filter size={20} className="text-orange-500" />
                                    </span>
                                    <span className="text-xs font-mono text-gray-500">{count} CARDS</span>
                                </div>
                                <h3 className="text-xl font-semibold text-white group-hover:text-orange-400 transition-colors">{topic}</h3>
                            </div>
                        )
                    })}
                </div>
            ) : (
                // Flashcards List
                <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {filteredCards.map((card, idx) => (
                        <FlashcardItem key={idx} card={card} />
                    ))}
                </div>
            )}
        </div>
    )
}

function FlashcardItem({ card }) {
    const [flipped, setFlipped] = useState(false)
    return (
        <div
            onClick={() => setFlipped(!flipped)}
            className="group relative bg-[#202020] hover:bg-[#252525] border border-white/5 rounded-xl p-8 min-h-[280px] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-center items-center text-center preserve-3d"
        >
            {!flipped ? (
                <>
                    <span className="absolute top-4 left-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">Question</span>
                    <h3 className="text-lg font-medium text-white leading-relaxed">{card.q}</h3>
                    <div className="absolute bottom-4 text-gray-600 text-xs flex items-center gap-2">
                        <Sparkles size={12} /> Click to reveal
                    </div>
                </>
            ) : (
                <>
                    <span className="absolute top-4 left-4 text-[10px] font-mono text-orange-500 uppercase tracking-widest">Answer</span>
                    <p className="text-base text-gray-300 leading-relaxed">{card.a}</p>
                </>
            )}
        </div>
    )
}


function QuizSection({ quiz, cards, deckId, authUser }) {
    const [quizItems, setQuizItems] = useState(quiz)
    const [difficulty, setDifficulty] = useState('medium')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswers] = useState({})
    const [showExplanation, setShowExplanation] = useState({})
    const [timerMode, setTimerMode] = useState('per-question')
    const [timePerQuestion, setTimePerQuestion] = useState(45)
    const [fullQuizTime, setFullQuizTime] = useState(300)
    const [remainingSeconds, setRemainingSeconds] = useState(45)
    const [paused, setPaused] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [quizError, setQuizError] = useState('')
    const [loadingQuiz, setLoadingQuiz] = useState(false)
    const [voiceEnabled, setVoiceEnabled] = useState(false)
    const startedAtRef = useRef(Date.now())
    const submittedRef = useRef(false)

    const storageKey = `flashdeck_quiz_session_${deckId || 'local'}`

    useEffect(() => {
        setQuizItems(quiz)
    }, [quiz])

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey)
            if (!raw) return
            const state = JSON.parse(raw)
            if (state?.deckId !== (deckId || null)) return

            setCurrentIndex(state.currentIndex || 0)
            setAnswers(state.answers || {})
            setShowExplanation(state.showExplanation || {})
            setDifficulty(state.difficulty || 'medium')
            setTimerMode(state.timerMode || 'per-question')
            setRemainingSeconds(state.remainingSeconds || 45)
        } catch {
            // Ignore corrupted local state.
        }
    }, [deckId, storageKey])

    useEffect(() => {
        const payload = {
            deckId: deckId || null,
            currentIndex,
            answers,
            showExplanation,
            difficulty,
            timerMode,
            remainingSeconds,
        }
        try {
            localStorage.setItem(storageKey, JSON.stringify(payload))
        } catch {
            // Ignore storage quota errors.
        }
    }, [answers, currentIndex, deckId, difficulty, remainingSeconds, showExplanation, storageKey, timerMode])

    useEffect(() => {
        if (timerMode === 'per-question') {
            setRemainingSeconds(timePerQuestion)
        } else {
            setRemainingSeconds(fullQuizTime)
        }
    }, [timerMode, timePerQuestion, fullQuizTime])

    useEffect(() => {
        if (timerMode === 'per-question') {
            setRemainingSeconds(timePerQuestion)
        }
    }, [currentIndex, timerMode, timePerQuestion])

    useEffect(() => {
        if (paused) return
        if (remainingSeconds <= 0) {
            if (timerMode === 'per-question') {
                if (answers[currentIndex] === undefined) {
                    setAnswers((prev) => ({ ...prev, [currentIndex]: -1 }))
                }
                setCurrentIndex((prev) => Math.min(prev + 1, Math.max((quizItems?.length || 1) - 1, 0)))
            }
            return
        }

        const interval = window.setInterval(() => {
            setRemainingSeconds((prev) => Math.max(0, prev - 1))
        }, 1000)

        return () => window.clearInterval(interval)
    }, [answers, currentIndex, paused, quizItems?.length, remainingSeconds, timerMode])

    useEffect(() => {
        if (!voiceEnabled) return
        if (!quizItems?.length) return
        readCurrentQuestion(quizItems[currentIndex])
    }, [voiceEnabled, currentIndex, quizItems])

    const total = quizItems?.length || 0
    const current = quizItems?.[currentIndex] || null
    const selected = answers[currentIndex]
    const isAnswered = selected !== undefined
    const score = Object.entries(answers).reduce((acc, [idx, selectedIdx]) => {
        const q = quizItems?.[Number(idx)]
        return acc + (q && q.correct_index === selectedIdx ? 1 : 0)
    }, 0)

    const answeredCount = Object.keys(answers).length
    const finished = answeredCount === total

    const handleSelect = (optionIndex) => {
        if (isAnswered) return
        setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }))
    }

    const goNext = (timedOut = false) => {
        if (timedOut && answers[currentIndex] === undefined) {
            setAnswers((prev) => ({ ...prev, [currentIndex]: -1 }))
        }
        setCurrentIndex((prev) => Math.min(prev + 1, total - 1))
    }

    const goPrev = () => {
        setCurrentIndex((prev) => Math.max(prev - 1, 0))
    }

    const resetQuiz = () => {
        setCurrentIndex(0)
        setAnswers({})
        setShowExplanation({})
        setQuizError('')
        setPaused(false)
        submittedRef.current = false
        startedAtRef.current = Date.now()
        setRemainingSeconds(timerMode === 'per-question' ? timePerQuestion : fullQuizTime)
    }

    const regenerateQuiz = async (nextDifficulty) => {
        setLoadingQuiz(true)
        setQuizError('')
        try {
            const res = await requestJson('/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deck_id: deckId,
                    cards,
                    question_count: 10,
                    difficulty: nextDifficulty,
                }),
            }, 0, 90000)
            setQuizItems(res?.quiz || [])
            setDifficulty(nextDifficulty)
            resetQuiz()
        } catch (err) {
            setQuizError(err?.message || 'Failed to generate quiz')
        } finally {
            setLoadingQuiz(false)
        }
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))

    useEffect(() => {
        if (!quizItems || quizItems.length === 0) return
        if (submittedRef.current) return
        if (!(finished || (timerMode === 'full-quiz' && remainingSeconds <= 0))) return

        submittedRef.current = true
        setIsSubmitting(true)

        const answersPayload = quizItems.map((q, idx) => ({
            question: q.question,
            selected_index: answers[idx] ?? -1,
            correct_index: q.correct_index,
            explanation: q.explanation,
            topic: q.topic || 'General',
            answer: q.options?.[q.correct_index] || q.explanation || '',
        }))

        requestJson('/submit-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deck_id: deckId,
                difficulty,
                score,
                total_questions: total,
                duration_seconds: durationSeconds,
                answers: answersPayload,
            }),
        }, 0, 20000)
            .catch(() => {
                // Keep quiz UX resilient even if backend submit fails.
            })
            .finally(() => setIsSubmitting(false))
    }, [answers, deckId, difficulty, durationSeconds, finished, quizItems, remainingSeconds, score, timerMode, total])

    if (!quizItems || quizItems.length === 0 || !current) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#202020] p-10 text-center text-gray-400">
                Quiz is not available for this deck yet.
            </div>
        )
    }

    const listenForVoiceAnswer = () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!Recognition) {
            alert('Speech recognition is not supported in this browser.')
            return
        }

        const recognition = new Recognition()
        recognition.lang = 'en-US'
        recognition.interimResults = false
        recognition.maxAlternatives = 1
        recognition.onresult = (event) => {
            const transcript = event?.results?.[0]?.[0]?.transcript?.toLowerCase() || ''
            const mapping = { a: 0, b: 1, c: 2, d: 3, one: 0, two: 1, three: 2, four: 3 }
            const key = Object.keys(mapping).find((k) => transcript.includes(k))
            if (key !== undefined) {
                handleSelect(mapping[key])
            }
        }
        recognition.start()
    }

    const readCurrentQuestion = (question) => {
        if (!('speechSynthesis' in window)) {
            return
        }
        const speech = new SpeechSynthesisUtterance(`${question.question}. Options: ${question.options.join(', ')}`)
        speech.rate = 1
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(speech)
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-[#202020] p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <p className="text-xs text-gray-400 mb-1">Difficulty</p>
                    <select
                        value={difficulty}
                        onChange={(e) => regenerateQuiz(e.target.value)}
                        className="w-full rounded-md bg-[#101010] border border-white/15 px-2 py-2 text-sm"
                        disabled={loadingQuiz}
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>

                <div>
                    <p className="text-xs text-gray-400 mb-1">Timer Mode</p>
                    <select
                        value={timerMode}
                        onChange={(e) => setTimerMode(e.target.value)}
                        className="w-full rounded-md bg-[#101010] border border-white/15 px-2 py-2 text-sm"
                    >
                        <option value="per-question">Per Question</option>
                        <option value="full-quiz">Full Quiz</option>
                    </select>
                </div>

                <div>
                    <p className="text-xs text-gray-400 mb-1">Seconds</p>
                    <input
                        type="number"
                        min={10}
                        max={1800}
                        value={timerMode === 'per-question' ? timePerQuestion : fullQuizTime}
                        onChange={(e) => {
                            const value = Math.max(10, Number(e.target.value) || 10)
                            if (timerMode === 'per-question') setTimePerQuestion(value)
                            else setFullQuizTime(value)
                        }}
                        className="w-full rounded-md bg-[#101010] border border-white/15 px-2 py-2 text-sm"
                    />
                </div>

                <div className="flex items-end gap-2">
                    <button
                        onClick={() => setPaused((prev) => !prev)}
                        className="rounded-md border border-white/20 px-3 py-2 text-sm"
                    >
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                        onClick={() => setVoiceEnabled((prev) => !prev)}
                        className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-300"
                    >
                        {voiceEnabled ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#202020] p-4 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                <p className="text-sm text-gray-300">Question {currentIndex + 1}/{total}</p>
                <div className="h-2 flex-1 sm:max-w-xs bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${((currentIndex + 1) / total) * 100}%` }} />
                </div>
                <p className="text-sm text-gray-300">Score: {score}/{total}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#202020] px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-300 inline-flex items-center gap-2"><Clock3 size={14} /> Timer</span>
                <span className={`font-mono ${remainingSeconds <= 10 ? 'text-red-300' : 'text-cyan-300'}`}>
                    {formatSeconds(remainingSeconds)}
                </span>
            </div>

            {(quizError || loadingQuiz) && (
                <div className="rounded-lg border border-white/10 bg-[#202020] p-3 text-sm">
                    {loadingQuiz ? 'Generating quiz...' : <span className="text-red-300">{quizError}</span>}
                </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#202020] p-6 md:p-8">
                <h3 className="text-xl text-white font-semibold leading-relaxed mb-6">{current.question}</h3>

                <div className="mb-4 flex flex-wrap gap-2">
                    <button
                        onClick={() => readCurrentQuestion(current)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-200"
                    >
                        <Volume2 size={14} /> Read Question
                    </button>
                    <button
                        onClick={listenForVoiceAnswer}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/15 border border-indigo-400/30 text-indigo-200"
                    >
                        <Mic size={14} /> Voice Answer
                    </button>
                </div>

                <div className="space-y-3">
                    {current.options.map((option, idx) => {
                        const isCorrect = idx === current.correct_index
                        const isSelected = selected === idx

                        let stateClass = 'border-white/10 hover:border-white/20 bg-[#232323]'
                        if (isAnswered && isCorrect) {
                            stateClass = 'border-green-400/60 bg-green-500/10'
                        } else if (isAnswered && isSelected && !isCorrect) {
                            stateClass = 'border-red-400/60 bg-red-500/10'
                        }

                        return (
                            <button
                                key={`${currentIndex}-${idx}`}
                                onClick={() => handleSelect(idx)}
                                className={`w-full text-left p-4 rounded-lg border transition-all duration-300 ${stateClass}`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-gray-200">{option}</span>
                                    {isAnswered && isCorrect && <CircleCheckBig size={18} className="text-green-400" />}
                                    {isAnswered && isSelected && !isCorrect && <CircleX size={18} className="text-red-400" />}
                                </div>
                            </button>
                        )
                    })}
                </div>

                {isAnswered && (
                    <div className="mt-5 text-sm">
                        {selected === current.correct_index ? (
                            <p className="text-green-400 font-medium">Correct!</p>
                        ) : (
                            <p className="text-red-400 font-medium">Incorrect. Correct answer highlighted in green.</p>
                        )}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowExplanation((prev) => ({ ...prev, [currentIndex]: !prev[currentIndex] }))}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-400/20 transition-colors"
                    >
                        <BadgeHelp size={16} /> {showExplanation[currentIndex] ? 'Hide Explanation' : 'View Explanation'}
                    </button>
                </div>

                {showExplanation[currentIndex] && (
                    <div className="mt-4 rounded-lg border border-white/10 bg-[#1a1a1a] p-4 text-gray-300 leading-relaxed">
                        {current.explanation}
                    </div>
                )}

                <div className="mt-8 flex items-center justify-between">
                    <button
                        onClick={goPrev}
                        disabled={currentIndex === 0}
                        className="px-4 py-2 rounded-lg border border-white/15 text-gray-200 disabled:opacity-40"
                    >
                        Previous
                    </button>
                    <button
                        onClick={goNext}
                        disabled={currentIndex === total - 1}
                        className="px-4 py-2 rounded-lg bg-white text-black disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>

            {finished && (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 p-6 text-center">
                    <h4 className="text-xl text-white font-semibold mb-2">Quiz Complete</h4>
                    <p className="text-gray-200 mb-4">Final Score: {score}/{total}</p>
                    <p className="text-sm text-gray-300 mb-4">Difficulty: {difficulty}</p>
                    {isSubmitting && <p className="text-xs text-cyan-200 mb-3">Syncing attempt...</p>}
                    {!authUser && <p className="text-xs text-gray-300 mb-3">Login to sync attempts, analytics, and SRS progress.</p>}
                    <button onClick={resetQuiz} className="px-4 py-2 rounded-lg bg-white text-black font-medium">
                        Retry Quiz
                    </button>
                </div>
            )}
        </div>
    )
}

function triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

function formatSeconds(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
