import { useState } from 'react'

interface NamePromptModalProps {
  title: string
  initialValue?: string
  confirmLabel: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function NamePromptModal({ title, initialValue = '', confirmLabel, onConfirm, onCancel }: NamePromptModalProps) {
  const [value, setValue] = useState(initialValue)
  const trimmed = value.trim()

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50">
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
        <p className="text-center font-bold mb-4">{title}</p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          autoFocus
          placeholder="Program name"
          className="w-full bg-[#2a2a4a] text-white text-sm font-semibold px-4 py-3 rounded-[10px] border border-[#3a3a5a] outline-none focus:border-[#6c63ff] mb-4"
          style={{ fontSize: 16 }}
        />
        <button
          onClick={() => onConfirm(trimmed)}
          disabled={!trimmed}
          className={`w-full rounded-[10px] p-3 text-center font-semibold mb-2 active:opacity-80 ${trimmed ? 'bg-[#6c63ff]' : 'bg-[#3a3a5a] text-gray-500'}`}
        >
          {confirmLabel}
        </button>
        <button onClick={onCancel}
          className="w-full p-3 text-center text-gray-400 font-semibold">Cancel</button>
      </div>
    </div>
  )
}
