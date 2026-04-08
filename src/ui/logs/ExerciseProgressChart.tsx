import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ExerciseChipFilter } from './ExerciseChipFilter'
import type { ExerciseHistoryPoint } from '../../data/useLogs'

const CHART_COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

interface ExerciseProgressChartProps {
  exerciseHistory: (name: string, limit?: number) => ExerciseHistoryPoint[]
  uniqueExercises: string[]
}

export function ExerciseProgressChart({ exerciseHistory, uniqueExercises }: ExerciseProgressChartProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(uniqueExercises.slice(0, 1))
  })

  const toggle = (ex: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ex)) next.delete(ex)
      else next.add(ex)
      return next
    })
  }

  const { data, activeExercises } = useMemo(() => {
    const active = [...selected]
    const histories = active.map((ex) => ({
      name: ex,
      points: exerciseHistory(ex, 10),
    }))
    const allDates = new Set<string>()
    histories.forEach((h) => h.points.forEach((p) => allDates.add(p.date)))
    const sortedDates = [...allDates].sort()
    const merged = sortedDates.map((date) => {
      const entry: Record<string, string | number> = { date: date.slice(5) }
      histories.forEach((h) => {
        const point = h.points.find((p) => p.date === date)
        entry[h.name] = point?.maxWeight ?? 0
      })
      return entry
    })
    return { data: merged, activeExercises: active }
  }, [selected, exerciseHistory])

  if (uniqueExercises.length === 0) return null

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <span className="text-sm font-semibold block mb-2">Progress</span>
      <ExerciseChipFilter exercises={uniqueExercises} selected={selected} onToggle={toggle} />
      {activeExercises.length > 0 && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: -15 }}>
            <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#888' }}
            />
            {activeExercises.length > 1 && (
              <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
            )}
            {activeExercises.map((ex, i) => (
              <Bar key={ex} dataKey={ex} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} barSize={16} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-500 text-xs text-center py-8">Select an exercise to see progress</p>
      )}
    </div>
  )
}
