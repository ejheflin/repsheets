export type Basis = '1rm' | 'tm'

export interface ParsedValue {
  value: number | null
  pct: number | null
  basis: Basis | null
  rpe?: number
  rir?: number
}

export function parseRoutineValue(raw: string | number | null | undefined): ParsedValue {
  let s = String(raw ?? '').trim()
  if (!s) return { value: null, pct: null, basis: null }

  let rpe: number | undefined
  let rir: number | undefined

  const rirMatch = s.match(/(-?\d+(?:\.\d+)?)\s*rir/i)
  if (rirMatch) {
    rir = parseFloat(rirMatch[1])
    s = s.slice(0, rirMatch.index).trimEnd() + s.slice((rirMatch.index ?? 0) + rirMatch[0].length).trimStart()
    s = s.trim()
  }

  const rpeMatch = s.match(/@\s*(\d+(?:\.\d+)?)/)
  if (rpeMatch) {
    rpe = parseFloat(rpeMatch[1])
    s = s.slice(0, rpeMatch.index).trimEnd() + s.slice((rpeMatch.index ?? 0) + rpeMatch[0].length).trimStart()
    s = s.trim()
  }

  const base: ParsedValue = (() => {
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
  })()

  return {
    ...base,
    ...(rpe !== undefined ? { rpe } : {}),
    ...(rir !== undefined ? { rir } : {}),
  }
}

export function serializeRoutineValue(v: {
  value: number | null
  pct: number | null
  basis?: Basis | null
  rpe?: number
  rir?: number
}): string {
  let load = ''
  if (v.pct != null) load = v.basis === 'tm' ? `${v.pct}% TM` : `${v.pct}%`
  else if (v.value != null) load = String(v.value)

  let intensity = ''
  if (v.rpe != null) intensity = `@${v.rpe}`
  else if (v.rir != null) intensity = `${v.rir} RIR`

  if (load && intensity) return `${load} ${intensity}`
  if (intensity) return intensity
  return load
}

export interface ParsedReps {
  reps: number | null
  repsMax?: number
  repsOpen?: boolean
}

export function parseReps(raw: string | number | null | undefined): ParsedReps {
  const s = String(raw ?? '').trim()
  if (!s) return { reps: null }
  if (/^amrap$/i.test(s)) return { reps: null, repsOpen: true }

  const range = s.match(/^(\d+)\s*-\s*(\d+)$/)
  if (range) return { reps: parseInt(range[1], 10), repsMax: parseInt(range[2], 10) }

  const open = s.match(/^(\d+)\s*\+$/)
  if (open) return { reps: parseInt(open[1], 10), repsOpen: true }

  const single = s.match(/^\d+$/)
  if (single) return { reps: parseInt(s, 10) }

  return { reps: null }
}

export function serializeReps(r: { reps: number | null; repsMax?: number | null; repsOpen?: boolean }): string {
  if (r.repsOpen) return r.reps != null ? `${r.reps}+` : 'AMRAP'
  if (r.repsMax != null) return `${r.reps}-${r.repsMax}`
  if (r.reps != null) return `${r.reps}`
  return ''
}

export interface ParsedSets {
  count: number
  group: string | null
}

export function parseSets(raw: string | number | null | undefined): ParsedSets {
  const s = String(raw ?? '').trim()
  const m = s.match(/^(\d+)\s*([a-zA-Z])?$/)
  if (!m) return { count: 1, group: null }
  const count = parseInt(m[1], 10)
  return { count: count > 0 ? count : 1, group: m[2] ? m[2].toLowerCase() : null }
}

export function serializeSets(count: number, group: string | null): string {
  const c = Math.max(1, Math.floor(count || 1))
  return group ? `${c}${group}` : String(c)
}
