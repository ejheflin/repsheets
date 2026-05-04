import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExerciseRow } from './ExerciseRow'
import { ExerciseHistorySheet } from './ExerciseHistorySheet'
import { SupersetGroup } from './SupersetGroup'
import { FinishWorkoutSheet } from './FinishWorkoutSheet'
import { RoutineUpdatePrompt } from './RoutineUpdatePrompt'
import { useWorkout } from '../../data/useWorkout'
import { useLogs } from '../../data/useLogs'
import { useSheetContext } from '../../data/useSheetContext'
import { useAuth } from '../../auth/useAuth'
import { listRepSheets } from '../../sheets/driveApi'
import { fetchLogEntriesWithRows, type IndexedLogEntry } from '../../sheets/sheetsApi'
import { estimateOneRepMax } from '../../workout/oneRepMax'
import { useExerciseSettings } from '../../data/useExerciseSettings'
import type { WorkoutExercise } from '../../types'

interface RecentSession {
  date: string
  athlete: string
  program: string
  routine: string
  exerciseCount: number
  entries: IndexedLogEntry[]
}

function formatSessionDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface WorkoutTabProps {
  onGoToRoutines: () => void
}

export function WorkoutTab({ onGoToRoutines }: WorkoutTabProps) {
  const {
    workout, toggleSet, toggleExercise, updateSet, updateAllSets, updateNotes,
    toggleExpanded, addSet, removeSet, reorderExercises, removeExercise, renameExercise, finishWorkout, discardWorkout, saveEditedWorkout, updateEditDate, loadPastWorkout,
  } = useWorkout()
  const { spreadsheetId } = useSheetContext()
  const { settings: exerciseSettings, saveSettings } = useExerciseSettings(spreadsheetId)
  const { user } = useAuth()
  const { myLogs, athleteName } = useLogs()
  const [showFinish, setShowFinish] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [routineUpdateExercises, setRoutineUpdateExercises] = useState<WorkoutExercise[] | null>(null)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [confirmEditSession, setConfirmEditSession] = useState<RecentSession | null>(null)
  const [sessionsFetchKey, setSessionsFetchKey] = useState(0)
  const [historyExercise, setHistoryExercise] = useState<WorkoutExercise | null>(null)
  const [deletingExerciseIdx, setDeletingExerciseIdx] = useState<number | null>(null)
  const [showPRCelebration, setShowPRCelebration] = useState(false)

  const prExerciseNames = useMemo(() => {
    if (!workout || workout.editMode) return new Set<string>()
    const prSet = new Set<string>()
    for (const ex of workout.exercises) {
      let historicalMax = 0
      for (const log of myLogs) {
        if (log.exercise === ex.exercise && log.value != null) {
          historicalMax = Math.max(historicalMax, log.value)
        }
      }
      if (historicalMax === 0) continue
      if (ex.sets.some((s) => s.value != null && s.value > historicalMax)) {
        prSet.add(ex.exercise)
      }
    }
    return prSet
  }, [workout, myLogs])

  const [newPRExercises, setNewPRExercises] = useState(new Set<string>())
  const prevPRNamesRef = useRef(new Set<string>())
  useEffect(() => {
    const prev = prevPRNamesRef.current
    const newOnes = new Set([...prExerciseNames].filter((n) => !prev.has(n)))
    prevPRNamesRef.current = new Set(prExerciseNames)
    if (newOnes.size === 0) return
    setNewPRExercises(newOnes)
    const t = setTimeout(() => setNewPRExercises(new Set()), 950)
    return () => clearTimeout(t)
  }, [prExerciseNames])

  const historyExerciseNames = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const entry of myLogs) {
      if (!seen.has(entry.exercise)) {
        seen.add(entry.exercise)
        names.push(entry.exercise)
      }
    }
    return names
  }, [myLogs])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 5 } })
  )

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !workout) return
    const exercises = workout.exercises
    const fromIdx = exercises.findIndex((ex) => ex.exercise === active.id)
    const toIdx = exercises.findIndex((ex) => ex.exercise === over.id)
    if (fromIdx !== -1 && toIdx !== -1) reorderExercises(fromIdx, toIdx)
  }, [workout, reorderExercises])

  const isEditMode = !!workout?.editMode

  const rawE1RMMap = useMemo(() => {
    const map = new Map<string, number | null>()
    if (!workout) return map
    for (const ex of workout.exercises) {
      if (ex.sets.some((s) => s.pct != null)) {
        const setToPct = new Map(ex.sets.map((s) => [s.setNumber, s.pct]))
        map.set(ex.exercise, estimateOneRepMax(myLogs, ex.exercise, athleteName ?? '', setToPct))
      }
    }
    return map
  }, [workout, myLogs, athleteName])

  const oneRepMaxMap = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const [exercise, raw] of rawE1RMMap) {
      const exSettings = exerciseSettings[exercise]
      const effective = exSettings?.oneRepMax ?? raw
      const tm = exSettings?.tm ?? 1.0
      map.set(exercise, effective != null ? effective * tm : null)
    }
    return map
  }, [rawE1RMMap, exerciseSettings])

  // Pre-fill target weights for pct-based sets that have no log history
  useEffect(() => {
    if (!workout || workout.editMode) return
    workout.exercises.forEach((ex, exIdx) => {
      const orm = oneRepMaxMap.get(ex.exercise)
      if (orm == null) return
      ex.sets.forEach((set, setIdx) => {
        if (set.pct != null && set.value === null) {
          updateSet(exIdx, setIdx, 'value', Math.round(set.pct * orm / 100 / 5) * 5)
        }
      })
    })
  }, [oneRepMaxMap]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!spreadsheetId || !user || !athleteName || !navigator.onLine) return
    fetchLogEntriesWithRows(spreadsheetId)
      .then((entries) => {
        const sessionMap = new Map<string, RecentSession>()
        for (const entry of entries) {
          if (entry.athlete !== athleteName) continue
          const key = `${entry.date}||${entry.program}||${entry.routine}`
          if (!sessionMap.has(key)) {
            sessionMap.set(key, { date: entry.date, athlete: athleteName, program: entry.program, routine: entry.routine, exerciseCount: 0, entries: [] })
          }
          const session = sessionMap.get(key)!
          session.entries.push(entry)
          session.exerciseCount = new Set(session.entries.map((e) => e.exercise)).size
        }
        const sorted = [...sessionMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
        setRecentSessions(sorted)
      })
      .catch(() => {})
  }, [spreadsheetId, user, athleteName, sessionsFetchKey])

  const handleEditSession = useCallback(async (session: RecentSession) => {
    await loadPastWorkout(session.entries, session.program, session.routine, session.athlete, session.date)
    setConfirmEditSession(null)
  }, [loadPastWorkout])

  const savedToast = showSavedToast && (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#22c55e] text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg pointer-events-none">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Workout saved
    </div>
  )

  if (!workout) {
    return (
      <>
        {savedToast}
        {showPRCelebration && <PRCelebrationImage onDismiss={() => setShowPRCelebration(false)} />}
        <div className="text-center mt-20">
          <p className="text-gray-400">No workout in progress.</p>
          <p className="text-gray-500 text-sm mt-2">Pick a <button onClick={onGoToRoutines} className="text-[#6c63ff] underline">routine</button> to get started.</p>
        </div>
        {recentSessions.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[13px] font-semibold text-gray-500 mb-3">Edit Recent Workouts</h2>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] text-gray-600 border-b border-white/10">
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Routine</th>
                  <th className="pb-2 font-normal text-right">Exercises</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr
                    key={`${s.date}||${s.routine}`}
                    onClick={() => setConfirmEditSession(s)}
                    className="border-b border-white/5 cursor-pointer active:bg-white/5"
                  >
                    <td className="py-3 text-[13px] text-gray-400">{formatSessionDate(s.date)}</td>
                    <td className="py-3 text-[13px] text-white">{s.routine}</td>
                    <td className="py-3 text-[13px] text-gray-500 text-right">{s.exerciseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {confirmEditSession && (
          <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setConfirmEditSession(null)}>
            <div className="w-full bg-[#2a2a4a] rounded-t-2xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-[17px] font-semibold mb-1">Edit this workout?</h2>
              <p className="text-[13px] text-gray-400 mb-6">
                This will overwrite your logged sets from{' '}
                <span className="text-white">{formatSessionDate(confirmEditSession.date)}</span>.
                This can't be undone.
              </p>
              <button
                onClick={() => handleEditSession(confirmEditSession)}
                className="w-full bg-[#6c63ff] rounded-[10px] py-3 font-semibold mb-3 active:opacity-80">
                Edit Workout
              </button>
              <button
                onClick={() => { setConfirmEditSession(null); onGoToRoutines() }}
                className="w-full text-gray-400 py-3 text-[15px] active:opacity-60">
                Log New Workout Instead
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  const allChecked = workout.exercises.every((ex) => ex.sets.every((s) => s.completed))

  const doFinish = async (logOnlyCompleted: boolean) => {
    const hasPR = prExerciseNames.size > 0
    const result = await finishWorkout(logOnlyCompleted)
    setShowFinish(false)
    if (result) {
      setSessionsFetchKey((k) => k + 1)
      if (hasPR) setShowPRCelebration(true)
      setShowSavedToast(true)
      setTimeout(() => setShowSavedToast(false), 2500)
    }
    if (result && result.exercisesWithAddedSets.length > 0 && spreadsheetId) {
      // Only prompt to update routine if the user owns the sheet
      try {
        const sheets = await listRepSheets()
        const activeSheet = sheets.find((s) => s.spreadsheetId === spreadsheetId)
        if (activeSheet?.isOwner) {
          setRoutineUpdateExercises(result.exercisesWithAddedSets)
        }
      } catch {
        // If we can't check, skip the prompt
      }
    }
  }

  const handleFinish = () => {
    if (allChecked) {
      doFinish(false)
    } else {
      setShowFinish(true)
    }
  }

  const handleDiscard = async () => {
    await discardWorkout()
    setShowDiscard(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    await saveEditedWorkout()
    setIsSaving(false)
    setSessionsFetchKey((k) => k + 1)
    setShowSavedToast(true)
    setTimeout(() => setShowSavedToast(false), 2500)
  }

  // Group consecutive exercises with the same supersetGroup
  const groups: { supersetGroup: string | null; exerciseIndices: number[] }[] = []
  workout.exercises.forEach((ex, idx) => {
    const last = groups[groups.length - 1]
    if (last && ex.supersetGroup && last.supersetGroup === ex.supersetGroup) {
      last.exerciseIndices.push(idx)
    } else {
      groups.push({ supersetGroup: ex.supersetGroup, exerciseIndices: [idx] })
    }
  })

  return (
    <div>
      {savedToast}
      <div className={`sticky top-0 z-20 bg-[#1a1a2e] -mx-4 transition-all duration-200 ${scrolled ? 'mb-1.5' : 'mb-2'}`}>
        <div className={`px-4 flex justify-between items-center ${scrolled ? 'pt-2 pb-1.5' : 'pt-1 pb-2'}`}>
          <div className="min-w-0">
            {!scrolled && !isEditMode && <div className="text-[11px] text-gray-500">{workout.program}</div>}
            <h1 className={`font-bold truncate transition-all duration-200 ${scrolled ? 'text-[15px]' : 'text-[20px]'}`}>{workout.routine}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowDiscard(true)}
              className={`rounded-md bg-[#2a2a4a] text-red-400 flex items-center justify-center transition-all duration-200 ${scrolled ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'}`}>
              ✕
            </button>
            {isEditMode ? (
              <button onClick={handleSave} disabled={isSaving}
                className={`bg-[#6c63ff] rounded-md font-semibold transition-all duration-200 ${scrolled ? 'px-3 py-1.5 text-xs h-8' : 'px-4 py-2 text-sm h-9'}`}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            ) : (
              <button data-tour="finish-button" onClick={handleFinish}
                className={`bg-[#6c63ff] rounded-md font-semibold transition-all duration-200 ${scrolled ? 'px-3 py-1.5 text-xs h-8' : 'px-4 py-2 text-sm h-9'}`}>
                Finish
              </button>
            )}
          </div>
        </div>
        {isEditMode && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-400/10 border-b border-amber-400/20">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-[12px] text-amber-400 font-medium">Editing · </span>
            <label className="text-[12px] text-amber-400 font-medium underline underline-offset-2 cursor-pointer">
              {workout.editMode!.editDate}
              <input
                type="date"
                value={workout.editMode!.editDate}
                onChange={(e) => updateEditDate(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>
        )}
      </div>

      <DndContext sensors={isEditMode ? [] : sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={workout.exercises.map((ex) => ex.exercise)} strategy={verticalListSortingStrategy}>
          {groups.map((group, gIdx) => {
            const content = group.exerciseIndices.map((exIdx) => {
              const ex = workout.exercises[exIdx]
              return (
                <SortableExerciseRow
                  key={ex.exercise}
                  ex={ex}
                  historyExercises={historyExerciseNames.filter((n) => n !== ex.exercise)}
                  isPR={prExerciseNames.has(ex.exercise)}
                  isNewPR={newPRExercises.has(ex.exercise)}
                  isDeleting={deletingExerciseIdx === exIdx}
                  isEditMode={isEditMode}
                  oneRepMax={oneRepMaxMap.get(ex.exercise) ?? null}
                  calculatedE1RM={rawE1RMMap.get(ex.exercise) ?? null}
                  exerciseSettings={exerciseSettings[ex.exercise] ?? {}}
                  onSaveSettings={(s) => saveSettings(ex.exercise, s)}
                  onToggleExpand={() => toggleExpanded(exIdx)}
                  onToggleExercise={() => toggleExercise(exIdx)}
                  onToggleSet={(setIdx) => toggleSet(exIdx, setIdx)}
                  onUpdateSet={(setIdx, field, val) => updateSet(exIdx, setIdx, field, val)}
                  onUpdateAllSets={(field, val) => updateAllSets(exIdx, field, val)}
                  onUpdateNotes={(notes) => updateNotes(exIdx, notes)}
                  onAddSet={() => addSet(exIdx)}
                  onShowHistory={() => setHistoryExercise(ex)}
                  onStartDelete={() => setDeletingExerciseIdx(exIdx)}
                  onDeleteDone={() => { removeExercise(exIdx); setDeletingExerciseIdx(null) }}
                  onRenameExercise={(name) => renameExercise(exIdx, name)}
                  onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
                  tourId={exIdx === 0 ? 'first-exercise' : undefined}
                />
              )
            })
            return group.supersetGroup ? (
              <SupersetGroup key={gIdx}>{content}</SupersetGroup>
            ) : (
              <div key={gIdx}>{content}</div>
            )
          })}
        </SortableContext>
      </DndContext>

      {showFinish && (
        <FinishWorkoutSheet
          uncheckedCount={workout.exercises.filter((ex) => !ex.sets.every((s) => s.completed)).length}
          onLogCompleted={() => doFinish(true)}
          onCompleteAll={() => doFinish(false)}
          onCancel={() => setShowFinish(false)} />
      )}

      {routineUpdateExercises && (
        <RoutineUpdatePrompt
          exercises={routineUpdateExercises}
          onUpdate={() => setRoutineUpdateExercises(null)}
          onDismiss={() => setRoutineUpdateExercises(null)} />
      )}

      {historyExercise && workout && (
        <ExerciseHistorySheet
          exercise={historyExercise}
          logs={myLogs}
          program={workout.program}
          e1rm={rawE1RMMap.get(historyExercise.exercise) ?? null}
          onClose={() => setHistoryExercise(null)} />
      )}

      {showDiscard && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
            <p className="text-center font-bold mb-1">{isEditMode ? 'Discard Changes?' : 'Discard Workout?'}</p>
            <p className="text-center text-gray-400 text-sm mb-4">{isEditMode ? 'Your edits will not be saved.' : 'Your progress will be lost.'}</p>
            <button onClick={handleDiscard}
              className="w-full bg-red-500 rounded-[10px] p-3 text-center font-semibold mb-2">Discard</button>
            <button onClick={() => setShowDiscard(false)}
              className="w-full p-3 text-center text-gray-400 font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

interface SortableExerciseRowProps {
  ex: WorkoutExercise
  historyExercises: string[]
  isPR: boolean
  isNewPR: boolean
  isDeleting: boolean
  isEditMode: boolean
  oneRepMax: number | null
  calculatedE1RM: number | null
  exerciseSettings: import('../../types').ExerciseSettings
  onSaveSettings: (s: import('../../types').ExerciseSettings) => void
  onToggleExpand: () => void
  onToggleExercise: () => void
  onToggleSet: (setIdx: number) => void
  onUpdateSet: (setIdx: number, field: 'reps' | 'value', val: number | null) => void
  onUpdateAllSets: (field: 'reps' | 'value', val: number | null) => void
  onUpdateNotes: (notes: string) => void
  onAddSet: () => void
  onShowHistory: () => void
  onStartDelete: () => void
  onDeleteDone: () => void
  onRenameExercise: (name: string) => void
  onRemoveSet: (setIdx: number) => void
  tourId?: string
}

function SortableExerciseRow({
  ex, historyExercises, isPR, isNewPR, isDeleting, isEditMode,
  oneRepMax, calculatedE1RM, exerciseSettings,
  onSaveSettings, onToggleExpand, onToggleExercise, onToggleSet,
  onUpdateSet, onUpdateAllSets, onUpdateNotes, onAddSet, onShowHistory,
  onStartDelete, onDeleteDone, onRenameExercise, onRemoveSet, tourId,
}: SortableExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.exercise })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDeleting
          ? 'max-height 0.25s ease, opacity 0.15s ease'
          : isDragging ? 'none' : transition ?? undefined,
        maxHeight: isDeleting ? 0 : undefined,
        opacity: isDeleting ? 0 : 1,
        overflow: isDeleting ? 'hidden' : 'visible',
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName === 'max-height' && isDeleting) onDeleteDone()
      }}
    >
      <div
        style={{
          animation: isNewPR && !isDragging ? 'prLift 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards' : undefined,
          position: 'relative',
          zIndex: isNewPR ? 5 : undefined,
        }}
      >
        {isNewPR && !isDragging && [0, 0.18, 0.36].map((delay, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              borderRadius: '50%',
              border: `2px solid ${['#6c63ff', '#9d97ff', '#c8c5ff'][i]}`,
              animationName: 'prRipple',
              animationDuration: '0.9s',
              animationDelay: `${delay}s`,
              animationTimingFunction: 'ease-out',
              animationFillMode: 'forwards',
              pointerEvents: 'none',
              zIndex: -1,
            }}
          />
        ))}
      <ExerciseRow
        exercise={ex}
        isPR={isPR}
        oneRepMax={oneRepMax}
        calculatedE1RM={calculatedE1RM}
        exerciseSettings={exerciseSettings}
        onSaveSettings={onSaveSettings}
        onToggleExpand={onToggleExpand}
        onToggleExercise={onToggleExercise}
        onToggleSet={onToggleSet}
        onUpdateSet={onUpdateSet}
        onUpdateAllSets={onUpdateAllSets}
        onUpdateNotes={onUpdateNotes}
        onAddSet={isEditMode ? undefined : onAddSet}
        onShowHistory={onShowHistory}
        onRemoveExercise={onStartDelete}
        onRenameExercise={onRenameExercise}
        onRemoveSet={onRemoveSet}
        historyExercises={historyExercises}
        dragHandleListeners={isEditMode ? undefined : listeners}
        dragAttributes={isEditMode ? undefined : attributes}
        isDragging={isDragging}
        tourId={tourId}
      />
      </div>
    </div>
  )
}

function PRCelebrationImage({ onDismiss }: { onDismiss: () => void }) {
  const [entered, setEntered] = useState(false)
  const [bubbleVisible, setBubbleVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setEntered(true), 10)
    const t2 = setTimeout(() => setBubbleVisible(true), 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    let dismissed = false
    const dismiss = () => {
      if (dismissed) return
      dismissed = true
      onDismiss()
    }
    document.addEventListener('touchstart', dismiss, { passive: true })
    document.addEventListener('click', dismiss)
    return () => {
      document.removeEventListener('touchstart', dismiss)
      document.removeEventListener('click', dismiss)
    }
  }, [onDismiss])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 0,
        width: 220,
        zIndex: 40,
        pointerEvents: 'none',
        transform: entered ? 'translateX(0)' : 'translateX(-110%)',
        transition: entered ? 'transform 1.5s ease-out' : 'none',
      }}
    >
      {/* Speech bubble — appears in place after slide-in completes */}
      <div style={{
        position: 'absolute',
        top: 120,
        left: 73,
        background: 'white',
        borderRadius: 10,
        padding: '6px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        opacity: bubbleVisible ? 1 : 0,
        transition: bubbleVisible ? 'opacity 0.2s ease' : 'none',
      }}>
        {/* tail at top-left corner pointing upper-left toward character */}
        <div style={{
          position: 'absolute',
          top: -5,
          left: 0,
          width: 0,
          height: 0,
          borderBottom: '12px solid white',
          borderRight: '12px solid transparent',
        }} />
        <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1a2e', letterSpacing: '0.02em', display: 'block', whiteSpace: 'nowrap' }}>I SAW</span>
        <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1a2e', letterSpacing: '0.02em', display: 'block', whiteSpace: 'nowrap' }}>THAT</span>
        <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1a2e', letterSpacing: '0.02em', display: 'block', whiteSpace: 'nowrap' }}>PR</span>
      </div>
      <img
        src="/ISawThatPR.webp"
        alt=""
        draggable={false}
        style={{ width: '100%', display: 'block' }}
      />
    </div>
  )
}
