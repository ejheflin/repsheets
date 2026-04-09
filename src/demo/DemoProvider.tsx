import { createContext, useContext, useState, type ReactNode } from 'react'

interface DemoContextValue {
  isDemo: boolean
  startDemo: () => void
  exitDemo: () => void
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false, startDemo: () => {}, exitDemo: () => {},
})

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(false)

  return (
    <DemoContext.Provider value={{
      isDemo,
      startDemo: () => setIsDemo(true),
      exitDemo: () => setIsDemo(false),
    }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  return useContext(DemoContext)
}
