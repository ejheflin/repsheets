import { useState, useEffect } from 'react'
import { BottomNav, type TabId } from './BottomNav'
import { SyncIndicator, type SyncStatus } from './SyncIndicator'

interface LayoutProps {
  children: (activeTab: TabId, setActiveTab: (tab: TabId) => void) => React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [activeTab, setActiveTabState] = useState<TabId>(
    () => (sessionStorage.getItem('repsheets_tab') as TabId) || 'routines'
  )
  const setActiveTab = (tab: TabId) => {
    sessionStorage.setItem('repsheets_tab', tab)
    setActiveTabState(tab)
  }

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    navigator.onLine ? 'synced' : 'offline'
  )

  useEffect(() => {
    const goOnline = () => setSyncStatus('synced')
    const goOffline = () => setSyncStatus('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white font-sans">
      <div className="fixed top-0 left-0 right-0 z-10 bg-[#1a1a2e]">
        <div className="flex justify-between items-center px-4 py-2 text-[11px] text-gray-500">
          <span />
          <SyncIndicator status={syncStatus} />
        </div>
      </div>
      <div className="pt-8 pb-20 px-4 max-w-lg mx-auto">
        {children(activeTab, setActiveTab)}
      </div>
      <div className="max-w-lg mx-auto">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  )
}
