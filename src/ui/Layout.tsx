import { useState } from 'react'
import { BottomNav, type TabId } from './BottomNav'

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

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white font-sans">
      <div style={{ paddingTop: 'env(safe-area-inset-top)' }} className="pb-20 px-4 max-w-lg mx-auto">
        {children(activeTab, setActiveTab)}
      </div>
      <div className="max-w-lg mx-auto">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  )
}
