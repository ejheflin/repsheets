import { useState } from 'react'

/**
 * Draft state for a controlled decimal input. Committing on every keystroke
 * while rendering the committed number strips a trailing "." (typing "62.5"
 * became "625"), so the in-progress text is kept locally until blur.
 */
export function useDecimalInput(value: number | null, onCommit: (v: number | null) => void) {
  const [draft, setDraft] = useState<string | null>(null)

  const text = draft ?? (value != null ? String(value) : '')

  const handleChange = (raw: string) => {
    if (!/^\d*\.?\d*$/.test(raw)) return
    setDraft(raw)
    if (raw === '') { onCommit(null); return }
    const n = Number(raw)
    if (!Number.isNaN(n)) onCommit(n)
  }

  const handleBlur = () => setDraft(null)

  return { text, handleChange, handleBlur }
}
