const LBS_PLATES = [45, 35, 25, 10, 5, 2.5]
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
const BAR_WEIGHT_LBS = 45
const BAR_WEIGHT_KG = 20

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

// Plate height proportional to weight
function plateHeight(weight: number, unit: string): number {
  const isKg = unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'kgs'
  const maxPlate = isKg ? 25 : 45
  const minHeight = 14
  const maxHeight = 32
  return minHeight + (weight / maxPlate) * (maxHeight - minHeight)
}

export function PlateCalculator({ weight, unit }: PlateCalculatorProps) {
  if (!weight || !isWeightUnit(unit)) return null

  const plates = getPlates(weight, unit)
  if (plates.length === 0) return null

  const plateWidth = 8
  const plateGap = 1
  const barEndWidth = 6
  const barHeight = 4
  const collarWidth = 4

  const totalPlatesWidth = plates.length * (plateWidth + plateGap)
  const svgWidth = barEndWidth + collarWidth + totalPlatesWidth + 8
  const maxPlateH = Math.max(...plates.map((p) => plateHeight(p, unit)))
  const svgHeight = maxPlateH + 4

  const centerY = svgHeight / 2
  const color = '#6c63ff'

  return (
    <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="mx-auto">
      {/* Bar end */}
      <rect
        x={0} y={centerY - barHeight / 2}
        width={barEndWidth} height={barHeight}
        rx={1}
        fill="none" stroke={color} strokeWidth={1}
      />

      {/* Collar */}
      <rect
        x={barEndWidth} y={centerY - 5}
        width={collarWidth} height={10}
        rx={1}
        fill="none" stroke={color} strokeWidth={1}
      />

      {/* Plates */}
      {plates.map((plate, i) => {
        const h = plateHeight(plate, unit)
        const x = barEndWidth + collarWidth + i * (plateWidth + plateGap)
        const y = centerY - h / 2
        const label = plate % 1 === 0 ? String(plate) : plate.toFixed(1)
        const fontSize = plate < 10 ? 5 : 5.5

        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={plateWidth} height={h}
              rx={1}
              fill="none" stroke={color} strokeWidth={1}
            />
            <text
              x={x + plateWidth / 2} y={centerY}
              textAnchor="middle" dominantBaseline="central"
              fill={color} fontSize={fontSize} fontWeight="600"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
