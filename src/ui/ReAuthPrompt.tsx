import { useAuth } from '../auth/useAuth'

interface ReAuthPromptProps {
  onDone: () => void
}

export function ReAuthPrompt({ onDone }: ReAuthPromptProps) {
  const { login } = useAuth()

  const handleTap = () => {
    login()
    // login() sets the user in context which triggers a re-render
    // The parent should clear the prompt when user is set
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] rounded-2xl p-6 mx-6 text-center">
        <p className="text-white font-semibold mb-2">Session Expired</p>
        <p className="text-gray-400 text-xs mb-4">Tap below to re-authenticate with Google</p>
        <button onClick={handleTap}
          className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm">
          Sign In Again
        </button>
      </div>
    </div>
  )
}
