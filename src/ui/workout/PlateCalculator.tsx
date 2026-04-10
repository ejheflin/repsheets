import { useState, useEffect } from 'react'

const LBS_PLATES = [45, 35, 25, 10, 5, 2.5]
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
const BAR_WEIGHT_LBS = 45
const BAR_WEIGHT_KG = 20

const PLATE_COLORS_LBS: Record<number, string> = {
  45: 'rgba(108,99,255,0.35)',
  35: 'rgba(234,179,8,0.3)',
  25: 'rgba(34,197,94,0.3)',
  10: 'rgba(239,68,68,0.3)',
  5:  'rgba(6,182,212,0.3)',
  2.5:'rgba(168,162,158,0.25)',
}

const PLATE_COLORS_KG: Record<number, string> = {
  25:   'rgba(239,68,68,0.3)',
  20:   'rgba(108,99,255,0.35)',
  15:   'rgba(234,179,8,0.3)',
  10:   'rgba(34,197,94,0.3)',
  5:    'rgba(168,162,158,0.25)',
  2.5:  'rgba(6,182,212,0.3)',
  1.25: 'rgba(168,162,158,0.2)',
}

const HIDDEN_KEY = 'repsheets_plate_hidden'

function getHiddenExercises(): Set<string> {
  try {
    const stored = localStorage.getItem(HIDDEN_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch { return new Set() }
}

function setHiddenExercises(set: Set<string>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]))
}

interface PlateCalculatorProps {
  weight: number
  unit: string
  exercise: string
}

function getPlates(weight: number, unit: string): number[] {
  const isKg = unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kgs'
  const barWeight = isKg ? BAR_WEIGHT_KG : BAR_WEIGHT_LBS
  const availablePlates = isKg ? KG_PLATES : LBS_PLATES

  let remaining = (weight - barWeight) / 2
  if (remaining <= 0) return []

  const plates: number[] = []
  for (const plate of availablePlates) {
    while (remaining >= plate) {
      plates.push(plate)
      remaining -= plate
    }
  }
  return plates
}

function isWeightUnit(unit: string): boolean {
  const u = unit.toLowerCase().trim()
  return u === 'lbs' || u === 'lb' || u === 'kg' || u === 'kgs'
}

function plateHeight(weight: number, unit: string): number {
  const isKg = unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kgs'
  const maxPlate = isKg ? 25 : 45
  const minHeight = 14
  const maxHeight = 32
  return minHeight + (weight / maxPlate) * (maxHeight - minHeight)
}

function getPlateColor(weight: number, unit: string): string {
  const isKg = unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kgs'
  const colors = isKg ? PLATE_COLORS_KG : PLATE_COLORS_LBS
  return colors[weight] ?? 'rgba(108,99,255,0.2)'
}

export function PlateCalculator({ weight, unit, exercise }: PlateCalculatorProps) {
  const [hidden, setHidden] = useState(() => getHiddenExercises().has(exercise))

  useEffect(() => {
    setHidden(getHiddenExercises().has(exercise))
  }, [exercise])

  if (!weight || !isWeightUnit(unit)) return null

  const plates = getPlates(weight, unit)
  if (plates.length === 0) return null

  const toggle = () => {
    const set = getHiddenExercises()
    if (hidden) {
      set.delete(exercise)
    } else {
      set.add(exercise)
    }
    setHiddenExercises(set)
    setHidden(!hidden)
  }

  const plateWidth = 8
  const plateGap = 1
  const handleLength = 16
  const handleHeight = 3
  const sleeveHeight = 5
  const collarWidth = 4
  const sleeveRight = 6

  const totalPlatesWidth = plates.length * (plateWidth + plateGap)
  const svgWidth = handleLength + collarWidth + totalPlatesWidth + sleeveRight
  const maxPlateH = Math.max(...plates.map((p) => plateHeight(p, unit)))
  const svgHeight = maxPlateH + 4

  const centerY = svgHeight / 2
  const stroke = '#6c63ff'
  const platesStartX = handleLength + collarWidth

  return (
    <button onClick={toggle} className="flex-shrink-0">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block" style={{ opacity: hidden ? 0.15 : 1, transition: 'opacity 0.3s' }}>
        <defs>
          <pattern id="knurl" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke={stroke} strokeWidth="0.5" strokeOpacity="0.4" />
          </pattern>
          <pattern id="knurl2" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke={stroke} strokeWidth="0.5" strokeOpacity="0.4" />
          </pattern>
        </defs>

        {/* Handle outline */}
        <rect
          x={0} y={centerY - handleHeight}
          width={handleLength} height={handleHeight * 2}
          rx={1.5}
          fill="none" stroke={stroke} strokeWidth={0.75}
        />
        {/* Knurling crosshatch fill */}
        <rect
          x={0} y={centerY - handleHeight}
          width={handleLength} height={handleHeight * 2}
          rx={1.5}
          fill="url(#knurl)"
        />
        <rect
          x={0} y={centerY - handleHeight}
          width={handleLength} height={handleHeight * 2}
          rx={1.5}
          fill="url(#knurl2)"
        />

        {/* Collar */}
        <rect
          x={handleLength} y={centerY - 5}
          width={collarWidth} height={10}
          rx={1}
          fill={stroke} fillOpacity={0.15} stroke={stroke} strokeWidth={0.75}
        />

        {/* Sleeve (thicker bar through and past plates) */}
        <line
          x1={handleLength + collarWidth} y1={centerY}
          x2={svgWidth} y2={centerY}
          stroke={stroke} strokeWidth={sleeveHeight} strokeLinecap="round"
        />

        {/* Plates */}
        {plates.map((plate, i) => {
          const h = plateHeight(plate, unit)
          const x = platesStartX + i * (plateWidth + plateGap)
          const y = centerY - h / 2
          return (
            <rect key={i}
              x={x} y={y}
              width={plateWidth} height={h}
              rx={1.5}
              fill={getPlateColor(plate, unit)} stroke={stroke} strokeWidth={0.75}
            />
          )
        })}
      </svg>
    </button>
  )
}
