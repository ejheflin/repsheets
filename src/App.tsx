import { AuthProvider } from './auth/AuthProvider'
import { SheetProvider, useSheetContext } from './data/useSheetContext'
import { useAuth } from './auth/useAuth'
import { LoginScreen } from './auth/LoginScreen'
import { Layout } from './ui/Layout'
import { RoutinesTab } from './ui/routines/RoutinesTab'
import { WorkoutTab } from './ui/workout/WorkoutTab'
import { SheetSelector } from './ui/SheetSelector'
import { WorkoutProvider } from './data/useWorkout'
import { LogsTab } from './ui/logs/LogsTab'
import { IOSInstallHint } from './ui/IOSInstallHint'
import { ImportFlow } from './ui/sharing/ImportFlow'
import { ReAuthPrompt } from './ui/ReAuthPrompt'
import { useState, useEffect } from 'react'
import { AuthExpiredError } from './auth/authFetch'

function getImportParam(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('import')
}

function useImportParam() {
  const [importSheetId, setImportSheetId] = useState<string | null>(getImportParam)

  const clearImport = () => {
    setImportSheetId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('import')
    window.history.replaceState({}, '', url.pathname)
  }

  return { importSheetId, clearImport }
}

function useAuthExpiredHandler() {
  const [showReAuth, setShowReAuth] = useState(false)

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof AuthExpiredError) {
        event.preventDefault()
        setShowReAuth(true)
      }
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return { showReAuth, clearReAuth: () => setShowReAuth(false) }
}

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
            {activeTab === 'workout' && <WorkoutTab onGoToRoutines={() => setActiveTab('routines')} />}
            {activeTab === 'logs' && <LogsTab />}
          </>
        )}
      </Layout>
      <IOSInstallHint />
    </WorkoutProvider>
  )
}

function AppContent() {
  const { user, isLoading } = useAuth()
  const { importSheetId, clearImport } = useImportParam()
  const { showReAuth, clearReAuth } = useAuthExpiredHandler()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  // Import flow runs OUTSIDE SheetProvider to prevent background fetches
  if (importSheetId) {
    return (
      <SheetProvider>
        <ImportFlow sheetId={importSheetId} onDone={clearImport} />
        {showReAuth && <ReAuthPrompt onDone={clearReAuth} />}
      </SheetProvider>
    )
  }

  return (
    <SheetProvider>
      <MainApp />
      {showReAuth && <ReAuthPrompt onDone={clearReAuth} />}
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
