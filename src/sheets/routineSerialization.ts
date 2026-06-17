export type Basis = '1rm' | 'tm'

export interface ParsedValue {
  value: number | null
  pct: number | null
  basis: Basis | null
}

export function parseRoutineValue(raw: string | number | null | undefined): ParsedValue {
  const s = String(raw ?? '').trim()
  if (!s) return { value: null, pct: null, basis: null }

  const lower = s.toLowerCase()
  const hasTM = lower.includes('tm')
  const has1RM = lower.includes('1rm')
  const hasPercentSign = s.includes('%')

  const numMatch = s.match(/-?\d*\.?\d+/)
  const num = numMatch ? parseFloat(numMatch[0]) : NaN
  if (!Number.isFinite(num)) return { value: null, pct: null, basis: null }
  if (num < 0) return { value: null, pct: null, basis: null }

  // A bare value between 0 and 1 (e.g. 0.8) is read as a fraction of 1RM, matching how routines have historically encoded percentages.
  const decimalPct = num > 0 && num < 1 && !hasPercentSign
  const isPercent = hasPercentSign || hasTM || has1RM || decimalPct

  if (isPercent) {
    const pct = Math.round(decimalPct ? num * 100 : num)
    return { value: null, pct, basis: hasTM ? 'tm' : '1rm' }
  }
  return { value: Math.round(num), pct: null, basis: null }
}

export function serializeRoutineValue(v: {
  value: number | null
  pct: number | null
  basis?: Basis | null
}): string {
  if (v.pct != null) return v.basis === 'tm' ? `${v.pct}% TM` : `${v.pct}%`
  if (v.value != null) return String(v.value)
  return ''
}
