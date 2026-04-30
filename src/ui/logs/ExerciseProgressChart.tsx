import { useState, useMemo, useEffect } from 'react'
import { ComposedChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ExerciseChipFilter } from './ExerciseChipFilter'
import type { ExerciseHistoryPoint } from '../../data/useLogs'

const CHART_COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
const LIMITS = [10, 20, 50, 0] // 0 = all
const LIMIT_LABELS = ['10', '20', '50', 'All']

interface ExerciseProgressChartProps {
  exerciseHistory: (name: string, limit?: number) => ExerciseHistoryPoint[]
  exerciseHistoryByAthlete: (name: string, limit?: number) => {
    dates: string[]
    athletes: string[]
    data: Record<string, string | number | undefined>[]
  }
  uniqueExercises: string[]
  programs: string[]
  programExercises: Map<string, string[]>
  lastLoggedProgram: string | null
  isShared: boolean
  showAllAthletes: boolean // true when "Everyone" chip is selected
}

export function ExerciseProgressChart({
  exerciseHistory, exerciseHistoryByAthlete, uniqueExercises,
  programs, programExercises, lastLoggedProgram,
  isShared, showAllAthletes,
}: ExerciseProgressChartProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('line')
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)

  // Pre-select last logged program
  useEffect(() => {
    if (!selectedProgram && lastLoggedProgram && programs.includes(lastLoggedProgram)) {
      setSelectedProgram(lastLoggedProgram)
    }
  }, [lastLoggedProgram, programs, selectedProgram])

  // Filter exercises by selected program
  const filteredExercises = useMemo(() => {
    if (!selectedProgram) return uniqueExercises
    const programExs = programExercises.get(selectedProgram) ?? []
    return uniqueExercises.filter((ex) => programExs.includes(ex))
  }, [selectedProgram, uniqueExercises, programExercises])

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const exs = programExercises.get(p) ?? []
      return exs.some((ex) => uniqueExercises.includes(ex))
    })
  }, [programs, programExercises, uniqueExercises])

  // Auto-select first exercise when program changes
  useEffect(() => {
    if (filteredExercises.length > 0 && (!selectedExercise || !filteredExercises.includes(selectedExercise))) {
      setSelectedExercise(filteredExercises[0])
    }
  }, [filteredExercises, selectedExercise])

  const toggleProgram = (program: string) => {
    if (selectedProgram === program) {
      setSelectedProgram(null)
    } else {
      setSelectedProgram(program)
      setSelectedExercise(null) // reset exercise, useEffect will pick first
    }
  }

  const selectExercise = (ex: string) => {
    setSelectedExercise(ex)
  }

  // Single exercise selected as a Set for the chip filter
  const selectedSet = useMemo(() => {
    return selectedExercise ? new Set([selectedExercise]) : new Set<string>()
  }, [selectedExercise])

  // Build chart data
  const { data, series, hasOrm } = useMemo(() => {
    if (!selectedExercise) return { data: [], series: [] as string[], hasOrm: false }

    const effectiveLimit = limit === 0 ? 9999 : limit

    if (isShared && showAllAthletes) {
      // Multi-athlete mode — no 1RM line
      const result = exerciseHistoryByAthlete(selectedExercise, effectiveLimit)
      return { data: result.data, series: result.athletes, hasOrm: false }
    }

    // Single athlete mode
    const points = exerciseHistory(selectedExercise, effectiveLimit)
    const anyOrm = points.some((p) => p.estimatedOrm != null)
    const chartData = points.map((p) => ({
      date: p.date.slice(5),
      weight: p.maxWeight,
      ...(anyOrm ? { orm: p.estimatedOrm ?? undefined } : {}),
    }))
    return { data: chartData, series: ['weight'], hasOrm: anyOrm }
  }, [selectedExercise, exerciseHistory, exerciseHistoryByAthlete, isShared, showAllAthletes, limit])

  const progressDelta = useMemo(() => {
    if (showAllAthletes || data.length < 2) return null
    const first = data[0]?.weight as number | undefined
    const last = (data[data.length - 1]?.weight) as number | undefined
    if (first == null || last == null || first === 0) return null
    const delta = Math.round((last - first) * 10) / 10
    const pct = Math.round((delta / first) * 100)
    return { first, last, delta, pct }
  }, [data, showAllAthletes])

  if (uniqueExercises.length === 0) return null

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">Progress</span>
        <div className="flex gap-1.5">
          {/* Timeline selector */}
          <div className="flex bg-[#1a1a2e] rounded-md p-0.5 text-[10px]">
            {LIMITS.map((l, i) => (
              <button key={l} onClick={() => setLimit(l)}
                className={`px-1.5 py-0.5 rounded transition ${limit === l ? 'bg-[#2a2a4a] text-white' : 'text-gray-500'}`}>
                {LIMIT_LABELS[i]}
              </button>
            ))}
          </div>
          {/* Chart type toggle */}
          <div className="flex bg-[#1a1a2e] rounded-md p-0.5">
            <button onClick={() => setChartType('bar')}
              className={`px-2 py-1 rounded transition ${chartType === 'bar' ? 'bg-[#2a2a4a]' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={chartType === 'bar' ? '#fff' : '#555'} strokeWidth="1.5" strokeLinecap="round">
                <line x1="3" y1="14" x2="3" y2="6" /><line x1="8" y1="14" x2="8" y2="2" /><line x1="13" y1="14" x2="13" y2="9" />
              </svg>
            </button>
            <button onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded transition ${chartType === 'line' ? 'bg-[#2a2a4a]' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={chartType === 'line' ? '#fff' : '#555'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 12 5 6 9 9 15 3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {filteredPrograms.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-3 px-3 scrollbar-hide">
          {filteredPrograms.map((p) => (
            <button key={p} onClick={() => toggleProgram(p)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition border ${
                selectedProgram === p
                  ? 'border-[#6c63ff] text-[#6c63ff] bg-[#6c63ff]/10'
                  : 'border-[#3a3a5a] text-gray-500'
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}

      <ExerciseChipFilter exercises={filteredExercises} selected={selectedSet} onToggle={selectExercise} />

      {progressDelta && (
        <div className="flex items-center gap-2 px-0.5 pb-2 text-[12px]">
          <span className="text-gray-500">{progressDelta.first}</span>
          <span className="text-gray-600">→</span>
          <span className="text-white font-medium">{progressDelta.last}</span>
          <span className={`ml-auto font-semibold tabular-nums ${progressDelta.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {progressDelta.delta >= 0 ? '+' : ''}{progressDelta.delta}
            <span className="font-normal text-[11px] ml-1 opacity-70">
              ({progressDelta.pct >= 0 ? '+' : ''}{progressDelta.pct}%)
            </span>
          </span>
        </div>
      )}

      {selectedExercise && data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            {chartType === 'bar' ? (
              <ComposedChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: -15 }}>
                <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#888' }}
                  cursor={{ fill: 'transparent', stroke: '#6c63ff', strokeDasharray: '4 2', strokeWidth: 1 }}
                />
                {(series.length > 1 || hasOrm) && <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />}
                {series.map((s, i) => (
                  <Bar key={s} dataKey={s} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} barSize={16} />
                ))}
                {hasOrm && (
                  <Line type="monotone" dataKey="orm" name="Est. 1RM"
                    stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3"
                    dot={{ r: 2.5, fill: '#a78bfa', strokeWidth: 0 }} connectNulls={true} />
                )}
              </ComposedChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: -15 }}>
                <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false}
                  domain={[(min: number) => Math.floor(min * 0.9), (max: number) => Math.ceil(max * 1.05)]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#888' }}
                />
                {(series.length > 1 || hasOrm) && <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />}
                {series.map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s} stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                    connectNulls={true} />
                ))}
                {hasOrm && (
                  <Line type="monotone" dataKey="orm" name="Est. 1RM"
                    stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3"
                    dot={{ r: 2.5, fill: '#a78bfa', strokeWidth: 0 }} connectNulls={true} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </>
      ) : (
        <p className="text-gray-500 text-xs text-center py-8">Select an exercise to see progress</p>
      )}
    </div>
  )
}
