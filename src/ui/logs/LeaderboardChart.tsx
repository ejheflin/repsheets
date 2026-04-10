import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { LogEntry } from '../../types'

type Metric = 'workouts' | 'volume'
const METRICS: { key: Metric; label: string }[] = [
  { key: 'workouts', label: 'Workouts' },
  { key: 'volume', label: 'Volume' },
]

const PERIODS = [
  { label: '4w', weeks: 4 },
  { label: '8w', weeks: 8 },
  { label: '12w', weeks: 12 },
  { label: 'All', weeks: 0 },
]

interface LeaderboardChartProps {
  allLogs: LogEntry[]
  athletes: string[]
}

export function LeaderboardChart({ allLogs, athletes }: LeaderboardChartProps) {
  const [metric, setMetric] = useState<Metric>('workouts')
  const [periodWeeks, setPeriodWeeks] = useState(0)

  const data = useMemo(() => {
    const cutoff = periodWeeks > 0
      ? (() => { const d = new Date(); d.setDate(d.getDate() - periodWeeks * 7); return d.toISOString().split('T')[0] })()
      : null

    const filtered = cutoff ? allLogs.filter((l) => l.date >= cutoff) : allLogs

    return athletes.map((athlete) => {
      const athleteLogs = filtered.filter((l) => l.athlete === athlete)

      let value = 0
      if (metric === 'workouts') {
        value = new Set(athleteLogs.map((l) => l.date)).size
      } else if (metric === 'volume') {
        value = athleteLogs.reduce((sum, l) => sum + l.reps * (l.value ?? 0), 0)
      }

      return { name: athlete, value }
    }).sort((a, b) => b.value - a.value)
  }, [allLogs, athletes, metric, periodWeeks])

  // Find the longest athlete name to size the Y axis
  const maxNameLength = useMemo(() => {
    return Math.max(...athletes.map((a) => a.length), 5)
  }, [athletes])
  const yAxisWidth = Math.min(Math.max(maxNameLength * 7, 50), 120)

  if (athletes.length < 2) return null

  const formatValue = (v: number) => {
    if (metric === 'volume' && v >= 1000) return `${Math.round(v / 1000)}k`
    return String(v)
  }

  const topValue = data.length > 0 ? data[0].value : 0

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">Leaderboard</span>
        <div className="flex bg-[#1a1a2e] rounded-md p-0.5 text-[10px]">
          {PERIODS.map((p) => (
            <button key={p.weeks} onClick={() => setPeriodWeeks(p.weeks)}
              className={`px-1.5 py-0.5 rounded transition ${periodWeeks === p.weeks ? 'bg-[#2a2a4a] text-white' : 'text-gray-500'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        {METRICS.map((m) => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
              metric === m.key ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={data.length * 44 + 10}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={yAxisWidth}
            tick={{ fill: '#ccc', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [formatValue(Number(value)), metric === 'workouts' ? 'Workouts' : 'Volume']}
            cursor={{ fill: 'transparent', stroke: '#6c63ff', strokeDasharray: '4 2', strokeWidth: 1 }}
          />
          <Bar dataKey="value" fill="#6c63ff" radius={[0, 6, 6, 0]} barSize={24}
            label={{
              position: 'right',
              fill: '#888',
              fontSize: 10,
              formatter: (v: unknown) => {
                const val = Number(v)
                const label = formatValue(val)
                return label
              },
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
