'use client'

import { useState } from 'react'
import { capture } from '@/lib/analytics/posthog'

const STEPS = [
  { n: 1, icon: '💬', title: 'Customer messages your website',    status: 'pending'   as const },
  { n: 2, icon: '⚡', title: 'Helios AI replies instantly',        status: 'pending'   as const },
  { n: 3, icon: '🎯', title: 'Lead details captured',             status: 'pending'   as const },
  { n: 4, icon: '📅', title: 'Booking request created',           status: 'pending'   as const },
  { n: 5, icon: '🔔', title: 'Owner notified instantly',          status: 'pending'   as const },
  { n: 6, icon: '📊', title: 'Mission Control updated',           status: 'pending'   as const },
]

type StepStatus = 'pending' | 'active' | 'done'

export default function DemoFlowClient() {
  const [step,    setStep]    = useState(-1)
  const [running, setRunning] = useState(false)
  const [steps,   setSteps]   = useState<StepStatus[]>(STEPS.map(() => 'pending'))

  const runDemo = () => {
    if (running) return
    setRunning(true)
    setStep(0)
    setSteps(STEPS.map(() => 'pending'))
    capture('demo_flow_started', { demo_mode: true })

    let current = 0
    const advance = () => {
      setStep(current)
      setSteps((prev) => prev.map((s, i) => i < current ? 'done' : i === current ? 'active' : 'pending'))
      current++
      if (current < STEPS.length) {
        setTimeout(advance, 900)
      } else {
        setTimeout(() => {
          setSteps(STEPS.map(() => 'done'))
          setStep(STEPS.length)
          setRunning(false)
          capture('demo_flow_completed', { demo_mode: true })
        }, 900)
      }
    }
    setTimeout(advance, 200)
  }

  const reset = () => {
    setStep(-1)
    setRunning(false)
    setSteps(STEPS.map(() => 'pending'))
  }

  const isDone = step >= STEPS.length

  return (
    <div className="max-w-[640px] mx-auto">
      {/* Status bar */}
      <div className="border border-white/[0.08] rounded-2xl p-5 bg-[#0f1012] mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-semibold text-white">Demo Flow</p>
          <span className="text-[10.5px] px-2.5 py-1 rounded-full border border-[#ffae3c]/30 bg-[#ffae3c]/[0.08] text-[#ffae3c]">
            Demo Sandbox
          </span>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-2.5">
          {STEPS.map((s, i) => {
            const status = steps[i]
            return (
              <div key={s.n} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${
                status === 'active' ? 'border-[#ffae3c]/30 bg-[#ffae3c]/[0.06]' :
                status === 'done'   ? 'border-[#22d093]/20 bg-[#22d093]/[0.04]' :
                                      'border-white/[0.06] bg-white/[0.01]'
              }`}>
                <span className="text-[18px] shrink-0">{s.icon}</span>
                <p className={`text-[13px] flex-1 ${
                  status === 'active' ? 'text-white font-medium' :
                  status === 'done'   ? 'text-[#9a9a9d]' :
                                        'text-[#6a6a6e]'
                }`}>
                  {s.title}
                </p>
                {status === 'active' && (
                  <span className="w-4 h-4 rounded-full border-2 border-[#ffae3c] border-t-transparent animate-spin shrink-0" />
                )}
                {status === 'done' && (
                  <svg className="text-[#22d093] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
                )}
              </div>
            )
          })}
        </div>

        {/* Controls */}
        <div className="flex gap-2 mt-4">
          {!running && !isDone && (
            <button onClick={runDemo}
              className="h-10 px-5 rounded-xl text-[13.5px] font-medium
                         bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00]
                         hover:opacity-90 transition-opacity">
              ▶ Run Demo Flow
            </button>
          )}
          {isDone && (
            <>
              <div className="flex-1 text-[13px] text-[#22d093] flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
                Demo complete!
              </div>
              <button onClick={reset}
                className="h-10 px-4 rounded-xl text-[13px] border border-white/[0.10] text-[#9a9a9d]
                           hover:bg-white/[0.04] hover:text-white transition-all">
                Reset
              </button>
            </>
          )}
          {running && (
            <span className="text-[12.5px] text-[#6a6a6e] flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-[#ffae3c] border-t-transparent animate-spin" />
              Running…
            </span>
          )}
        </div>
      </div>

      <p className="text-center text-[11.5px] text-[#6a6a6e]">
        Demo sandbox — no real messages, bookings, emails, or payments are sent.
      </p>
    </div>
  )
}
