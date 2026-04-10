const LBS_PLATES = [45, 35, 25, 10, 5, 2.5]
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
const BAR_WEIGHT_LBS = 45
const BAR_WEIGHT_KG = 20

// Subtle fills that stay within the dark theme — low opacity purple tints
const PLATE_COLORS_LBS: Record<number, string> = {
  45: 'rgba(108,99,255,0.35)',   // deep purple
  35: 'rgba(234,179,8,0.3)',     // amber
  25: 'rgba(34,197,94,0.3)',     // green
  10: 'rgba(239,68,68,0.3)',     // red
  5:  'rgba(6,182,212,0.3)',     // cyan
  2.5:'rgba(168,162,158,0.25)',  // gray
}

const PLATE_COLORS_KG: Record<number, string> = {
  25:   'rgba(239,68,68,0.3)',     // red
  20:   'rgba(108,99,255,0.35)',   // blue
  15:   'rgba(234,179,8,0.3)',     // yellow
  10:   'rgba(34,197,94,0.3)',     // green
  5:    'rgba(168,162,158,0.25)',   // white/gray
  2.5:  'rgba(6,182,212,0.3)',     // cyan
  1.25: 'rgba(168,162,158,0.2)',   // light gray
}

interface PlateCalculatorProps {
  weight: number
  unit: string
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

export function PlateCalculator({ weight, unit }: PlateCalculatorProps) {
  if (!weight || !isWeightUnit(unit)) return null

  const plates = getPlates(weight, unit)
  if (plates.length === 0) return null

  const plateWidth = 8
  const plateGap = 1
  const barExtendLeft = 12   // bar sticking out on the left
  const barHeight = 4
  const collarWidth = 4
  const barExtendRight = 5   // nub past the last plate

  const totalPlatesWidth = plates.length * (plateWidth + plateGap)
  const svgWidth = barExtendLeft + collarWidth + totalPlatesWidth + barExtendRight
  const maxPlateH = Math.max(...plates.map((p) => plateHeight(p, unit)))
  const svgHeight = maxPlateH + 4

  const centerY = svgHeight / 2
  const stroke = '#6c63ff'

  const platesStartX = barExtendLeft + collarWidth

  return (
    <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="block mx-auto mb-0.5">
      {/* Bar — full length */}
      <line
        x1={0} y1={centerY}
        x2={svgWidth} y2={centerY}
        stroke={stroke} strokeWidth={barHeight} strokeLinecap="round"
      />

      {/* Collar */}
      <rect
        x={barExtendLeft} y={centerY - 5}
        width={collarWidth} height={10}
        rx={1}
        fill={stroke} fillOpacity={0.15} stroke={stroke} strokeWidth={0.75}
      />

      {/* Plates */}
      {plates.map((plate, i) => {
        const h = plateHeight(plate, unit)
        const x = platesStartX + i * (plateWidth + plateGap)
        const y = centerY - h / 2
        const label = plate % 1 === 0 ? String(plate) : plate.toFixed(1)
        const fontSize = plate < 10 ? 5 : 5.5

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
  )
}
