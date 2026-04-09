import { useState } from 'react'

const TOUR_KEY = 'repsheets_tour_done'

interface TourStep {
  title: string
  text: string
}

const STEPS: TourStep[] = [
  {
    title: 'Sheets',
    text: 'Tap the grid icon to switch between spreadsheets, rename them, or share with friends.',
  },
  {
    title: 'Programs',
    text: 'Select a workout program from the dropdown. Each sheet can hold multiple programs.',
  },
  {
    title: 'Routines',
    text: 'Tap a routine to start your workout. Your exercises will load with values from your last session.',
  },
  {
    title: 'Checkboxes',
    text: 'Check off individual sets, whole exercises, or the entire workout in one tap with the Finish button.',
  },
  {
    title: 'Exercises',
    text: 'Bulk edit reps and weight while collapsed. Tap the chevron to expand and adjust individual sets.',
  },
  {
    title: 'Finish',
    text: 'Tap Finish to log your workout. Choose to log everything or just the sets you checked off.',
  },
]

export function OnboardingTour() {
  const [step, setStep] = useState(() => {
    return localStorage.getItem(TOUR_KEY) ? -1 : 0
  })

  if (step < 0 || step >= STEPS.length) return null

  const current = STEPS[step]

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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6" onClick={dismiss}>
      <div className="bg-[#2a2a4a] rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-gray-500">{step + 1} / {STEPS.length}</span>
          <button onClick={dismiss} className="text-gray-500 text-sm">✕</button>
        </div>

        <h3 className="text-base font-bold text-white mb-2">{current.title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-5">{current.text}</p>

        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              className="flex-1 bg-[#1a1a2e] rounded-[10px] p-2.5 text-center text-gray-400 text-sm font-semibold">
              Back
            </button>
          )}
          <button onClick={next}
            className="flex-1 bg-[#6c63ff] rounded-[10px] p-2.5 text-center text-sm font-semibold">
            {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>

        <div className="flex justify-center gap-1.5 mt-4">
          {STEPS.map((_, i) => (
            <div key={i}
              className={`w-1.5 h-1.5 rounded-full transition ${i === step ? 'bg-[#6c63ff]' : 'bg-[#444]'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
