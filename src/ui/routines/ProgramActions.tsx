import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

function KebabIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

interface ProgramActionsProps {
  onNewProgram: () => void
  onRenameProgram: () => void
  onDeleteProgram: () => void
  canModify: boolean
}

const MENU_WIDTH = 176

export function ProgramActions({ onNewProgram, onRenameProgram, onDeleteProgram, canModify }: ProgramActionsProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.max(8, rect.right - MENU_WIDTH)
    setPos({ top: rect.bottom + 4, left })
  }, [])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const select = (fn: () => void) => { setOpen(false); fn() }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Program actions"
        onClick={() => (open ? setOpen(false) : (place(), setOpen(true)))}
        className="w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80"
      >
        <KebabIcon />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] py-1 shadow-lg"
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          >
            <button type="button" onClick={() => select(onNewProgram)}
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-white active:bg-[#2a2a4a]">
              New program
            </button>
            <button type="button" disabled={!canModify} onClick={() => select(onRenameProgram)}
              className={`w-full text-left px-3 py-2 text-[13px] font-semibold active:bg-[#2a2a4a] ${canModify ? 'text-white' : 'text-gray-600'}`}>
              Rename program
            </button>
            <button type="button" disabled={!canModify} onClick={() => select(onDeleteProgram)}
              className={`w-full text-left px-3 py-2 text-[13px] font-semibold active:bg-[#2a2a4a] ${canModify ? 'text-red-400' : 'text-gray-600'}`}>
              Delete program
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
