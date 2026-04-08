# Logs & Analytics — Implementation Plan (Phase 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Logs tab with a monthly calendar view, routine frequency insights, exercise progress bar chart with chip filters, and personal records — all for a single athlete.

**Architecture:** All analytics derived client-side from the cached LogEntry[] array. No server-side computation. Recharts renders the charts. The useLogs hook provides data and derived metrics to all Logs sub-components.

**Tech Stack:** React 18, TypeScript, Recharts, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-08-repsheets-design.md` — Tab 3: Logs section

---

## File Structure (Phase 2 scope)

```
src/
  data/
    useLogs.ts                      # Hook: fetch/cache logs, derive analytics helpers
  ui/
    logs/
      LogsTab.tsx                   # Main tab, stacks all sections vertically
      CalendarView.tsx              # Compact monthly attendance grid
      CalendarToggle.tsx            # Toggle between "By Routine" / color modes
      RoutineBalance.tsx            # Horizontal bar chart of routine frequency
      ExerciseChipFilter.tsx        # Scrollable exercise name chips
      ExerciseProgressChart.tsx     # Bar chart: max weight over last N workouts
      PersonalRecords.tsx           # PR badges per exercise
```

---

### Task 1: useLogs Hook

**Goal:** Create a hook that fetches and caches log entries, and provides derived analytics data to all Logs sub-components.

**Files:**
- Create: `src/data/useLogs.ts`

**Acceptance Criteria:**
- [ ] Fetches logs from Sheets API, caches in IndexedDB, falls back to cache on error
- [ ] `logs` returns all LogEntry[] for the current athlete
- [ ] `workoutDates` returns a Map<string, string[]> of date → routine names (for calendar)
- [ ] `routineFrequency(weeks)` returns routine name → count for the last N weeks
- [ ] `exerciseHistory(exerciseName, limit)` returns last N workout entries for an exercise (max weight per date)
- [ ] `personalRecords()` returns per-exercise PRs: max weight, max reps, max volume (reps × value)
- [ ] `uniqueExercises` returns distinct exercise names from logs
- [ ] Compiles without type errors

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create useLogs.ts**

```ts
// src/data/useLogs.ts
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { fetchLogEntries } from '../sheets/sheetsApi'
import { saveLogs, getLogs } from './db'
import type { LogEntry } from '../types'

export interface ExerciseHistoryPoint {
  date: string
  maxWeight: number
}

export interface PersonalRecord {
  exercise: string
  maxWeight: { value: number; date: string } | null
  maxReps: { value: number; date: string } | null
  maxVolume: { value: number; date: string } | null
}

export function useLogs() {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!spreadsheetId) return
    try {
      const logs = await fetchLogEntries(spreadsheetId)
      await saveLogs(spreadsheetId, logs)
      setAllLogs(logs)
    } catch {
      const cached = await getLogs(spreadsheetId)
      setAllLogs(cached)
    }
    setIsLoading(false)
  }, [spreadsheetId])

  useEffect(() => {
    const load = async () => {
      if (!spreadsheetId) { setIsLoading(false); return }
      const cached = await getLogs(spreadsheetId)
      if (cached.length > 0) {
        setAllLogs(cached)
        setIsLoading(false)
      }
      refresh()
    }
    load()
  }, [spreadsheetId, refresh])

  // Filter to current athlete only
  const logs = useMemo(() => {
    if (!user) return allLogs
    return allLogs.filter((l) => l.athlete === user.email)
  }, [allLogs, user])

  // Map of date → routine names that were logged that day
  const workoutDates = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const log of logs) {
      if (!map.has(log.date)) map.set(log.date, [])
      const routines = map.get(log.date)!
      if (!routines.includes(log.routine)) routines.push(log.routine)
    }
    return map
  }, [logs])

  // Routine frequency over last N weeks
  const routineFrequency = useCallback((weeks: number) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeks * 7)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const freq = new Map<string, number>()
    // Count unique dates per routine (not individual sets)
    const seen = new Set<string>()
    for (const log of logs) {
      if (log.date < cutoffStr) continue
      const key = `${log.date}|${log.routine}`
      if (seen.has(key)) continue
      seen.add(key)
      freq.set(log.routine, (freq.get(log.routine) ?? 0) + 1)
    }
    return freq
  }, [logs])

  // Exercise history: max weight per workout date, last N dates
  const exerciseHistory = useCallback((exerciseName: string, limit: number = 10): ExerciseHistoryPoint[] => {
    const byDate = new Map<string, number>()
    for (const log of logs) {
      if (log.exercise !== exerciseName || log.value === null) continue
      const current = byDate.get(log.date) ?? 0
      if (log.value > current) byDate.set(log.date, log.value)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-limit)
      .map(([date, maxWeight]) => ({ date, maxWeight }))
  }, [logs])

  // Personal records per exercise
  const personalRecords = useMemo((): PersonalRecord[] => {
    const exercises = new Map<string, PersonalRecord>()

    for (const log of logs) {
      if (!exercises.has(log.exercise)) {
        exercises.set(log.exercise, {
          exercise: log.exercise,
          maxWeight: null,
          maxReps: null,
          maxVolume: null,
        })
      }
      const pr = exercises.get(log.exercise)!

      if (log.value !== null && (pr.maxWeight === null || log.value > pr.maxWeight.value)) {
        pr.maxWeight = { value: log.value, date: log.date }
      }
      if (pr.maxReps === null || log.reps > pr.maxReps.value) {
        pr.maxReps = { value: log.reps, date: log.date }
      }
      const volume = log.reps * (log.value ?? 0)
      if (volume > 0 && (pr.maxVolume === null || volume > pr.maxVolume.value)) {
        pr.maxVolume = { value: volume, date: log.date }
      }
    }

    return Array.from(exercises.values())
  }, [logs])

  // Unique exercise names
  const uniqueExercises = useMemo(() => {
    return [...new Set(logs.map((l) => l.exercise))]
  }, [logs])

  return {
    logs,
    isLoading,
    refresh,
    workoutDates,
    routineFrequency,
    exerciseHistory,
    personalRecords,
    uniqueExercises,
  }
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/data/useLogs.ts
git commit -m "feat: create useLogs hook with analytics derivations"
```

---

### Task 2: Calendar View

**Goal:** Build a compact monthly calendar grid showing gym attendance, with days colored when workouts were logged.

**Files:**
- Create: `src/ui/logs/CalendarView.tsx`
- Create: `src/ui/logs/CalendarToggle.tsx`

**Acceptance Criteria:**
- [ ] Renders a month grid with day numbers (Sun–Sat columns)
- [ ] Days with logged workouts are filled with purple (#6c63ff)
- [ ] Days without workouts are dark (#2a2a4a)
- [ ] Month/year header with left/right arrows to navigate months
- [ ] Current day has a subtle ring indicator
- [ ] "By Routine" toggle colors days by routine name (distinct colors per routine)
- [ ] Compiles without type errors

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create CalendarToggle.tsx**

```tsx
// src/ui/logs/CalendarToggle.tsx
export type CalendarColorMode = 'attendance' | 'routine'

interface CalendarToggleProps {
  mode: CalendarColorMode
  onToggle: (mode: CalendarColorMode) => void
}

export function CalendarToggle({ mode, onToggle }: CalendarToggleProps) {
  return (
    <div className="flex bg-[#1a1a2e] rounded-md p-0.5 text-[10px]">
      <button
        onClick={() => onToggle('attendance')}
        className={`px-3 py-1 rounded transition ${mode === 'attendance' ? 'bg-[#2a2a4a] text-white' : 'text-gray-500'}`}
      >
        Attendance
      </button>
      <button
        onClick={() => onToggle('routine')}
        className={`px-3 py-1 rounded transition ${mode === 'routine' ? 'bg-[#2a2a4a] text-white' : 'text-gray-500'}`}
      >
        By Routine
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create CalendarView.tsx**

```tsx
// src/ui/logs/CalendarView.tsx
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
              >
                {day}
              </div>
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
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/ui/logs/
git commit -m "feat: build calendar view with attendance and routine color modes"
```

---

### Task 3: Routine Balance Chart

**Goal:** Build a horizontal bar chart showing how often each routine was performed over a selectable time period (4/8/12 weeks), with imbalance warnings.

**Files:**
- Create: `src/ui/logs/RoutineBalance.tsx`

**Acceptance Criteria:**
- [ ] Horizontal bars showing count per routine over the selected period
- [ ] Period selector: 4w / 8w / 12w buttons
- [ ] Bars use routine colors (same as calendar)
- [ ] Routines below average frequency get a subtle warning indicator
- [ ] Uses Recharts BarChart
- [ ] Compiles without type errors

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create RoutineBalance.tsx**

```tsx
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
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/ui/logs/RoutineBalance.tsx
git commit -m "feat: build routine balance horizontal bar chart with period selector"
```

---

### Task 4: Exercise Progress Chart

**Goal:** Build a bar chart showing max weight per exercise over the last 10 workouts, with scrollable chip filters to toggle exercise visibility.

**Files:**
- Create: `src/ui/logs/ExerciseChipFilter.tsx`
- Create: `src/ui/logs/ExerciseProgressChart.tsx`

**Acceptance Criteria:**
- [ ] Scrollable horizontal row of exercise name chips
- [ ] Chips toggle on/off, multiple can be active, active chips are purple
- [ ] Bar chart shows max weight (Y axis) over workout dates (X axis)
- [ ] Each active exercise gets its own colored bars
- [ ] Last 10 workout dates by default
- [ ] Uses Recharts BarChart
- [ ] Compiles without type errors

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create ExerciseChipFilter.tsx**

```tsx
// src/ui/logs/ExerciseChipFilter.tsx
interface ExerciseChipFilterProps {
  exercises: string[]
  selected: Set<string>
  onToggle: (exercise: string) => void
}

export function ExerciseChipFilter({ exercises, selected, onToggle }: ExerciseChipFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
      {exercises.map((ex) => (
        <button key={ex} onClick={() => onToggle(ex)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
            selected.has(ex)
              ? 'bg-[#6c63ff] text-white'
              : 'bg-[#1a1a2e] text-gray-400'
          }`}>
          {ex}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create ExerciseProgressChart.tsx**

```tsx
// src/ui/logs/ExerciseProgressChart.tsx
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

    // Merge all dates
    const allDates = new Set<string>()
    histories.forEach((h) => h.points.forEach((p) => allDates.add(p.date)))
    const sortedDates = [...allDates].sort()

    const merged = sortedDates.map((date) => {
      const entry: Record<string, string | number> = { date: date.slice(5) } // MM-DD
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
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/ui/logs/ExerciseChipFilter.tsx src/ui/logs/ExerciseProgressChart.tsx
git commit -m "feat: build exercise progress bar chart with chip filters"
```

---

### Task 5: Personal Records

**Goal:** Show all-time personal records per exercise with badges for max weight, max reps, and max volume.

**Files:**
- Create: `src/ui/logs/PersonalRecords.tsx`

**Acceptance Criteria:**
- [ ] Lists each exercise with its PRs: max weight, max reps, max volume
- [ ] Each PR type has a distinct icon/badge
- [ ] Shows the date each PR was set
- [ ] Exercises sorted alphabetically
- [ ] Compiles without type errors

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create PersonalRecords.tsx**

```tsx
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
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/ui/logs/PersonalRecords.tsx
git commit -m "feat: build personal records display with PR badges"
```

---

### Task 6: Wire LogsTab into App

**Goal:** Create the LogsTab component that stacks all Logs sub-components vertically, and wire it into the main app replacing the placeholder.

**Files:**
- Create: `src/ui/logs/LogsTab.tsx`
- Modify: `src/App.tsx`

**Acceptance Criteria:**
- [ ] LogsTab renders: CalendarView → RoutineBalance → ExerciseProgressChart → PersonalRecords
- [ ] Each section has appropriate spacing
- [ ] useLogs hook provides data to all sub-components
- [ ] Shows loading state while data fetches
- [ ] Replaces the "Logs tab (coming in Phase 2)" placeholder in App.tsx
- [ ] Full app build succeeds

**Verify:** `npm run build` → build succeeds; `npx vitest run` → all tests pass

**Steps:**

- [ ] **Step 1: Create LogsTab.tsx**

```tsx
// src/ui/logs/LogsTab.tsx
import { useMemo } from 'react'
import { useLogs } from '../../data/useLogs'
import { useRoutines } from '../../data/useRoutines'
import { CalendarView } from './CalendarView'
import { RoutineBalance } from './RoutineBalance'
import { ExerciseProgressChart } from './ExerciseProgressChart'
import { PersonalRecords } from './PersonalRecords'

export function LogsTab() {
  const { isLoading, workoutDates, routineFrequency, exerciseHistory, personalRecords, uniqueExercises } = useLogs()
  const { allRows } = useRoutines(null)

  const allRoutines = useMemo(() => {
    return [...new Set(allRows.map((r) => r.routine))]
  }, [allRows])

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading logs...</div>
  }

  return (
    <div>
      <h1 className="text-[20px] font-bold mb-3">Logs</h1>
      <div className="space-y-3">
        <CalendarView workoutDates={workoutDates} allRoutines={allRoutines} />
        <RoutineBalance routineFrequency={routineFrequency} allRoutines={allRoutines} />
        <ExerciseProgressChart exerciseHistory={exerciseHistory} uniqueExercises={uniqueExercises} />
        <PersonalRecords records={personalRecords} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx**

Replace the logs placeholder in `src/App.tsx`:

```tsx
import { LogsTab } from './ui/logs/LogsTab'

// Replace:
//   {activeTab === 'logs' && <p className="text-gray-400">Logs tab (coming in Phase 2)</p>}
// With:
//   {activeTab === 'logs' && <LogsTab />}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run build
npx vitest run
git add src/ui/logs/LogsTab.tsx src/App.tsx
git commit -m "feat: wire LogsTab into app with all analytics sections"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Calendar view ✓ (monthly grid, color by attendance/routine)
   - Attendance & frequency insights ✓ (routine balance with 4/8/12w periods, imbalance warnings)
   - Exercise progress bar chart ✓ (chip filters, max weight, last 10 workouts)
   - Personal records ✓ (max weight, max reps, max volume per exercise)
   - Coach mode features (athlete filter, comparison, athlete stats cards) — deferred to Phase 3

2. **Placeholder scan:** No TBDs, TODOs, or placeholders. All code is complete.

3. **Type consistency:**
   - `ExerciseHistoryPoint` defined in useLogs.ts, used in ExerciseProgressChart.tsx
   - `PersonalRecord` defined in useLogs.ts, used in PersonalRecords.tsx
   - `workoutDates` returns Map<string, string[]> — used correctly in CalendarView
   - `routineFrequency(weeks)` returns Map<string, number> — used correctly in RoutineBalance
   - `exerciseHistory(name, limit)` returns ExerciseHistoryPoint[] — used correctly in ExerciseProgressChart
   - All function signatures match between hook and consumers
