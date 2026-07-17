export type Measure = 'weight' | 'reps' | 'time' | 'distance'

export const WEIGHT_UNITS = ['lbs', 'kg'] as const
export const TIME_UNITS = ['sec'] as const
export const DISTANCE_UNITS = ['m', 'km', 'mi'] as const

export function measureOf(unit: string | null | undefined): Measure {
  const u = (unit ?? '').trim().toLowerCase()
  if ((WEIGHT_UNITS as readonly string[]).includes(u)) return 'weight'
  if ((TIME_UNITS as readonly string[]).includes(u)) return 'time'
  if ((DISTANCE_UNITS as readonly string[]).includes(u)) return 'distance'
  return 'reps'
}

/** Smallest sensible loading increment for a weight unit: 2.5 kg (a 1.25 kg plate
 * per side) or 5 lb. Used to round autoregulated/target weights and 1RM estimates. */
export function weightIncrement(unit: string | null | undefined): number {
  return (unit ?? '').trim().toLowerCase() === 'kg' ? 2.5 : 5
}

/** Round a weight to the nearest loadable increment for its unit. */
export function roundWeight(weight: number, unit: string | null | undefined): number {
  const inc = weightIncrement(unit)
  return Math.round(weight / inc) * inc
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Parse a duration the user typed into total seconds. Accepts `m:ss` / `m:s` / `m:`
 * (colon → minutes:seconds) or a plain number (treated as seconds). Empty → null. */
export function parseDuration(raw: string): number | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  if (s.includes(':')) {
    const [mStr, sStr] = s.split(':')
    const mins = parseInt(mStr, 10) || 0
    const secs = parseInt(sStr, 10) || 0
    return mins * 60 + secs
  }
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

export function formatValue(value: number | null, unit: string | null | undefined): string {
  if (value === null) return ''
  const measure = measureOf(unit)
  if (measure === 'time') return formatDuration(value)
  // One decimal, trailing zeros stripped — 62.5 kg and 0.5 mi must not
  // display as 63 kg / 1 mi
  const rounded = Number(value.toFixed(1))
  if (measure === 'weight' || measure === 'distance') return `${rounded} ${unit}`
  return `${rounded}`
}

export interface MeasureConfig {
  label: string
  units: readonly string[]
  defaultUnit: string
  supportsPercent: boolean
}

export const MEASURES: Record<Measure, MeasureConfig> = {
  weight: {
    label: 'Weight',
    units: WEIGHT_UNITS,
    defaultUnit: 'lbs',
    supportsPercent: true,
  },
  reps: {
    label: 'Reps',
    units: [],
    defaultUnit: '',
    supportsPercent: false,
  },
  time: {
    label: 'Time',
    units: TIME_UNITS,
    defaultUnit: 'sec',
    supportsPercent: false,
  },
  distance: {
    label: 'Distance',
    units: DISTANCE_UNITS,
    defaultUnit: 'm',
    supportsPercent: false,
  },
}
