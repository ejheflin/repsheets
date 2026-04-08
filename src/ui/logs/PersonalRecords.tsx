// src/ui/logs/PersonalRecords.tsx
import type { PersonalRecord } from '../../data/useLogs'

interface PersonalRecordsProps {
  records: PersonalRecord[]
}

function PRBadge({ label, value, unit, date }: { label: string; value: number; unit: string; date: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-md px-2.5 py-1.5">
      <span className="text-[10px] text-gray-500 w-12">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
      <span className="text-[10px] text-gray-500">{unit}</span>
      <span className="text-[9px] text-gray-600 ml-auto">{date.slice(5)}</span>
    </div>
  )
}

export function PersonalRecords({ records }: PersonalRecordsProps) {
  const sorted = [...records].sort((a, b) => a.exercise.localeCompare(b.exercise))
  if (sorted.length === 0) return null
  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <span className="text-sm font-semibold block mb-3">Personal Records</span>
      <div className="space-y-3">
        {sorted.map((pr) => (
          <div key={pr.exercise}>
            <p className="text-xs font-semibold text-gray-300 mb-1.5">{pr.exercise}</p>
            <div className="space-y-1">
              {pr.maxWeight && (
                <PRBadge label="Weight" value={pr.maxWeight.value} unit="" date={pr.maxWeight.date} />
              )}
              {pr.maxReps && (
                <PRBadge label="Reps" value={pr.maxReps.value} unit="reps" date={pr.maxReps.date} />
              )}
              {pr.maxVolume && (
                <PRBadge label="Volume" value={pr.maxVolume.value} unit="" date={pr.maxVolume.date} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
