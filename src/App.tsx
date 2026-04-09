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
import { useState } from 'react'

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
      </SheetProvider>
    )
  }

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
