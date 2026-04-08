import { AuthProvider } from './auth/AuthProvider'
import { SheetProvider, useSheetContext } from './data/useSheetContext'
import { useAuth } from './auth/useAuth'
import { LoginScreen } from './auth/LoginScreen'
import { Layout } from './ui/Layout'
import { RoutinesTab } from './ui/routines/RoutinesTab'
import { WorkoutTab } from './ui/workout/WorkoutTab'
import { SheetSelector } from './ui/SheetSelector'
import { WorkoutProvider } from './data/useWorkout'

function MainApp() {
  const { spreadsheetId } = useSheetContext()

  if (!spreadsheetId) {
    return <SheetSelector />
  }

  return (
    <WorkoutProvider>
      <Layout>
        {(activeTab, setActiveTab) => (
          <>
            {activeTab === 'routines' && (
              <RoutinesTab onStartWorkout={() => setActiveTab('workout')} />
            )}
            {activeTab === 'workout' && <WorkoutTab />}
            {activeTab === 'logs' && (
              <p className="text-gray-400">Logs tab (coming in Phase 2)</p>
            )}
          </>
        )}
      </Layout>
    </WorkoutProvider>
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
