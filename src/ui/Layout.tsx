import { useState, useEffect } from 'react'
import { BottomNav, type TabId } from './BottomNav'
import { SyncIndicator, type SyncStatus } from './SyncIndicator'
import { getSyncState, onSyncStateChange, flushSync } from '../data/syncEngine'
import { useSheetContext } from '../data/useSheetContext'

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

  const { spreadsheetId } = useSheetContext()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncState)

  useEffect(() => {
    return onSyncStateChange(setSyncStatus)
  }, [])

  const handleSyncTap = () => {
    if (spreadsheetId && syncStatus === 'pending') {
      flushSync(spreadsheetId)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white font-sans">
      <div className="fixed top-0 left-0 right-0 z-10 bg-[#1a1a2e]">
        <div className="flex justify-between items-center px-4 py-2 text-[11px] text-gray-500 max-w-lg mx-auto">
          <span />
          <button onClick={handleSyncTap}>
            <SyncIndicator status={syncStatus} />
          </button>
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
