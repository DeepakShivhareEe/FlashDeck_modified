import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

const MotionDiv = motion.div

const FLOW_STEPS = [
  'Upload',
  'Processing',
  'Flashcards',
  'Quiz',
  'Results',
  'Analytics',
]

export default function LearningFlowStepper({ activeStep = 'Upload' }) {
  const activeIndex = Math.max(0, FLOW_STEPS.findIndex((step) => step === activeStep))

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {FLOW_STEPS.map((step, index) => {
          const complete = index < activeIndex
          const active = index === activeIndex

          return (
            <div key={step} className="flex items-center gap-2">
              <MotionDiv
                initial={false}
                animate={{
                  scale: active ? 1.06 : 1,
                  backgroundColor: complete ? 'rgba(34,197,94,0.2)' : active ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.08)',
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${active ? 'border-cyan-300/50 text-cyan-100' : 'border-white/10 text-gray-300'}`}
              >
                {complete && <CheckCircle2 size={12} className="text-green-300" />}
                {step}
              </MotionDiv>
              {index < FLOW_STEPS.length - 1 && (
                <div className="h-px w-4 bg-white/20 md:w-6" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
