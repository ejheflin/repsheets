import { useRef } from 'react'
import { useDemo } from './DemoProvider'

export function useGhostToggle() {
  const { isGhost, startGhost, exitGhost } = useDemo()
  const count = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return () => {
    count.current += 1
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { count.current = 0 }, 2000)
    if (count.current >= 7) {
      count.current = 0
      if (timer.current) clearTimeout(timer.current)
      if (isGhost) exitGhost(); else startGhost()
    }
  }
}
