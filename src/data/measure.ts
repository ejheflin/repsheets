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

export function formatValue(value: number | null, unit: string | null | undefined): string {
  if (value === null) return ''
  const measure = measureOf(unit)
  if (measure === 'time') return formatDuration(value)
  if (measure === 'weight' || measure === 'distance') return `${Math.round(value)} ${unit}`
  return `${Math.round(value)}`
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
