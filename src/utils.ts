// For controlled numeric inputs: null clears the field, undefined means
// "not a number — ignore this keystroke" so NaN never enters workout state
export function parseNumericInput(raw: string): number | null | undefined {
  if (!raw.trim()) return null
  const n = Number(raw)
  return Number.isNaN(n) ? undefined : n
}

export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
