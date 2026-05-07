import { createContext, useContext, useState, type ReactNode } from 'react'

const DEMO_KEY = 'repsheets_demo'

interface DemoContextValue {
  isDemo: boolean
  startDemo: () => void
  exitDemo: () => void
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false, startDemo: () => {}, exitDemo: () => {},
})

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem(DEMO_KEY) === '1')

  const startDemo = () => { localStorage.setItem(DEMO_KEY, '1'); setIsDemo(true) }
  const exitDemo  = () => { localStorage.removeItem(DEMO_KEY);  setIsDemo(false) }

  return (
    <DemoContext.Provider value={{ isDemo, startDemo, exitDemo }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  return useContext(DemoContext)
}
