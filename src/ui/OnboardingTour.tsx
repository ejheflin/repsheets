import { useState, useEffect, useCallback, useRef } from 'react'

const TOUR_KEY = 'repsheets_tour_done'

interface TourStep {
  target: string      // data-tour attribute value
  title: string
  text: string
  position: 'below' | 'above'
  action: 'click' | 'auto'  // click = wait for user to tap target, auto = advance on Next
}

const STEPS: TourStep[] = [
  {
    target: 'sheet-switcher',
    title: 'Sheets',
    text: 'Tap the grid icon to switch spreadsheets, rename them, or share with friends.',
    position: 'below',
    action: 'auto',
  },
  {
    target: 'program-selector',
    title: 'Programs',
    text: 'Select a workout program from the dropdown. Each sheet can hold multiple programs.',
    position: 'below',
    action: 'auto',
  },
  {
    target: 'routine-card',
    title: 'Routines',
    text: 'Tap a routine to start your workout. Values autofill from your last session.',
    position: 'below',
    action: 'click',
  },
  {
    target: 'exercise-checkbox',
    title: 'Checkboxes',
    text: 'Check off individual sets, whole exercises, or the entire workout with Finish.',
    position: 'below',
    action: 'auto',
  },
  {
    target: 'exercise-row',
    title: 'Exercises',
    text: 'Edit reps and weight while collapsed. Tap the chevron to expand individual sets.',
    position: 'below',
    action: 'auto',
  },
  {
    target: 'finish-button',
    title: 'Finish',
    text: 'Log your workout. Choose to log everything or just the sets you checked off.',
    position: 'above',
    action: 'auto',
  },
]

export function OnboardingTour() {
  const [step, setStep] = useState(() => {
    return localStorage.getItem(TOUR_KEY) ? -1 : 0
  })
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const findTarget = useCallback(() => {
    if (step < 0 || step >= STEPS.length) return null
    const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`)
    return el as HTMLElement | null
  }, [step])

  useEffect(() => {
    if (step < 0) return
    const update = () => {
      const el = findTarget()
      if (el) {
        setTargetRect(el.getBoundingClientRect())
      } else {
        setTargetRect(null)
      }
    }
    update()
    // Re-measure on scroll/resize
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [step, findTarget])

  // Listen for click on target element for 'click' action steps
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return
    if (STEPS[step].action !== 'click') return

    const handler = () => {
      // Small delay so the click action completes first
      setTimeout(() => next(), 300)
    }

    const el = findTarget()
    if (el) {
      el.addEventListener('click', handler, { once: true })
      return () => el.removeEventListener('click', handler)
    }
  }, [step, findTarget])

  if (step < 0 || step >= STEPS.length) return null

  const current = STEPS[step]
  const padding = 6

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, '1')
    setStep(-1)
  }

  const next = () => {
    if (step === STEPS.length - 1) {
      dismiss()
    } else {
      setStep(step + 1)
    }
  }

  // Tooltip position
  const tooltipStyle: React.CSSProperties = targetRect ? {
    position: 'fixed',
    left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 280)),
    ...(current.position === 'below'
      ? { top: targetRect.bottom + padding + 12 }
      : { bottom: window.innerHeight - targetRect.top + padding + 12 }
    ),
    width: Math.min(260, window.innerWidth - 32),
    zIndex: 52,
  } : {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 260,
    zIndex: 52,
  }

  return (
    <>
      {/* Overlay with cutout */}
      <div ref={overlayRef} className="fixed inset-0 z-50" onClick={dismiss}
        style={{ pointerEvents: 'none' }}>
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - padding}
                  y={targetRect.top - padding}
                  width={targetRect.width + padding * 2}
                  height={targetRect.height + padding * 2}
                  rx={10}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#tour-mask)" />
        </svg>

        {/* Clickable border around target */}
        {targetRect && (
          <div className="absolute rounded-[10px] border-2 border-[#6c63ff]"
            style={{
              left: targetRect.left - padding,
              top: targetRect.top - padding,
              width: targetRect.width + padding * 2,
              height: targetRect.height + padding * 2,
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // Let the click pass through to the target
              const el = findTarget()
              if (el && current.action === 'click') {
                el.click()
              } else {
                next()
              }
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div style={tooltipStyle} onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2a2a4a] rounded-xl p-4 shadow-lg border border-[#3a3a5a]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-white">{current.title}</span>
            <span className="text-[10px] text-gray-500">{step + 1}/{STEPS.length}</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed mb-3">{current.text}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-[#6c63ff]' : 'bg-[#444]'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={dismiss} className="text-gray-500 text-[11px]">Skip</button>
              {current.action === 'auto' && (
                <button onClick={next}
                  className="bg-[#6c63ff] rounded-md px-3 py-1 text-[11px] font-semibold">
                  {step === STEPS.length - 1 ? 'Done' : 'Next'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
