import type { WeightUnit } from './importCsv'

interface UnitToggleProps {
  unit: WeightUnit
  onChange: (unit: WeightUnit) => void
}

export function UnitToggle({ unit, onChange }: UnitToggleProps) {
  return (
    <div className="flex gap-2">
      {(['lbs', 'kg'] as const).map((u) => (
        <button key={u} onClick={() => onChange(u)}
          className={`flex-1 rounded-[10px] p-2.5 text-sm font-semibold active:opacity-80 ${
            unit === u ? 'bg-[#6c63ff]/15 border border-[#6c63ff] text-[#6c63ff]' : 'bg-[#2a2a4a] border border-[#3a3a5a] text-gray-400'
          }`}>
          {u}
        </button>
      ))}
    </div>
  )
}
