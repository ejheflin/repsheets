import { useState, useEffect, useRef, useCallback } from 'react'
import { PlateSettingsModal, loadPlateSettings, type PlateSettingsData } from './PlateSettings'

const LBS_PLATES = [55, 45, 35, 25, 15, 10, 5, 2.5]
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
const BAR_WEIGHT_LBS = 45
const BAR_WEIGHT_KG = 20

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

function isWeightUnit(unit: string): boolean {
  const u = unit.toLowerCase().trim()
  return u === 'lbs' || u === 'lb' || u === 'kg' || u === 'kgs'
}

function getPlates(weight: number, unit: string, available: number[]): number[] {
  const isKg = unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kgs'
  const barWeight = isKg ? BAR_WEIGHT_KG : BAR_WEIGHT_LBS
  const allPlates = isKg ? KG_PLATES : LBS_PLATES
  const usablePlates = allPlates.filter((p) => available.includes(p))

  let remaining = (weight - barWeight) / 2
  if (remaining <= 0) return []

  const plates: number[] = []
  for (const plate of usablePlates) {
    while (remaining >= plate) {
      plates.push(plate)
      remaining -= plate
    }
  }
  return plates
}

function plateHeight(weight: number, unit: string): number {
  const isKg = unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kgs'
  const maxPlate = isKg ? 25 : 55
  const minHeight = 14
  const maxHeight = 32
  return minHeight + (weight / maxPlate) * (maxHeight - minHeight)
}

export function PlateCalculator({ weight, unit, exercise }: PlateCalculatorProps) {
  const [hidden, setHidden] = useState(() => getHiddenExercises().has(exercise))
  const [settings, setSettings] = useState<PlateSettingsData>(loadPlateSettings)
  const [showSettings, setShowSettings] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  useEffect(() => {
    setHidden(getHiddenExercises().has(exercise))
  }, [exercise])

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setShowSettings(true)
    }, 600)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!didLongPress.current) {
      // Short tap — toggle visibility
      const set = getHiddenExercises()
      if (hidden) {
        set.delete(exercise)
      } else {
        set.add(exercise)
      }
      setHiddenExercises(set)
      setHidden(!hidden)
    }
  }, [hidden, exercise])

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  if (!weight || !isWeightUnit(unit)) return null

  const plates = getPlates(weight, unit, settings.availablePlates)
  if (plates.length === 0) return null

  const plateWidth = 8
  const plateGap = 1
  const handleLength = 16
  const collarHeight = 14
  const sleeveHeight = collarHeight
  const handleHeight = Math.round(sleeveHeight * 2 / 3)
  const collarWidth = 4
  const sleeveRight = 6

  const totalPlatesWidth = plates.length * (plateWidth + plateGap)
  const svgWidth = handleLength + collarWidth + totalPlatesWidth + sleeveRight
  const maxPlateH = Math.max(...plates.map((p) => plateHeight(p, unit)))
  const svgHeight = maxPlateH + 4

  const centerY = svgHeight / 2
  const stroke = '#6c63ff'
  const platesStartX = handleLength + collarWidth
  const safeId = exercise.replace(/[^a-zA-Z0-9]/g, '_')

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="flex-shrink-0 select-none"
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="block" style={{ opacity: hidden ? 0 : 1, transition: 'opacity 0.3s' }}>
          <defs>
            <pattern id={`knurl-${safeId}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="3" stroke={stroke} strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            <pattern id={`knurl2-${safeId}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="3" stroke={stroke} strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
          </defs>

          {/* Handle (knurled, thinner) */}
          <rect
            x={0} y={centerY - handleHeight / 2}
            width={handleLength} height={handleHeight}
            rx={1.5}
            fill="none" stroke={stroke} strokeWidth={0.75}
          />
          <rect
            x={0} y={centerY - handleHeight / 2}
            width={handleLength} height={handleHeight}
            rx={1.5}
            fill={`url(#knurl-${exercise})`}
          />
          <rect
            x={0} y={centerY - handleHeight / 2}
            width={handleLength} height={handleHeight}
            rx={1.5}
            fill={`url(#knurl2-${exercise})`}
          />

          {/* Collar (solid fill) */}
          <rect
            x={handleLength} y={centerY - collarHeight / 2}
            width={collarWidth} height={collarHeight}
            rx={1}
            fill={stroke} stroke={stroke} strokeWidth={0.75}
          />

          {/* Sleeve (filled like collar) */}
          <rect
            x={handleLength + collarWidth} y={centerY - sleeveHeight / 2}
            width={totalPlatesWidth + sleeveRight} height={sleeveHeight}
            rx={1}
            fill={stroke} fillOpacity={0.15} stroke={stroke} strokeWidth={0.75}
          />

          {/* Plates */}
          {plates.map((plate, i) => {
            const h = plateHeight(plate, unit)
            const x = platesStartX + i * (plateWidth + plateGap)
            const y = centerY - h / 2
            const color = settings.colorMap[plate] ?? 'rgba(108,99,255,0.35)'
            return (
              <rect key={i}
                x={x} y={y}
                width={plateWidth} height={h}
                rx={1.5}
                fill={color} stroke={stroke} strokeWidth={0.75}
              />
            )
          })}
        </svg>
      </button>

      {showSettings && (
        <PlateSettingsModal
          onClose={() => setShowSettings(false)}
          onChange={(data) => setSettings(data)}
        />
      )}
    </>
  )
}
