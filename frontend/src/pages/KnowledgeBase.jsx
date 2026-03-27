import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Share2, ZoomIn, ZoomOut, Send, Bot, User as UserIcon, Home } from 'lucide-react'
import MermaidEditor from '../components/MermaidEditor'
import { requestJson } from '../lib/api'

// We'll rebuild a dedicated Chat pane here for better integration than the Sidebar component
function ChatPane({ deckId }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello! I can answer questions about your uploaded documents. What would you like to know?' }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSend = async () => {
        if (!input.trim() || !deckId) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const data = await requestJson('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.content, deck_id: deckId })
            }, 1, 45000)
            setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${e?.message || 'Request failed'}.` }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#111] border-l border-white/5">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <span className="font-medium text-white flex items-center gap-2"><Bot size={16} /> AI Assistant</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-white/10' : 'bg-orange-500/10'}`}>
                            {m.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} className="text-orange-500" />}
                        </div>
                        <div className={`p-3 rounded-lg text-sm max-w-[85%] leading-relaxed ${m.role === 'user' ? 'bg-[#2a2a2a] text-white' : 'bg-transparent border border-white/10 text-gray-300'}`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-2 p-4">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                    </div>
                )}
            </div>
            <div className="p-4 border-t border-white/5 bg-[#1a1a1a]">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about your documents..."
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50"
                    />
                    <button onClick={handleSend} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-orange-400 transition-colors">
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function KnowledgeBase({ files, flowcharts, deckId }) {
    const [scale, setScale] = useState(1)
    const [customFlowchart, setCustomFlowchart] = useState(null)
    const displayedFlowchart = customFlowchart ?? (flowcharts && flowcharts.length > 0 ? flowcharts[0] : null)

    return (
        <div className="h-screen bg-[#191919] text-gray-200 font-sans flex flex-col overflow-hidden">
            {/* Header (Minimal) */}
            <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-[#111]">
                <div className="flex items-center gap-4">
                    <Link to="/app" className="p-2 hover:bg-white/5 rounded-md text-gray-400 hover:text-white" title="Back to Dashboard">
                        <ArrowLeft size={18} />
                    </Link>
                    <Link to="/" className="p-2 hover:bg-white/5 rounded-md text-gray-400 hover:text-white" title="Go Home">
                        <Home size={18} />
                    </Link>
                    <h1 className="font-medium text-white text-sm">Knowledge Base</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-md transition-colors">
                        Share Session
                    </button>
                </div>
            </header>

            {/* 3 Pane Layout */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left: Files Pane */}
                <div className="w-64 bg-[#111] border-r border-white/5 flex flex-col">
                    <div className="p-4 text-xs font-mono text-gray-500 uppercase tracking-widest border-b border-white/5">
                        Sources
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {files && files.map((f, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-md hover:bg-white/5 text-gray-400 hover:text-gray-200 cursor-pointer text-sm">
                                <FileText size={14} />
                                <span className="truncate">{f.name}</span>
                            </div>
                        ))}
                        {(!files || files.length === 0) && (
                            <p className="p-4 text-xs text-gray-600 italic">No files loaded.</p>
                        )}
                    </div>
                </div>

                {/* Center: Flowchart Canvas */}
                <div className="flex-1 bg-[#151515] relative flex flex-col">
                    <div className="absolute top-4 left-4 z-10 flex gap-2 bg-[#111] border border-white/10 p-1 rounded-lg">
                        <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-1.5 hover:bg-white/10 rounded-md text-gray-400">
                            <ZoomIn size={16} />
                        </button>
                        <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="p-1.5 hover:bg-white/10 rounded-md text-gray-400">
                            <ZoomOut size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto flex items-center justify-center p-10 cursor-move">
                        <div style={{ transform: `scale(${scale})`, transition: 'transform 0.2s' }} className="origin-center">
                            {displayedFlowchart ? (
                                <div className="h-full w-full">
                                    <MermaidEditor
                                        code={displayedFlowchart}
                                        readOnly={false}
                                        onSave={(newCode) => {
                                            console.log("Saving Flowchart Update:", newCode)
                                            setCustomFlowchart(newCode)
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="text-gray-600 flex flex-col items-center">
                                    <Share2 size={48} className="opacity-20 mb-4" />
                                    <p>No Flowchart Generated</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Chat Pane */}
                <div className="w-80 md:w-96 h-full">
                    <ChatPane deckId={deckId} />
                </div>

            </div>
        </div>
    )
}
