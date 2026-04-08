// src/ui/logs/RoutineBalance.tsx
import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'

const ROUTINE_COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316']
const PERIODS = [
  { label: '4w', weeks: 4 },
  { label: '8w', weeks: 8 },
  { label: '12w', weeks: 12 },
]

interface RoutineBalanceProps {
  routineFrequency: (weeks: number) => Map<string, number>
  allRoutines: string[]
}

export function RoutineBalance({ routineFrequency, allRoutines }: RoutineBalanceProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(4)

  const { data, average } = useMemo(() => {
    const freq = routineFrequency(selectedPeriod)
    const d = allRoutines.map((name, i) => ({
      name,
      count: freq.get(name) ?? 0,
      color: ROUTINE_COLORS[i % ROUTINE_COLORS.length],
    }))
    const total = d.reduce((sum, r) => sum + r.count, 0)
    const avg = d.length > 0 ? total / d.length : 0
    return { data: d, average: avg }
  }, [routineFrequency, selectedPeriod, allRoutines])

  if (data.length === 0) return null

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold">Routine Balance</span>
        <div className="flex bg-[#1a1a2e] rounded-md p-0.5 text-[10px]">
          {PERIODS.map((p) => (
            <button key={p.weeks} onClick={() => setSelectedPeriod(p.weeks)}
              className={`px-2.5 py-1 rounded transition ${selectedPeriod === p.weeks ? 'bg-[#2a2a4a] text-white' : 'text-gray-500'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={data.length * 36 + 10}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={120}
            tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={entry.count < average ? 0.4 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {data.some((d) => d.count < average) && (
        <div className="mt-2 pt-2 border-t border-[#3a3a5a]">
          {data.filter((d) => d.count < average && d.count > 0).map((d) => (
            <p key={d.name} className="text-[10px] text-gray-500">
              {d.name}: {d.count}× in {selectedPeriod}w — below average
            </p>
          ))}
          {data.filter((d) => d.count === 0).map((d) => (
            <p key={d.name} className="text-[10px] text-red-400">
              {d.name}: skipped in the last {selectedPeriod} weeks
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
