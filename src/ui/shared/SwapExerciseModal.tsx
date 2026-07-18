import { useState } from 'react'

interface SwapExerciseModalProps {
  currentName: string
  subtitle: string
  suggestions: string[]
  onConfirm: (name: string) => void
  onClose: () => void
}

export function SwapExerciseModal({ currentName, subtitle, suggestions, onConfirm, onClose }: SwapExerciseModalProps) {
  const [name, setName] = useState(currentName)

  // Blur before unmounting: if a focused element (this input, a button)
  // leaves the DOM, no blur event fires and the routine card's "editing"
  // tracker would stay armed forever, deferring its autosave indefinitely
  const close = () => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={close}>
      <div className="bg-[#2a2a4a] rounded-[10px] p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-[15px] mb-1">Swap Exercise</div>
        <div className="text-[13px] text-gray-400 mb-3">{subtitle}</div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { onConfirm(s); close() }}
                className="flex-shrink-0 bg-[#3a3a5a] rounded-full px-3 py-1.5 text-sm text-white active:bg-[#6c63ff] active:opacity-80"
              >{s}</button>
            ))}
          </div>
        )}
        <input
          type="text"
          aria-label="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#1a1a2e] border border-[#6c63ff] rounded-[8px] px-3 py-2.5 text-sm outline-none"
          style={{ fontSize: 16 }}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim() && name.trim() !== currentName) {
              onConfirm(name.trim())
              close()
            }
          }}
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={close}
            className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] py-2.5 text-sm text-gray-400 active:opacity-80"
          >Cancel</button>
          <button
            onClick={() => { onConfirm(name.trim()); close() }}
            disabled={!name.trim() || name.trim() === currentName}
            className="flex-1 bg-[#6c63ff] rounded-[10px] py-2.5 text-sm font-semibold active:opacity-80 disabled:opacity-40"
          >Confirm</button>
        </div>
      </div>
    </div>
  )
}
