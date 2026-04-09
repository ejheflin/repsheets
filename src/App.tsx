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

function getUrlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

function clearUrlParam(name: string) {
  const url = new URL(window.location.href)
  url.searchParams.delete(name)
  window.history.replaceState({}, '', url.pathname)
}

function useImportParam() {
  const [importSheetId, setImportSheetId] = useState<string | null>(() => getUrlParam('import'))
  const clearImport = () => { setImportSheetId(null); clearUrlParam('import') }
  return { importSheetId, clearImport }
}

function useJoinParam() {
  const [joinSheetId, setJoinSheetId] = useState<string | null>(() => getUrlParam('join'))
  const clearJoin = () => { setJoinSheetId(null); clearUrlParam('join') }
  return { joinSheetId, clearJoin }
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

function JoinHandler({ sheetId, onDone }: { sheetId: string; onDone: () => void }) {
  const { setSpreadsheetId } = useSheetContext()

  useEffect(() => {
    setSpreadsheetId(sheetId)
    onDone()
  }, [sheetId, setSpreadsheetId, onDone])

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <p className="text-gray-400">Joining sheet...</p>
    </div>
  )
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
  const { joinSheetId, clearJoin } = useJoinParam()
  const { showReAuth, clearReAuth } = useAuthExpiredHandler()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  if (importSheetId) {
    return (
      <SheetProvider>
        <ImportFlow sheetId={importSheetId} onDone={clearImport} />
        {showReAuth && <ReAuthPrompt onDone={clearReAuth} />}
      </SheetProvider>
    )
  }

  if (joinSheetId) {
    return (
      <SheetProvider>
        <JoinHandler sheetId={joinSheetId} onDone={clearJoin} />
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
