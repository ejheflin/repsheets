import { useAuth } from './useAuth'
import { useState, useEffect } from 'react'

const SHARED_WITH = ['no one', 'friends', 'clients', 'everyone']

const BULLETS = [
  { type: 'text' as const, text: 'Private workout tracker' },
  { type: 'text' as const, text: 'Free. Open source. Serverless.' },
  { type: 'text' as const, text: 'Your data stays in your own Google Sheet.' },
  { type: 'shared' as const, text: '' },
]

function SharedWithLine() {
  const [wordIndex, setWordIndex] = useState(0)
  const [wordVisible, setWordVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setWordVisible(false)
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % SHARED_WITH.length)
        setWordVisible(true)
      }, 400)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="inline-flex items-center pl-5">
      <span>Share with</span>
      <span className={`inline-block w-20 text-left ml-1.5 text-[#6c63ff] font-semibold transition-opacity duration-200 ${wordVisible ? 'opacity-100' : 'opacity-0'}`}>
        {SHARED_WITH[wordIndex]}
      </span>
    </span>
  )
}

function StaggeredBullets() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount >= BULLETS.length) return
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1)
    }, 800)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <div className="space-y-2">
      {BULLETS.map((bullet, i) => (
        <div key={i}
          className={`text-gray-400 text-sm text-center transition-all duration-500 ${
            i < visibleCount ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
          {bullet.type === 'shared' ? <SharedWithLine /> : bullet.text}
        </div>
      ))}
    </div>
  )
}

export function LoginScreen() {
  const { login } = useAuth()
  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center px-6 relative">
      <h1 className="text-4xl font-bold text-white mb-6">repsheets</h1>
      <StaggeredBullets />
      <div className="mt-10">
        <button onClick={login}
          className="bg-white text-gray-800 font-semibold px-6 py-3 rounded-lg flex items-center gap-3 hover:bg-gray-100 transition">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.9 23.9 0 000 24c0 3.77.9 7.35 2.56 10.54l7.97-5.95z"/>
            <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.95C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>
      </div>

      <div className="absolute bottom-6 flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
        </svg>
        <a href="https://github.com/ejheflin/repsheets" target="_blank" rel="noopener noreferrer"
          className="text-[11px] text-gray-600 hover:text-gray-400 transition">
          Open Source
        </a>
        <span className="text-[11px] text-gray-400">·</span>
        <a href="/privacy.html"
          className="text-[11px] text-gray-600 hover:text-gray-400 transition">
          Privacy Policy
        </a>
      </div>
    </div>
  )
}
