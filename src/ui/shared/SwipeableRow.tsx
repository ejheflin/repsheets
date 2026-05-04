import { useRef, useEffect, type ReactNode } from 'react'
import { useSwipeActions } from './useSwipeActions'

export interface SwipeAction {
  label: string
  icon: ReactNode
  color: string
  onClick: () => void
}

interface SwipeableRowProps {
  actions: SwipeAction[]
  children: ReactNode
  className?: string
}

const BUTTON_WIDTH = 72

export function SwipeableRow({ actions, children, className }: SwipeableRowProps) {
  const actionWidth = actions.length * BUTTON_WIDTH
  const { offset, transitioning, isOpen, contentRef, close } = useSwipeActions({ actionWidth })
  const outerRef = useRef<HTMLDivElement>(null)

  // Close when a touch starts outside this row
  useEffect(() => {
    if (!isOpen) return
    const handleOutsideTouch = (e: TouchEvent) => {
      if (outerRef.current && !outerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('touchstart', handleOutsideTouch, { passive: true })
    return () => document.removeEventListener('touchstart', handleOutsideTouch)
  }, [isOpen, close])

  return (
    <div ref={outerRef} className={`relative overflow-hidden ${className ?? ''}`}>
      <div className="absolute right-0 top-0 bottom-0 flex" style={{ width: actionWidth }}>
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => { close(); action.onClick() }}
            className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-80"
            style={{ background: action.color }}
          >
            {action.icon}
            <span className="text-[11px] text-white font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      <div
        ref={contentRef}
        onClick={isOpen ? close : undefined}
        style={{
          transform: `translateX(${offset}px)`,
          transition: transitioning ? 'transform 0.2s ease' : 'none',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  )
}
