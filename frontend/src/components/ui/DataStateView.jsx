import { AlertTriangle, CheckCircle2, Inbox, LoaderCircle } from 'lucide-react'

export default function DataStateView({ state, title, message, actionLabel, onAction }) {
  const tone = getTone(state)
  const Icon = tone.icon

  return (
    <div className={`rounded-2xl border p-8 text-center ${tone.wrapper}`}>
      <Icon className={`mx-auto mb-3 ${tone.iconClass}`} size={28} />
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-300">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/15"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function getTone(state) {
  switch (state) {
    case 'loading':
      return {
        icon: LoaderCircle,
        iconClass: 'text-cyan-300 animate-spin',
        wrapper: 'border-cyan-400/30 bg-cyan-500/10',
      }
    case 'error':
      return {
        icon: AlertTriangle,
        iconClass: 'text-red-300',
        wrapper: 'border-red-400/30 bg-red-500/10',
      }
    case 'success':
      return {
        icon: CheckCircle2,
        iconClass: 'text-green-300',
        wrapper: 'border-green-400/30 bg-green-500/10',
      }
    default:
      return {
        icon: Inbox,
        iconClass: 'text-gray-300',
        wrapper: 'border-white/10 bg-white/5',
      }
  }
}
