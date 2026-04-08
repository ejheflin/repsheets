import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { LoginScreen } from './auth/LoginScreen'

function AppContent() {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }
  if (!user) return <LoginScreen />
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <p className="p-4">Welcome, {user.name}</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
