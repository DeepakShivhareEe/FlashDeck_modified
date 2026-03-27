import { Sparkles, Zap, Brain, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'

export default function LandingPage() {
    useEffect(() => {
        const cards = document.querySelectorAll('.reveal-on-scroll')

        if (!('IntersectionObserver' in window) || cards.length === 0) {
            cards.forEach((card) => card.classList.add('is-visible'))
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible')
                        observer.unobserve(entry.target)
                    }
                })
            },
            { threshold: 0.2 }
        )

        cards.forEach((card) => observer.observe(card))
        return () => observer.disconnect()
    }, [])

    return (
        <div className="relative min-h-screen bg-[#070A14] text-gray-200 font-sans flex flex-col overflow-hidden">
            <div className="pointer-events-none absolute inset-0 saas-grid opacity-40" />
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-28 left-[-12%] h-72 w-72 md:h-[26rem] md:w-[26rem] rounded-full bg-[#7A5CFF]/30 blur-3xl float-blob" />
                <div className="absolute top-[18%] right-[-10%] h-72 w-72 md:h-[24rem] md:w-[24rem] rounded-full bg-[#2D88FF]/30 blur-3xl float-blob-delayed" />
                <div className="absolute bottom-[10%] left-[36%] h-60 w-60 md:h-80 md:w-80 rounded-full bg-[#2AE7C9]/18 blur-3xl float-blob-slow" />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#070A14]/75 backdrop-blur-xl border-b border-white/10 h-16 flex items-center">
                <div className="mx-auto w-full max-w-7xl px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/8 ring-1 ring-white/15 p-1.5 rounded-md shadow-[0_0_24px_rgba(45,136,255,0.26)]">
                            <Zap size={18} className="text-[#2AE7C9]" fill="currentColor" />
                        </div>
                        <span className="font-['Sora',sans-serif] font-semibold text-lg text-white tracking-[0.02em]">FlashDeck AI</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/app"
                            className="relative overflow-hidden rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-300 ease-out bg-gradient-to-r from-[#7A5CFF] via-[#2D88FF] to-[#2AE7C9] hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(45,136,255,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2AE7C9]/70"
                        >
                            Launch App
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-24">
                <div className="max-w-5xl px-6 text-center space-y-8">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs md:text-sm font-medium tracking-[0.05em] text-[#C8D5FF] backdrop-blur">
                        <Sparkles size={14} className="text-[#2AE7C9]" />
                        AI-Enhanced Study Workspace
                    </span>
                    <h1 className="font-['Sora',sans-serif] text-4xl leading-[1.05] md:text-7xl md:leading-[1.04] font-semibold tracking-[-0.02em] text-white">
                        <span className="saas-gradient-text shimmer-text">
                        Master your notes. In seconds.
                        </span>
                    </h1>
                    <p className="mx-auto max-w-3xl text-[#AEB9D9] text-lg md:text-xl leading-relaxed tracking-[0.01em]">
                        Transform your PDFs, slides, and handwritten notes into active recall flashcards.
                        Now with AI chat and visual concept maps.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/app"
                            className="w-full sm:w-auto relative overflow-hidden px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#7A5CFF] via-[#2D88FF] to-[#2AE7C9] text-white font-semibold tracking-[0.01em] transition-all duration-300 ease-out hover:scale-[1.035] hover:shadow-[0_0_30px_rgba(42,231,201,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2AE7C9]/70"
                        >
                            Get Started Free
                        </Link>
                        <a
                            href="#features"
                            className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-white/20 text-[#DCE4FF] hover:bg-white/10 hover:border-white/30 transition-all duration-300 ease-out font-medium"
                        >
                            View Features
                        </a>
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <div id="features" className="relative z-10 py-20 md:py-24">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-7 md:gap-8">
                    <FeatureCard
                        icon={<Upload className="text-[#57A4FF]" />}
                        title="Multi-File Upload"
                        desc="Drop in your entire semester's slide decks. We process them in parallel."
                        accent="from-[#2D88FF]/40 to-[#2AE7C9]/20"
                    />
                    <FeatureCard
                        icon={<Brain className="text-[#A685FF]" />}
                        title="RAG Chatbot"
                        desc="Ask questions to your documents. Our AI cites sources from your uploaded files."
                        accent="from-[#7A5CFF]/45 to-[#2D88FF]/20"
                    />
                    <FeatureCard
                        icon={<Sparkles className="text-[#2AE7C9]" />}
                        title="Visual Learning"
                        desc="Automatically generate flowcharts and diagrams to visualize complex topics."
                        accent="from-[#2AE7C9]/40 to-[#7A5CFF]/20"
                    />
                </div>
            </div>
        </div>
    )
}

function FeatureCard({ icon, title, desc, accent }) {
    return (
        <div className="reveal-on-scroll group relative p-[1px] rounded-2xl overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_18px_45px_rgba(23,33,63,0.45)]">
            <div className={`absolute inset-0 opacity-80 bg-gradient-to-br ${accent}`} />
            <div className="relative rounded-2xl h-full min-h-[230px] border border-white/12 bg-[linear-gradient(145deg,rgba(13,17,30,0.88),rgba(11,14,24,0.78))] backdrop-blur-xl p-6">
                <div className="w-12 h-12 rounded-lg bg-white/10 ring-1 ring-white/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 ease-out">
                {icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 tracking-[0.01em]">{title}</h3>
                <p className="text-[#AAB5D6] leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}
