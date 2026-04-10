import { useState, useMemo } from 'react'
import { CalendarToggle, type CalendarColorMode } from './CalendarToggle'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316']
const MAX_DOTS = 5

interface CalendarViewProps {
  workoutDates: Map<string, string[]>  // date → routine names
  athleteDates?: Map<string, string[]> // date → athlete names
  allRoutines: string[]
  allAthletes?: string[]
}

export function CalendarView({ workoutDates, athleteDates, allRoutines, allAthletes = [] }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [colorMode, setColorMode] = useState<CalendarColorMode>(
    allAthletes.length > 1 ? 'athlete' : 'routine'
  )

  const today = new Date().toISOString().split('T')[0]

  const routineColorMap = useMemo(() => {
    const map = new Map<string, string>()
    allRoutines.forEach((r, i) => map.set(r, COLORS[i % COLORS.length]))
    return map
  }, [allRoutines])

  const athleteColorMap = useMemo(() => {
    const map = new Map<string, string>()
    allAthletes.forEach((a, i) => map.set(a, COLORS[i % COLORS.length]))
    return map
  }, [allAthletes])

  const { year, month } = currentMonth
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const getDateStr = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getDayDots = (day: number): string[] => {
    const dateStr = getDateStr(day)

    if (colorMode === 'athlete') {
      const athletes = athleteDates?.get(dateStr)
      if (!athletes || athletes.length === 0) return []
      return athletes.slice(0, MAX_DOTS).map((a) => athleteColorMap.get(a) ?? '#6c63ff')
    }

    // routine mode
    const routines = workoutDates.get(dateStr)
    if (!routines || routines.length === 0) return []
    return routines.slice(0, MAX_DOTS).map((r) => routineColorMap.get(r) ?? '#6c63ff')
  }

  const hasWorkout = (day: number): boolean => {
    const dateStr = getDateStr(day)
    if (colorMode === 'athlete') {
      const athletes = athleteDates?.get(dateStr)
      return !!athletes && athletes.length > 0
    }
    const routines = workoutDates.get(dateStr)
    return !!routines && routines.length > 0
  }

  const activeColorMap = colorMode === 'athlete' ? athleteColorMap : routineColorMap
  const activeLabels = colorMode === 'athlete' ? allAthletes : allRoutines
  const showToggle = allAthletes.length > 1

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <div className="flex justify-between items-center mb-3">
        <button onClick={prevMonth} className="text-gray-400 px-2 text-sm">‹</button>
        <span className="text-sm font-semibold">{monthName}</span>
        <button onClick={nextMonth} className="text-gray-400 px-2 text-sm">›</button>
      </div>
      {showToggle && (
        <div className="flex justify-end mb-2">
          <CalendarToggle mode={colorMode} onToggle={setColorMode} />
        </div>
      )}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d) => (
          <div key={d} className="text-[10px] text-gray-500 pb-1">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const isToday = getDateStr(day) === today
          const dots = getDayDots(day)
          const worked = hasWorkout(day)
          return (
            <div key={day} className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${isToday ? 'ring-1 ring-white ring-offset-1 ring-offset-[#2a2a4a]' : ''}`}
                style={worked ? { backgroundColor: '#3a3a5a', color: '#fff' } : { color: '#888' }}
              >{day}</div>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.map((c, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {activeLabels.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-[#3a3a5a]">
          {activeLabels.map((label) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeColorMap.get(label) }} />
              <span className="text-[9px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
