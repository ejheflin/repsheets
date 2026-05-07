import { createContext, useContext, useState, type ReactNode } from 'react'
import { isGhostActive, activateGhost, deactivateGhost } from './ghostMode'

const DEMO_KEY = 'repsheets_demo'

interface DemoContextValue {
  isDemo: boolean
  startDemo: () => void
  exitDemo: () => void
  isGhost: boolean
  startGhost: () => void
  exitGhost: () => void
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false, startDemo: () => {}, exitDemo: () => {},
  isGhost: false, startGhost: () => {}, exitGhost: () => {},
})

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem(DEMO_KEY) === '1')

  const startDemo = () => { localStorage.setItem(DEMO_KEY, '1'); setIsDemo(true) }
  const exitDemo  = () => { localStorage.removeItem(DEMO_KEY); setIsDemo(false) }

  // Ghost mode reloads so SheetProvider re-initialises from scratch with the flag set
  const startGhost = () => { activateGhost(); window.location.reload() }
  const exitGhost  = () => { deactivateGhost(); window.location.reload() }

  return (
    <DemoContext.Provider value={{
      isDemo, startDemo, exitDemo,
      isGhost: isGhostActive(), startGhost, exitGhost,
    }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  return useContext(DemoContext)
}
