import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileText, Zap, BookOpen, Brain, ArrowRight, Home } from 'lucide-react'
import { requestJson } from '../lib/api'

export default function Dashboard({ files, setFiles, setCards, setQuiz, setFlowcharts, setDeckName, setDeckId, deckId, authUser }) {
    const [loading, setLoading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [showGuide, setShowGuide] = useState(false)

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(selectedFiles);
            setUploadProgress(0);
            setShowGuide(false);

            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                setUploadProgress(progress);
                if (progress >= 100) {
                    clearInterval(interval);
                    setShowGuide(true);
                }
            }, 50);
        }
    }

    const handleGenerate = async () => {
        if (files.length === 0) return;
        setLoading(true);
        setCards([]);
        setQuiz([]);
        setFlowcharts([]);
        setShowGuide(false);

        const formData = new FormData();
        files.forEach((f) => {
            formData.append('files', f);
        });

        try {
            const data = await requestJson('/generate', {
                method: 'POST',
                body: formData,
            }, 1, 180000)

            setCards(data.cards);
            setQuiz(data.quiz || []);
            setFlowcharts(data.flowcharts || []);
            setDeckName(data.deck_name);
            setDeckId(data.deck_id);

        } catch (error) {
            alert("Error: " + (error?.message || 'Generation failed'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#191919] text-gray-200 font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">

            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[100px]"></div>
            </div>

            <div className="z-10 w-full max-w-4xl flex flex-col items-center">

                {/* Header */}
                <div className="mb-12 text-center relative w-full">
                    <Link to="/" className="absolute left-0 top-0 p-3 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Exit to Home">
                        <Home size={20} />
                    </Link>
                    <div className="absolute right-0 top-0 flex items-center gap-2">
                        <Link to="/leaderboard" className="px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">Leaderboard</Link>
                        {authUser ? (
                            <>
                                <Link to="/analytics" className="px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">Analytics</Link>
                                <Link to="/review" className="px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">Daily Review</Link>
                                <Link to="/profile" className="px-3 py-2 text-xs rounded-lg bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30">Profile</Link>
                            </>
                        ) : (
                            <Link to="/auth" className="px-3 py-2 text-xs rounded-lg bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30">Login</Link>
                        )}
                    </div>

                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-6">
                        <Zap size={16} className="text-orange-400" fill="currentColor" />
                        <span className="text-sm font-medium tracking-wide text-gray-300">FlashDeck AI Workspace</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                        {deckId ? "Analysis Complete. ready to explore." : "Transform your documents."}
                    </h1>
                    <p className="text-lg text-gray-500 max-w-xl mx-auto">
                        {deckId ? "Your content has been processed. Choose a mode below." : "Upload your lecture slides or notes to generate interactive flashcards and knowledge maps."}
                    </p>
                </div>

                {/* Dynamic Content */}
                {!deckId ? (
                    // UPLOAD STATE
                    <div className="w-full max-w-xl animate-in fade-in zoom-in duration-500">
                        <div className="group relative transition-all duration-300 hover:scale-[1.01]">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                            <div className="relative bg-[#202020] rounded-xl border border-white/5 p-10 shadow-2xl">
                                <div className="flex flex-col items-center">
                                    <div className="w-20 h-20 bg-[#2a2a2a] rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/5">
                                        {files.length > 0 ? <FileText className="text-orange-400" size={32} /> : <Upload className="text-gray-500" size={32} />}
                                    </div>
                                    <h3 className="text-xl font-medium text-white mb-2">
                                        {files.length > 0 ? `${files.length} Files Selected` : "Upload Study Files"}
                                    </h3>

                                    {/* Progress Bar */}
                                    {files.length > 0 && uploadProgress < 100 ? (
                                        <div className="w-full max-w-xs mt-4 mb-8">
                                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                <span>Uploading...</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-orange-500 h-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center mb-8 max-w-xs leading-relaxed">
                                            {files.length > 0 ? "Ready to analyze." : "Upload PDF, PPT/PPTX, DOC/DOCX, or TXT files."}
                                        </p>
                                    )}

                                    <div className="relative w-full">
                                        <input type="file" multiple accept=".pdf,.ppt,.pptx,.doc,.docx,.txt" onChange={handleFileChange} className={`absolute inset-0 w-full h-full opacity-0 z-20 ${files.length > 0 ? 'hidden' : 'cursor-pointer'}`} />
                                        <div className="relative">
                                            {showGuide && (
                                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-bounce shadow-lg z-30 pointer-events-none whitespace-nowrap">
                                                    Click Generate! 👇
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-indigo-600"></div>
                                                </div>
                                            )}
                                            <button disabled={files.length === 0 || loading || uploadProgress < 100} onClick={loading ? null : handleGenerate} className={`w-full py-4 px-6 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 relative z-10 ${files.length > 0 && uploadProgress === 100 ? 'bg-white text-black hover:bg-gray-100 shadow-[0_0_20px_rgba(255,255,255,0.3)] ring-2 ring-transparent' : 'bg-[#2a2a2a] text-gray-500 border border-white/5 hover:bg-[#333] cursor-pointer'}`}>
                                                {loading ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>Processing...</span> : <span>{files.length > 0 ? "Generate Flashcards" : "Select File"}</span>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // POST-GENERATION BUTTONS
                    <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <Link to="/my-decks" className="flex-1 group">
                            <div className="bg-[#202020] border border-white/5 p-8 rounded-2xl hover:bg-[#252525] hover:border-white/10 transition-all h-full flex flex-col items-center text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 text-orange-400 group-hover:scale-110 transition-transform">
                                    <BookOpen size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">My Decks</h2>
                                <p className="text-gray-500 mb-6">Review generated flashcards and take an interactive quiz.</p>
                                <span className="flex items-center gap-2 text-sm font-medium text-white opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    Open Decks <ArrowRight size={16} />
                                </span>
                            </div>
                        </Link>

                        <Link to="/knowledge-base" className="flex-1 group">
                            <div className="bg-[#202020] border border-white/5 p-8 rounded-2xl hover:bg-[#252525] hover:border-white/10 transition-all h-full flex flex-col items-center text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                                    <Brain size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Knowledge Base</h2>
                                <p className="text-gray-500 mb-6">Explore flowcharts and chat with your documents.</p>
                                <span className="flex items-center gap-2 text-sm font-medium text-white opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    Enter Base <ArrowRight size={16} />
                                </span>
                            </div>
                        </Link>
                    </div>
                )}
            </div>

        </div>
    )
}
