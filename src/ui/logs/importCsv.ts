// RFC 4180 CSV parsing for workout-app exports. Quoted fields may contain
// commas, escaped quotes (""), and newlines — Hevy/Strong notes routinely do.
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  const endField = () => { fields.push(current); current = '' }
  const endRecord = () => {
    endField()
    if (fields.length > 1 || fields[0] !== '') records.push(fields)
    fields = []
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { current += '"'; i += 2; continue }
        inQuotes = false
        i++
        continue
      }
      current += ch
      i++
      continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { endField(); i++; continue }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRecord()
      i++
      continue
    }
    current += ch
    i++
  }
  endRecord()
  return records
}

export type WeightUnit = 'lbs' | 'kg'

export interface HevyRow {
  title: string
  startTime: string
  exerciseTitle: string
  setIndex: number
  weight: number | null
  reps: number
}

export interface HevyParseResult {
  rows: HevyRow[]
  unit: WeightUnit
}

export function parseHevyCsv(text: string): HevyParseResult {
  const records = parseCsvRecords(text)
  if (records.length < 2) throw new Error('No data found in CSV')

  const header = records[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const weightIdx = col('weight_lbs') !== -1 ? col('weight_lbs') : col('weight_kg')
  const unit: WeightUnit = col('weight_kg') !== -1 ? 'kg' : 'lbs'

  const missing = [
    ['title', col('title')],
    ['start_time', col('start_time')],
    ['exercise_title', col('exercise_title')],
    ['set_index', col('set_index')],
    ['weight_lbs or weight_kg', weightIdx],
    ['reps', col('reps')],
  ].filter(([, idx]) => idx === -1).map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(`This doesn't look like a HEVY export — missing columns: ${missing.join(', ')}`)
  }

  const titleIdx = col('title')
  const startIdx = col('start_time')
  const exerciseIdx = col('exercise_title')
  const setIdx = col('set_index')
  const repsIdx = col('reps')

  const rows: HevyRow[] = []
  for (const f of records.slice(1)) {
    const get = (idx: number) => (f[idx] ?? '').trim()
    const exerciseTitle = get(exerciseIdx)
    if (!exerciseTitle) continue
    rows.push({
      title: get(titleIdx),
      startTime: get(startIdx),
      exerciseTitle,
      setIndex: parseInt(get(setIdx)) || 0,
      weight: get(weightIdx) ? parseFloat(get(weightIdx)) : null,
      reps: parseInt(get(repsIdx)) || 0,
    })
  }
  return { rows, unit }
}

export interface StrongRow {
  date: string
  workoutName: string
  exerciseName: string
  setOrder: number
  weight: number | null
  reps: number
}

export interface StrongParseResult {
  rows: StrongRow[]
  // Strong's export doesn't state the unit unless a "Weight Unit" column is
  // present — null means the user must confirm it
  unit: WeightUnit | null
}

export function parseStrongCsv(text: string): StrongParseResult {
  const records = parseCsvRecords(text)
  if (records.length < 2) throw new Error('No data found in CSV')

  const header = records[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)

  const missing = [
    ['Date', col('date')],
    ['Workout Name', col('workout name')],
    ['Exercise Name', col('exercise name')],
    ['Set Order', col('set order')],
    ['Weight', col('weight')],
    ['Reps', col('reps')],
  ].filter(([, idx]) => idx === -1).map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(`This doesn't look like a Strong export — missing columns: ${missing.join(', ')}`)
  }

  const dateIdx = col('date')
  const workoutIdx = col('workout name')
  const exerciseIdx = col('exercise name')
  const setIdx = col('set order')
  const weightIdx = col('weight')
  const repsIdx = col('reps')
  const unitIdx = col('weight unit')

  let unit: WeightUnit | null = null
  const rows: StrongRow[] = []
  for (const f of records.slice(1)) {
    const get = (idx: number) => (f[idx] ?? '').trim()
    const exerciseName = get(exerciseIdx)
    if (!exerciseName) continue
    if (unit === null && unitIdx !== -1) {
      const u = get(unitIdx).toLowerCase()
      if (u === 'kg' || u === 'kgs') unit = 'kg'
      else if (u === 'lb' || u === 'lbs') unit = 'lbs'
    }
    rows.push({
      date: get(dateIdx).split(' ')[0],
      workoutName: get(workoutIdx),
      exerciseName,
      setOrder: parseInt(get(setIdx)) || 1,
      weight: get(weightIdx) ? parseFloat(get(weightIdx)) : null,
      reps: Math.round(parseFloat(get(repsIdx)) || 0),
    })
  }
  return { rows, unit }
}
