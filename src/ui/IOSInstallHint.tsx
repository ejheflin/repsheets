import { useState, useEffect } from 'react'

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('standalone' in window.navigator && window.navigator.standalone)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone === true)
}

const DISMISSED_KEY = 'repsheets_ios_hint_dismissed'

export function IOSInstallHint() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isIOS() && !isStandalone() && !localStorage.getItem(DISMISSED_KEY)) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  return (
    <div className="fixed bottom-20 left-3 right-3 z-30 bg-[#2a2a4a] border border-[#3a3a5a] rounded-xl p-3 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-xs text-white font-semibold mb-1">Install repsheets</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Tap the share button
            <svg className="inline mx-1 -mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            then "Add to Home Screen"
          </p>
        </div>
        <button onClick={dismiss} className="text-gray-500 text-sm p-1">✕</button>
      </div>
    </div>
  )
}
