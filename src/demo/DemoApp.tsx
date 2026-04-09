import { useState, useMemo, useCallback, useRef } from 'react'
import { Layout } from '../ui/Layout'
import { CalendarView } from '../ui/logs/CalendarView'
import { ExerciseProgressChart } from '../ui/logs/ExerciseProgressChart'
import { PersonalRecords } from '../ui/logs/PersonalRecords'
import { ExerciseRow } from '../ui/workout/ExerciseRow'
import { FinishWorkoutSheet } from '../ui/workout/FinishWorkoutSheet'
import { ProgramSelector } from '../ui/routines/ProgramSelector'
import { DEMO_ROUTINES, DEMO_LOGS } from './demoData'
import { useDemo } from './DemoProvider'
import { expandRoutine } from '../workout/setInference'
import { resolveSetValues } from '../workout/autofill'
import type { WorkoutExercise, WorkoutState } from '../types'
import type { ExerciseHistoryPoint, PersonalRecord } from '../data/useLogs'
import type { TabId } from '../ui/BottomNav'

export function DemoApp() {
  const { exitDemo } = useDemo()
  const [workout, setWorkout] = useState<WorkoutState | null>(null)
  const [showFinish, setShowFinish] = useState(false)
  const setTabRef = useRef<((tab: TabId) => void) | null>(null)

  const programs = useMemo(() => [...new Set(DEMO_ROUTINES.map((r) => r.program))], [])
  const [selectedProgram, setSelectedProgram] = useState(programs[0] || '')

  const routineNames = useMemo(() => {
    return [...new Set(DEMO_ROUTINES.filter((r) => r.program === selectedProgram).map((r) => r.routine))]
  }, [selectedProgram])

  const startWorkout = useCallback((routineName: string) => {
    const rows = DEMO_ROUTINES.filter((r) => r.program === selectedProgram && r.routine === routineName)
    const expanded = expandRoutine(rows)
    const exerciseNames: string[] = []
    for (const s of expanded) {
      if (!exerciseNames.includes(s.exercise)) exerciseNames.push(s.exercise)
    }
    const exercises: WorkoutExercise[] = exerciseNames.map((name) => {
      const sets = expanded.filter((s) => s.exercise === name)
      const firstSet = sets[0]
      return {
        exercise: name,
        notes: firstSet?.notes ?? '',
        userNotes: '',
        supersetGroup: firstSet?.supersetGroup ?? null,
        isExpanded: false,
        sets: sets.map((s) => {
          const resolved = resolveSetValues(s, DEMO_LOGS, selectedProgram, routineName, 'Demo U')
          return {
            setNumber: s.setNumber,
            reps: resolved.reps,
            value: resolved.value,
            unit: s.unit,
            completed: false,
            isAdded: false,
          }
        }),
      }
    })
    setWorkout({ program: selectedProgram, routine: routineName, exercises, startedAt: new Date().toISOString() })
    setTabRef.current?.('workout')
  }, [selectedProgram])

  // Workout mutations
  const toggleExpanded = (i: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[i].isExpanded = !next.exercises[i].isExpanded
      return next
    })
  }
  const toggleExercise = (i: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const all = next.exercises[i].sets.every((s) => s.completed)
      next.exercises[i].sets.forEach((s) => { s.completed = !all })
      return next
    })
  }
  const toggleSet = (ei: number, si: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[ei].sets[si].completed = !next.exercises[ei].sets[si].completed
      return next
    })
  }
  const updateSet = (ei: number, si: number, field: 'reps' | 'value', val: number | null) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[ei].sets[si][field] = val
      return next
    })
  }
  const updateAllSets = (ei: number, field: 'reps' | 'value', val: number | null) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[ei].sets.forEach((s) => { s[field] = val })
      return next
    })
  }
  const addSet = (ei: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const ex = next.exercises[ei]
      const last = ex.sets[ex.sets.length - 1]
      ex.sets.push({ setNumber: last.setNumber + 1, reps: last.reps, value: last.value, unit: last.unit, completed: false, isAdded: true })
      return next
    })
  }

  // Logs data
  const workoutDates = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const log of DEMO_LOGS) {
      if (!map.has(log.date)) map.set(log.date, [])
      const routines = map.get(log.date)!
      if (!routines.includes(log.routine)) routines.push(log.routine)
    }
    return map
  }, [])

  const uniqueExercises = useMemo(() => [...new Set(DEMO_LOGS.map((l) => l.exercise))], [])
  const allRoutines = useMemo(() => [...new Set(DEMO_ROUTINES.map((r) => r.routine))], [])

  const exerciseHistory = useCallback((name: string, limit: number = 10): ExerciseHistoryPoint[] => {
    const byDate = new Map<string, number>()
    for (const log of DEMO_LOGS) {
      if (log.exercise !== name || log.value === null) continue
      const current = byDate.get(log.date) ?? 0
      if (log.value > current) byDate.set(log.date, log.value)
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-limit).map(([date, maxWeight]) => ({ date, maxWeight }))
  }, [])

  const personalRecords = useMemo((): PersonalRecord[] => {
    const exercises = new Map<string, PersonalRecord>()
    for (const log of DEMO_LOGS) {
      if (!exercises.has(log.exercise)) exercises.set(log.exercise, { exercise: log.exercise, maxWeight: null, maxReps: null, maxVolume: null })
      const pr = exercises.get(log.exercise)!
      if (log.value !== null && (pr.maxWeight === null || log.value > pr.maxWeight.value)) pr.maxWeight = { value: log.value, date: log.date }
      if (pr.maxReps === null || log.reps > pr.maxReps.value) pr.maxReps = { value: log.reps, date: log.date }
      const vol = log.reps * (log.value ?? 0)
      if (vol > 0 && (pr.maxVolume === null || vol > pr.maxVolume.value)) pr.maxVolume = { value: vol, date: log.date }
    }
    return Array.from(exercises.values())
  }, [])

  const programExercises = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of DEMO_ROUTINES) {
      if (!map.has(r.program)) map.set(r.program, [])
      const exs = map.get(r.program)!
      if (!exs.includes(r.exercise)) exs.push(r.exercise)
    }
    return map
  }, [])

  return (
    <Layout>
      {(activeTab, setActiveTab) => {
        setTabRef.current = setActiveTab
        return (
          <>
            {activeTab === 'routines' && (
              <div>
                <div className="bg-[#2a2a4a] rounded-[10px] p-3 mb-4 text-center">
                  <p className="text-xs text-[#6c63ff] font-semibold">Demo Mode</p>
                  <p className="text-[10px] text-gray-400 mt-1">Exploring with sample data. Nothing is saved.</p>
                  <button onClick={exitDemo}
                    className="mt-2 text-[11px] text-gray-500 underline">Sign in with Google to get started</button>
                </div>

                {programs.length > 1 && (
                  <div className="mb-4">
                    <ProgramSelector programs={programs} selected={selectedProgram} onSelect={setSelectedProgram} />
                  </div>
                )}

                <h1 className="text-[20px] font-bold mb-3">Routines</h1>
                {routineNames.map((name) => {
                  const exercises = [...new Set(DEMO_ROUTINES.filter((r) => r.routine === name).map((r) => r.exercise))]
                  return (
                    <button key={name} onClick={() => startWorkout(name)}
                      className="w-full bg-[#2a2a4a] rounded-[10px] p-3.5 mb-2 text-left active:opacity-80 transition">
                      <div className="font-semibold text-[15px]">{name}</div>
                      <div className="text-[12px] text-gray-500 mt-1">{exercises.join(', ')}</div>
                    </button>
                  )
                })}
              </div>
            )}

            {activeTab === 'workout' && (
              <div>
                {!workout ? (
                  <div className="text-center mt-20">
                    <p className="text-gray-400">No workout in progress.</p>
                    <p className="text-gray-500 text-sm mt-2">Pick a <button onClick={() => setActiveTab('routines')} className="text-[#6c63ff] underline">routine</button> to get started.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="text-[11px] text-gray-500">{workout.program}</div>
                        <h1 className="text-[20px] font-bold">{workout.routine}</h1>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setWorkout(null) }}
                          className="w-9 h-9 rounded-md bg-[#2a2a4a] text-red-400 flex items-center justify-center text-sm">
                          ✕
                        </button>
                        <button onClick={() => {
                          const allChecked = workout.exercises.every((ex) => ex.sets.every((s) => s.completed))
                          if (allChecked) { setWorkout(null); setActiveTab('routines') }
                          else setShowFinish(true)
                        }}
                          className="bg-[#6c63ff] rounded-md px-4 py-2 text-sm font-semibold h-9">
                          Finish
                        </button>
                      </div>
                    </div>
                    {workout.exercises.map((ex, i) => (
                      <ExerciseRow key={i} exercise={ex}
                        onToggleExpand={() => toggleExpanded(i)}
                        onToggleExercise={() => toggleExercise(i)}
                        onToggleSet={(si) => toggleSet(i, si)}
                        onUpdateSet={(si, f, v) => updateSet(i, si, f, v)}
                        onUpdateAllSets={(f, v) => updateAllSets(i, f, v)}
                        onUpdateNotes={() => {}}
                        onAddSet={() => addSet(i)} />
                    ))}
                    {showFinish && (
                      <FinishWorkoutSheet
                        uncheckedCount={workout.exercises.filter((ex) => !ex.sets.every((s) => s.completed)).length}
                        onLogCompleted={() => { setShowFinish(false); setWorkout(null); setActiveTab('routines') }}
                        onCompleteAll={() => { setShowFinish(false); setWorkout(null); setActiveTab('routines') }}
                        onCancel={() => setShowFinish(false)} />
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div>
                <h1 className="text-[20px] font-bold mb-3">Logs</h1>
                <div className="space-y-3">
                  <CalendarView workoutDates={workoutDates} allRoutines={allRoutines} />
                  <ExerciseProgressChart exerciseHistory={exerciseHistory} uniqueExercises={uniqueExercises} programs={programs} programExercises={programExercises} />
                  <PersonalRecords records={personalRecords} />
                </div>
              </div>
            )}
          </>
        )
      }}
    </Layout>
  )
}
