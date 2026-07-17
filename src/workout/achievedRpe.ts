// Achieved RPE/RIR is logged into the Log notes cell (col J) as a trailing token,
// using the same vocabulary as the routine cells: `@8` for RPE, `2RIR` for RIR.
// This keeps the weight cell a pure number and the sheet human-readable.

const RPE_TOKEN = /\s*@(\d+(?:\.\d+)?)\s*$/
const RIR_TOKEN = /\s*(\d+(?:\.\d+)?)\s*RIR\s*$/i

// Plausible effort ranges. Values outside these are treated as ordinary note
// text on parse ("meet Sam @135" is a weight, not an RPE of 135) and are
// refused on serialize so garbage can never enter the sheet.
const isValidRpe = (n: number) => Number.isFinite(n) && n >= 1 && n <= 10
const isValidRir = (n: number) => Number.isFinite(n) && n >= 0 && n <= 10

/** Merge an achieved RPE or RIR token onto the end of free-text notes. */
export function serializeAchieved(
  notes: string,
  rpe?: number | null,
  rir?: number | null,
): string {
  const base = (notes ?? '').trim()
  let token = ''
  if (rpe != null && isValidRpe(rpe)) token = `@${rpe}`
  else if (rir != null && isValidRir(rir)) token = `${rir}RIR`
  if (!token) return base
  return base ? `${base} ${token}` : token
}

/** Pull a trailing RPE/RIR token off notes, returning the cleaned notes and values. */
export function parseAchieved(raw: string): {
  notes: string
  rpe: number | null
  rir: number | null
} {
  const text = raw ?? ''
  const rpeMatch = text.match(RPE_TOKEN)
  if (rpeMatch && isValidRpe(Number(rpeMatch[1]))) {
    return { notes: text.slice(0, rpeMatch.index).trim(), rpe: Number(rpeMatch[1]), rir: null }
  }
  const rirMatch = text.match(RIR_TOKEN)
  if (rirMatch && isValidRir(Number(rirMatch[1]))) {
    return { notes: text.slice(0, rirMatch.index).trim(), rpe: null, rir: Number(rirMatch[1]) }
  }
  return { notes: text.trim(), rpe: null, rir: null }
}
