import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bot, FileText, Home, Send, Share2, User as UserIcon, ZoomIn, ZoomOut } from 'lucide-react'
import MermaidEditor from '../components/MermaidEditor'
import DataStateView from '../components/ui/DataStateView'
import SkeletonBlock from '../components/ui/SkeletonBlock'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { askDeckQuestion } from '../services/chatService'
import { useAppState } from '../state/useAppState'

function ChatPane({ deckId }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! Ask anything about your uploaded files and I will answer from your deck context.' },
  ])
  const [input, setInput] = useState('')

  const chatAction = useAsyncAction(async (message) => {
    const response = await askDeckQuestion({ deckId, message })
    return response?.answer || 'No response generated.'
  }, {
    defaultError: 'Unable to send your message',
    maxRetries: 2,
  })

  const handleSend = async () => {
    if (!input.trim() || chatAction.loading) return

    if (!deckId) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'No active deck found. Please generate a deck from Dashboard first, then open Knowledge Base.',
        },
      ])
      return
    }

    const outgoing = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: outgoing }])
    setInput('')

    try {
      const answer = await chatAction.execute(outgoing)
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'I hit an issue processing that request. Please retry.' },
      ])
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-white/5 bg-[#111]">
      <div className="border-b border-white/5 p-4">
        <span className="flex items-center gap-2 font-medium text-white"><Bot size={16} /> AI Assistant</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, idx) => (
          <div key={`${message.role}-${idx}`} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`grid h-8 w-8 place-items-center rounded-full ${message.role === 'user' ? 'bg-white/10' : 'bg-orange-500/15'}`}>
              {message.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} className="text-orange-400" />}
            </div>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${message.role === 'user' ? 'bg-[#2a2a2a] text-white' : 'border border-white/10 bg-transparent text-gray-300'}`}>
              {message.content}
            </div>
          </div>
        ))}

        {chatAction.loading && (
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-4/5" />
            <SkeletonBlock className="h-4 w-3/5" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        )}

        {chatAction.error && (
          <DataStateView
            state="error"
            title="Message failed"
            message={chatAction.error}
            actionLabel="Retry"
            onAction={async () => {
              try {
                const answer = await chatAction.retry()
                if (answer) {
                  setMessages((prev) => [...prev, { role: 'assistant', content: answer }])
                }
              } catch {
                // Error state stays visible.
              }
            }}
          />
        )}
      </div>

      <div className="border-t border-white/5 bg-[#1a1a1a] p-4">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSend()
            }}
            placeholder={deckId ? 'Ask about your deck' : 'Generate a deck first to enable chat'}
            disabled={!deckId}
            className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] py-3 pl-4 pr-10 text-sm text-white focus:border-orange-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button onClick={handleSend} disabled={!deckId} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KnowledgeBase() {
  const {
    state: { files, flowcharts, deckId },
  } = useAppState()

  const [scale, setScale] = useState(1)
  const [customFlowchart, setCustomFlowchart] = useState(null)

  const displayedFlowchart = useMemo(() => {
    if (customFlowchart) return customFlowchart
    if (flowcharts && flowcharts.length > 0) return flowcharts[0]
    return null
  }, [customFlowchart, flowcharts])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#191919] font-sans text-gray-200">
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-[#111] px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white" title="Back">
            <ArrowLeft size={18} />
          </Link>
          <Link to="/" className="rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white" title="Home">
            <Home size={18} />
          </Link>
          <h1 className="text-sm font-medium text-white">Knowledge Base</h1>
        </div>
        <button className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-500">
          Share Session
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-64 flex-col border-r border-white/5 bg-[#111]">
          <div className="border-b border-white/5 p-4 text-xs uppercase tracking-widest text-gray-500">Sources</div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {files && files.length > 0 ? (
              files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200">
                  <FileText size={14} />
                  <span className="truncate">{file.name}</span>
                </div>
              ))
            ) : (
              <p className="p-4 text-xs italic text-gray-600">No files loaded.</p>
            )}
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col bg-[#151515]">
          <div className="absolute left-4 top-4 z-10 flex gap-2 rounded-lg border border-white/10 bg-[#111] p-1">
            <button onClick={() => setScale((prev) => Math.min(prev + 0.1, 2))} className="rounded-md p-1.5 text-gray-400 hover:bg-white/10">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => setScale((prev) => Math.max(prev - 0.1, 0.5))} className="rounded-md p-1.5 text-gray-400 hover:bg-white/10">
              <ZoomOut size={16} />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto p-10">
            <div style={{ transform: `scale(${scale})`, transition: 'transform 0.2s' }} className="origin-center">
              {displayedFlowchart ? (
                <MermaidEditor
                  code={displayedFlowchart}
                  readOnly={false}
                  onSave={(nextCode) => setCustomFlowchart(nextCode)}
                />
              ) : (
                <div className="flex flex-col items-center text-gray-600">
                  <Share2 size={48} className="mb-4 opacity-20" />
                  <p>No flowchart generated for this deck yet.</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <div className="h-full w-80 md:w-96">
          <ChatPane deckId={deckId} />
        </div>
      </div>
    </div>
  )
}
