import { useState, useRef, useCallback, useEffect } from 'react'

interface PendingUndo {
  message: string
  onUndo: () => void
}

export function useUndoToast(timeoutMs = 4000) {
  const [pending, setPending] = useState<PendingUndo | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setPending(null)
  }, [])

  const show = useCallback((message: string, onUndo: () => void) => {
    clearTimeout(timer.current)
    setPending({ message, onUndo })
    timer.current = setTimeout(() => setPending(null), timeoutMs)
  }, [timeoutMs])

  useEffect(() => () => clearTimeout(timer.current), [])

  const undo = useCallback(() => {
    pending?.onUndo()
    dismiss()
  }, [pending, dismiss])

  return { pending, show, undo, dismiss }
}

export function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#2a2a4a] text-white pl-5 pr-3 py-2.5 rounded-[10px] text-sm shadow-lg border border-[#3a3a5a]">
      <span>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="font-semibold text-[#6c63ff] active:opacity-80"
      >
        Undo
      </button>
    </div>
  )
}
