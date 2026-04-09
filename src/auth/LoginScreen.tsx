import { useAuth } from './useAuth'
import { useDemo } from '../demo/DemoProvider'

export function LoginScreen() {
  const { login } = useAuth()
  const { startDemo } = useDemo()
  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold text-white mb-2">repsheets</h1>
      <p className="text-gray-400 mb-10 text-center">Workout tracking powered by Google Sheets</p>
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
      <button onClick={startDemo}
        className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition">
        Try the demo
      </button>
    </div>
  )
}
