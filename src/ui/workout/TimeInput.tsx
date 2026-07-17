import { useState } from 'react'
import { formatDuration, parseDuration } from '../../data/measure'

interface TimeInputProps {
  value: number | null // stored as total seconds
  onChange: (seconds: number | null) => void
  className?: string
  placeholder?: string
}

/**
 * Weight/reps stay plain numbers, but time is entered and shown as `m:ss`. While
 * focused the raw typed text is kept in a local buffer (so typing the colon isn't
 * reformatted mid-keystroke); the model always receives parsed seconds, and on blur
 * the field snaps back to the canonical `m:ss` of the stored value.
 */
export function TimeInput({ value, onChange, className, placeholder = '—' }: TimeInputProps) {
  const [text, setText] = useState<string | null>(null)
  const display = text != null ? text : value != null ? formatDuration(value) : ''

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onFocus={(e) => { setText(value != null ? formatDuration(value) : ''); e.target.select() }}
      onChange={(e) => { setText(e.target.value); onChange(parseDuration(e.target.value)) }}
      onBlur={() => setText(null)}
      className={className}
    />
  )
}
