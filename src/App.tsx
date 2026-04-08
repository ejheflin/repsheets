import { AuthProvider } from './auth/AuthProvider'
import { SheetProvider, useSheetContext } from './data/useSheetContext'
import { useAuth } from './auth/useAuth'
import { LoginScreen } from './auth/LoginScreen'
import { Layout } from './ui/Layout'
import { RoutinesTab } from './ui/routines/RoutinesTab'

function MainApp() {
  const { spreadsheetId } = useSheetContext()

  if (!spreadsheetId) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <p className="text-gray-400">No sheet selected (Sheet selector coming in Task 12)</p>
      </div>
    )
  }

  return (
    <Layout>
      {(activeTab, setActiveTab) => (
        <>
          {activeTab === 'routines' && (
            <RoutinesTab onStartWorkout={() => setActiveTab('workout')} />
          )}
          {activeTab === 'workout' && <p className="text-gray-400">Workout tab (Task 11)</p>}
          {activeTab === 'logs' && <p className="text-gray-400">Logs tab (Phase 2)</p>}
        </>
      )}
    </Layout>
  )
}

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
    <SheetProvider>
      <MainApp />
    </SheetProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
