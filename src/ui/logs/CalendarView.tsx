import { useState, useMemo } from 'react'
import { CalendarToggle, type CalendarColorMode } from './CalendarToggle'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const ROUTINE_COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316']

interface CalendarViewProps {
  workoutDates: Map<string, string[]>
  allRoutines: string[]
}

export function CalendarView({ workoutDates, allRoutines }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [colorMode, setColorMode] = useState<CalendarColorMode>('attendance')

  const today = new Date().toISOString().split('T')[0]

  const routineColorMap = useMemo(() => {
    const map = new Map<string, string>()
    allRoutines.forEach((r, i) => map.set(r, ROUTINE_COLORS[i % ROUTINE_COLORS.length]))
    return map
  }, [allRoutines])

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

  const getDayColor = (day: number): string | null => {
    const dateStr = getDateStr(day)
    const routines = workoutDates.get(dateStr)
    if (!routines || routines.length === 0) return null
    if (colorMode === 'attendance') return '#6c63ff'
    return routineColorMap.get(routines[0]) ?? '#6c63ff'
  }

  const getDayDots = (day: number): string[] => {
    if (colorMode !== 'routine') return []
    const dateStr = getDateStr(day)
    const routines = workoutDates.get(dateStr)
    if (!routines || routines.length <= 1) return []
    return routines.slice(1).map((r) => routineColorMap.get(r) ?? '#6c63ff')
  }

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <div className="flex justify-between items-center mb-3">
        <button onClick={prevMonth} className="text-gray-400 px-2 text-sm">‹</button>
        <span className="text-sm font-semibold">{monthName}</span>
        <button onClick={nextMonth} className="text-gray-400 px-2 text-sm">›</button>
      </div>
      <div className="flex justify-end mb-2">
        <CalendarToggle mode={colorMode} onToggle={setColorMode} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d) => (
          <div key={d} className="text-[10px] text-gray-500 pb-1">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const color = getDayColor(day)
          const isToday = getDateStr(day) === today
          const dots = getDayDots(day)
          return (
            <div key={day} className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${isToday ? 'ring-1 ring-white ring-offset-1 ring-offset-[#2a2a4a]' : ''}`}
                style={color ? { backgroundColor: color, color: '#fff' } : { color: '#888' }}
              >{day}</div>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.map((c, i) => (
                    <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {colorMode === 'routine' && allRoutines.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-[#3a3a5a]">
          {allRoutines.map((r) => (
            <div key={r} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: routineColorMap.get(r) }} />
              <span className="text-[9px] text-gray-400">{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
