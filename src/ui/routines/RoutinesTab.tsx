import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { ProgramSelector } from './ProgramSelector'
import { ProgramActions } from './ProgramActions'
import { NamePromptModal } from './NamePromptModal'
import { ExpandableRoutineCard, DraftRoutineCard, type CardRegistration } from './ExpandableRoutineCard'
import { SwipeableRow } from '../shared/SwipeableRow'
import { useUndoToast, UndoToast } from '../shared/UndoToast'
import { renameProgram, deleteProgram, deleteRoutineRows, appendRoutineRows } from '../../sheets/driveApi'
import { useRoutines } from '../../data/useRoutines'
import { useLogs } from '../../data/useLogs'
import { useExerciseSettings } from '../../data/useExerciseSettings'
import { estimateOneRepMax } from '../../workout/oneRepMax'
import { useWorkout } from '../../data/useWorkout'
import { useAuth } from '../../auth/useAuth'
import { AuthExpiredError } from '../../auth/authFetch'
import { getPreference, setPreference } from '../../data/db'
import { useSheetContext } from '../../data/useSheetContext'
import { SheetSwitcherModal } from '../SheetSwitcherModal'
import { ShareCopyModal } from '../sharing/ShareModal'
import type { RoutineRow, EditableExercise } from '../../types'

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function RoutineTrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

function DuplicateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function SheetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

interface RoutinesTabProps {
  onStartWorkout: () => void
}

export function RoutinesTab({ onStartWorkout }: RoutinesTabProps) {
  const [selectedProgram, setSelectedProgramState] = useState<string>('')
  const [savedProgram, setSavedProgram] = useState<string | null>(null)
  const [prefLoaded, setPrefLoaded] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftName, setDraftName] = useState('New Routine')
  const [draftSaved, setDraftSaved] = useState(false)
  const [justCreatedName, setJustCreatedName] = useState<string | null>(null)
  const [draftProgram, setDraftProgram] = useState<string | null>(null)
  const [unitSystem, setUnitSystemState] = useState<'imperial' | 'metric'>('imperial')
  const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs'

  const setUnitSystem = useCallback((sys: 'imperial' | 'metric') => {
    setUnitSystemState(sys)
    setPreference('unitSystem', sys)
  }, [])

  const setSelectedProgram = useCallback((program: string) => {
    setSelectedProgramState(program)
    setPreference('activeProgram', program)
  }, [])
  const { routineList, programs, isLoading, refresh, mutateCache, allRows } = useRoutines(selectedProgram || null)
  const { allLogs, myLogs, athleteName } = useLogs()
  const loggedExercises = useMemo(() => [...new Set(allLogs.map((l) => l.exercise))].filter(Boolean), [allLogs])
  const { workout, startWorkout, discardWorkout } = useWorkout()
  const { spreadsheetId } = useSheetContext()
  const { settings: exerciseSettings } = useExerciseSettings(spreadsheetId)

  const maxCache = useMemo(
    () => new Map<string, { e1rm: number | null; tm: number | null }>(),
    [exerciseSettings, myLogs, athleteName],
  )
  const getMax = useCallback((name: string): { e1rm: number | null; tm: number | null } => {
    const cached = maxCache.get(name)
    if (cached) return cached
    const exSettings = exerciseSettings[name]
    const e1rm = exSettings?.oneRepMax ?? estimateOneRepMax(myLogs, name, athleteName ?? '', new Map())
    const tm = exSettings?.tm ?? null
    const result = { e1rm, tm }
    maxCache.set(name, result)
    return result
  }, [maxCache, exerciseSettings, myLogs, athleteName])
  const { login } = useAuth()
  const [showSheetSwitcher, setShowSheetSwitcher] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState<{
    program: string; routine: string; rows: RoutineRow[]
  } | null>(null)
  const [programModal, setProgramModal] = useState<'new' | 'rename' | null>(null)
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState(false)
  const routineUndo = useUndoToast()

  // Load saved preference once on mount
  useEffect(() => {
    getPreference('activeProgram').then((saved) => {
      setSavedProgram(saved ?? null)
      setPrefLoaded(true)
    })
    getPreference('unitSystem').then((u) => {
      if (u === 'metric' || u === 'imperial') setUnitSystemState(u)
    })
  }, [])

  // Once both preference and programs are available, reconcile
  useEffect(() => {
    if (draftProgram) return // keep the draft program selected until it's saved
    if (!prefLoaded || programs.length === 0) return
    if (selectedProgram && programs.includes(selectedProgram)) return

    if (savedProgram && programs.includes(savedProgram)) {
      setSelectedProgramState(savedProgram)
    } else {
      setSelectedProgram(programs[0])
    }
  }, [draftProgram, prefLoaded, programs, savedProgram, selectedProgram, setSelectedProgram])

  // Once the draft program has rows on the sheet, it's real — clear the draft.
  useEffect(() => {
    if (draftProgram && programs.includes(draftProgram)) setDraftProgram(null)
  }, [draftProgram, programs])

  // Graduate the draft routine once ITS OWN save landed in routineList.
  // Gating on draftSaved matters: matching by name alone graduated the draft
  // the instant its name collided with a pre-existing routine — silently
  // discarding the draft mid-typing (and previously wiping that routine).
  useEffect(() => {
    if (!hasDraft || !draftSaved) return
    const key = draftName.trim().toLowerCase()
    if (!key) return
    if (routineList.some((r) => r.name.trim().toLowerCase() === key)) {
      setJustCreatedName(draftName)
      setHasDraft(false)
      setDraftSaved(false)
    }
  }, [hasDraft, draftSaved, draftName, routineList])

  // initialExpanded is consumed once on the real card's mount; release the flag on
  // the next tick so it doesn't keep force-expanding that routine on later renders.
  useEffect(() => {
    if (!justCreatedName) return
    if (routineList.some((r) => r.name.trim().toLowerCase() === justCreatedName.trim().toLowerCase())) {
      setJustCreatedName(null)
    }
  }, [justCreatedName, routineList])

  const handleStartWorkout = (rows: RoutineRow[]) => {
    const program = rows[0]?.program ?? selectedProgram
    const routineName = rows[0]?.routine ?? ''
    if (workout) {
      setConfirmDiscard({ program, routine: routineName, rows })
      return
    }
    startWorkout(program, routineName, rows)
    onStartWorkout()
  }

  const handleConfirmDiscard = async () => {
    if (!confirmDiscard) return
    await discardWorkout()
    await startWorkout(confirmDiscard.program, confirmDiscard.routine, confirmDiscard.rows)
    setConfirmDiscard(null)
    onStartWorkout()
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } catch (e) {
      if (e instanceof AuthExpiredError) login()
    }
    setIsRefreshing(false)
  }

  const handleDraftSaved = useCallback(() => {
    setDraftSaved(true)
    refresh().catch(() => {})
  }, [refresh])

  const displayPrograms = useMemo(() => {
    if (draftProgram && !programs.includes(draftProgram)) return [...programs, draftProgram]
    return programs
  }, [programs, draftProgram])

  // A draft program (selected, not yet on the sheet) cannot be renamed/deleted on the server.
  const isDraftSelected = !!draftProgram && selectedProgram === draftProgram
  const canModifyProgram = !!selectedProgram

  const handleNewProgram = (name: string) => {
    setProgramModal(null)
    if (!name) return
    setDraftProgram(name)
    setSelectedProgram(name)
    setHasDraft(false)
  }

  const handleRenameProgram = async (name: string) => {
    setProgramModal(null)
    const current = selectedProgram
    if (!name || !current || name === current) return
    if (isDraftSelected) {
      setDraftProgram(name)
      setSelectedProgram(name)
      return
    }
    if (!spreadsheetId) return
    try {
      await renameProgram(spreadsheetId, current, name)
      await refresh()
      setSelectedProgram(name)
    } catch (e) {
      if (e instanceof AuthExpiredError) login()
    }
  }

  const handleDeleteProgram = async () => {
    setConfirmDeleteProgram(false)
    const current = selectedProgram
    if (!current) return
    if (isDraftSelected) {
      setDraftProgram(null)
      setHasDraft(false)
      const next = programs.find((p) => p !== current)
      if (next) setSelectedProgram(next)
      else setSelectedProgramState('')
      return
    }
    if (!spreadsheetId) return
    try {
      await deleteProgram(spreadsheetId, current)
      await refresh()
      const remaining = programs.filter((p) => p !== current)
      if (remaining.length > 0) setSelectedProgram(remaining[0])
      else setSelectedProgramState('')
    } catch (e) {
      if (e instanceof AuthExpiredError) login()
    }
  }

  const handleDeleteRoutine = useCallback((routineName: string, rows: RoutineRow[]) => {
    if (!spreadsheetId) return
    const program = rows[0]?.program ?? selectedProgram
    mutateCache(allRows.filter((r) => !(r.program === program && r.routine === routineName)))
    deleteRoutineRows(spreadsheetId, program, routineName)
      .then(() => refresh())
      .catch((e) => { if (e instanceof AuthExpiredError) login() })
    routineUndo.show('Routine deleted', () => {
      appendRoutineRows(spreadsheetId, rows)
        .then(() => refresh())
        .catch((e) => { if (e instanceof AuthExpiredError) login() })
    })
  }, [spreadsheetId, selectedProgram, allRows, mutateCache, refresh, routineUndo, login])

  const handleDuplicateRoutine = useCallback((routineName: string, rows: RoutineRow[]) => {
    if (!spreadsheetId || rows.length === 0) return
    const existing = new Set(routineList.map((r) => r.name.toLowerCase()))
    const base = `${routineName} (copy)`
    let name = base
    let n = 2
    while (existing.has(name.toLowerCase())) name = `${base} ${n++}`
    const newRows = rows.map((r) => ({ ...r, routine: name }))
    mutateCache([...allRows, ...newRows]) // optimistic — appears at the bottom
    appendRoutineRows(spreadsheetId, newRows)
      .then(() => refresh())
      .catch((e) => { if (e instanceof AuthExpiredError) login() })
  }, [spreadsheetId, routineList, allRows, mutateCache, refresh, login])

  // ─── Cross-routine drag: a single DndContext spans every card so an exercise can
  // be dragged from one routine into another. Each card registers a live handle. ───
  const cardRegistry = useRef(new Map<string, CardRegistration>())
  const registerCard = useCallback((id: string, api: CardRegistration) => {
    cardRegistry.current.set(id, api)
  }, [])
  const unregisterCard = useCallback((id: string) => {
    cardRegistry.current.delete(id)
  }, [])

  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // 600ms press before a reorder starts — 400 fired during ordinary
    // taps-and-thinks; tolerance lets a deliberate hold wobble a little
    useSensor(TouchSensor, { activationConstraint: { delay: 600, tolerance: 8 } }),
  )
  const [activeDrag, setActiveDrag] = useState<{ exercise: EditableExercise; width: number | null } | null>(null)
  const [overCardId, setOverCardId] = useState<string | null>(null)
  const [sourceCardId, setSourceCardId] = useState<string | null>(null)

  const findCardEntry = useCallback((itemId: string): [string, CardRegistration] | undefined => {
    for (const [id, api] of cardRegistry.current) {
      if (api.getExercises().some((e) => e.id === itemId)) return [id, api]
    }
    return undefined
  }, [])

  const resolveOverCard = useCallback((overId: string | null): string | null => {
    if (!overId) return null
    if (cardRegistry.current.has(overId)) return overId
    return findCardEntry(overId)?.[0] ?? null
  }, [findCardEntry])

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id)
    const entry = findCardEntry(id)
    setSourceCardId(entry?.[0] ?? null)
    const exercise = entry?.[1].getExercises().find((x) => x.id === id) ?? null
    setActiveDrag(exercise ? { exercise, width: e.active.rect.current.initial?.width ?? null } : null)
  }, [findCardEntry])

  const handleDragOver = useCallback((e: DragOverEvent) => {
    setOverCardId(resolveOverCard(e.over ? String(e.over.id) : null))
  }, [resolveOverCard])

  const resetDrag = useCallback(() => {
    setActiveDrag(null)
    setOverCardId(null)
    setSourceCardId(null)
  }, [])

  // While dragging, the original pointer would otherwise keep interacting
  // with content under the overlay — selecting text and sweeping across
  // inputs. Suppress selection globally and drop focus for the duration.
  useEffect(() => {
    if (!activeDrag) return
    const body = document.body as HTMLElement & { style: CSSStyleDeclaration & { webkitUserSelect?: string } }
    const prevSelect = body.style.userSelect
    const prevWebkit = body.style.webkitUserSelect
    body.style.userSelect = 'none'
    body.style.webkitUserSelect = 'none'
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    return () => {
      body.style.userSelect = prevSelect
      body.style.webkitUserSelect = prevWebkit ?? ''
    }
  }, [activeDrag])

  const handleExerciseDragEnd = useCallback((e: DragEndEvent) => {
    resetDrag()
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const srcEntry = findCardEntry(activeId)
    if (!srcEntry) return
    const src = srcEntry[1]
    const fromIdx = src.getExercises().findIndex((x) => x.id === activeId)
    if (fromIdx < 0) return

    // over.id is either a card container id (drop into the card) or an exercise id.
    const destId = cardRegistry.current.has(overId) ? overId : findCardEntry(overId)?.[0]
    if (!destId) return
    const dest = cardRegistry.current.get(destId)!
    let toIdx = overId === destId
      ? dest.getExercises().length                            // dropped on the card itself
      : dest.getExercises().findIndex((x) => x.id === overId) // dropped on an exercise
    if (toIdx < 0) toIdx = dest.getExercises().length

    if (src === dest) {
      if (fromIdx !== toIdx) src.act({ type: 'reorder', from: fromIdx, to: toIdx })
      return
    }
    // Clear superset grouping on the way over — a stray group letter would otherwise
    // bracket the moved exercise with an unrelated one in the target card.
    const exercise: EditableExercise = { ...src.getExercises()[fromIdx], supersetGroup: null }
    src.act({ type: 'removeExercise', ex: fromIdx })
    dest.act({ type: 'insertExercise', index: toIdx, exercise })
  }, [findCardEntry, resetDrag])

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading routines...</div>
  }

  return (
    <div>
      <div className="flex items-stretch gap-2 mb-4">
        <button data-tour="sheet-switcher" onClick={() => setShowSheetSwitcher(true)}
          className="w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80">
          <SheetIcon />
        </button>
        <ProgramSelector programs={displayPrograms} selected={selectedProgram} onSelect={setSelectedProgram} />
        <ProgramActions
          canModify={canModifyProgram}
          onNewProgram={() => setProgramModal('new')}
          onRenameProgram={() => setProgramModal('rename')}
          onDeleteProgram={() => setConfirmDeleteProgram(true)}
        />
        <button onClick={handleRefresh} disabled={isRefreshing}
          className={`w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80 ${isRefreshing ? 'animate-spin' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
        <button onClick={() => setShowShare(true)}
          className="w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80">
          <ShareIcon />
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[20px] font-bold">Routines</h1>
        <div className="flex items-center rounded-[8px] border border-[#3a3a5a] overflow-hidden">
          {(['imperial', 'metric'] as const).map((sys) => (
            <button
              key={sys}
              onClick={() => setUnitSystem(sys)}
              className={`px-2.5 py-1 text-[11px] font-semibold active:opacity-80 ${
                unitSystem === sys ? 'bg-[#6c63ff] text-white' : 'text-gray-400'
              }`}
            >
              {sys === 'imperial' ? 'LB' : 'KG'}
            </button>
          ))}
        </div>
      </div>
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleExerciseDragEnd}
        onDragCancel={resetDrag}
      >
        {routineList
          // Never render editable cards while no program is actively selected
          // (the pre-reconcile window) — an unfiltered list once let a card
          // capture rows spanning programs and autosave the merge
          .filter(() => selectedProgram !== '' || programs.length === 0)
          // Hide the just-saved duplicate only once the draft actually saved —
          // hiding on a mere name match concealed the existing routine the
          // draft was about to collide with
          .filter((r) => !hasDraft || !draftSaved || r.name.trim().toLowerCase() !== draftName.trim().toLowerCase())
          .map((r, i) => (
            <SwipeableRow
              // Program-scoped key: when the program filter engages after the
              // initial render, a card must remount rather than keep editor
              // state captured from the unfiltered list
              key={`${r.program}||${r.name}`}
              className="mb-2 rounded-[10px]"
              actions={[{ label: 'Delete', icon: <RoutineTrashIcon />, color: '#c0392b', onClick: () => handleDeleteRoutine(r.name, r.rows) }]}
              leadingActions={[{ label: 'Duplicate', icon: <DuplicateIcon />, color: '#2f855a', onClick: () => handleDuplicateRoutine(r.name, r.rows) }]}
            >
              <ExpandableRoutineCard
                routine={r}
                spreadsheetId={spreadsheetId ?? ''}
                allRows={allRows}
                loggedExercises={loggedExercises}
                mutateCache={mutateCache}
                onStartWorkout={handleStartWorkout}
                initialExpanded={!!justCreatedName && r.name.trim().toLowerCase() === justCreatedName.trim().toLowerCase()}
                tourId={i === 0 ? 'routine-card' : undefined}
                weightUnit={weightUnit}
                getMax={getMax}
                onRegister={registerCard}
                onUnregister={unregisterCard}
                activeOverCardId={overCardId}
                activeSourceCardId={sourceCardId}
              />
            </SwipeableRow>
          ))}
        {hasDraft && spreadsheetId && (
          <DraftRoutineCard
            program={selectedProgram || programs[0] || ''}
            spreadsheetId={spreadsheetId}
            allRows={allRows}
            loggedExercises={loggedExercises}
            mutateCache={mutateCache}
            onSavedToList={handleDraftSaved}
            onNameChange={setDraftName}
            onDiscard={() => setHasDraft(false)}
            weightUnit={weightUnit}
            getMax={getMax}
            onRegister={registerCard}
            onUnregister={unregisterCard}
            activeOverCardId={overCardId}
            activeSourceCardId={sourceCardId}
          />
        )}
        <DragOverlay>
          {activeDrag && (
            <div
              style={{ width: activeDrag.width ?? undefined }}
              className="bg-[#2a2a4a] border border-[#6c63ff] rounded-[10px] px-3 py-2.5 shadow-xl shadow-black/50"
            >
              <div className="text-sm font-semibold text-white truncate">{activeDrag.exercise.exercise || 'Exercise'}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {activeDrag.exercise.sets.length} set{activeDrag.exercise.sets.length === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {displayPrograms.length === 0 && !hasDraft ? (
        <div className="text-center mt-12 px-6">
          <h2 className="text-[20px] font-bold mb-2">Build your first program</h2>
          <p className="text-gray-400 text-sm mb-6">
            A program is a collection of routines. Create one to start adding workouts.
          </p>
          <button
            onClick={() => setProgramModal('new')}
            className="w-full bg-[#6c63ff] rounded-[10px] py-3 text-center font-semibold active:opacity-80"
          >
            + New program
          </button>
        </div>
      ) : !hasDraft && (
        <button
          onClick={() => { setDraftName('New Routine'); setDraftSaved(false); setHasDraft(true) }}
          className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-3 text-[#6c63ff] text-sm font-semibold active:opacity-80"
        >
          + Add routine
        </button>
      )}
      {spreadsheetId && (
        <a
          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs text-[#6c63ff] mt-4 py-2"
        >
          Open Google Sheet
        </a>
      )}
      {showSheetSwitcher && (
        <SheetSwitcherModal onClose={() => setShowSheetSwitcher(false)} />
      )}
      {showShare && (
        <ShareCopyModal program={selectedProgram || programs[0] || ''} onClose={() => setShowShare(false)} />
      )}
      {confirmDiscard && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
            <p className="text-center font-bold mb-1">Workout in Progress</p>
            <p className="text-center text-gray-400 text-sm mb-4">
              Discard current workout and start {confirmDiscard.routine}?
            </p>
            <button onClick={handleConfirmDiscard}
              className="w-full bg-red-500 rounded-[10px] p-3 text-center font-semibold mb-2">
              Discard & Start New
            </button>
            <button onClick={() => setConfirmDiscard(null)}
              className="w-full p-3 text-center text-gray-400 font-semibold">Cancel</button>
          </div>
        </div>
      )}
      {programModal === 'new' && (
        <NamePromptModal
          title="New program"
          confirmLabel="Create"
          onConfirm={handleNewProgram}
          onCancel={() => setProgramModal(null)}
        />
      )}
      {programModal === 'rename' && (
        <NamePromptModal
          title="Rename program"
          initialValue={selectedProgram}
          confirmLabel="Rename"
          onConfirm={handleRenameProgram}
          onCancel={() => setProgramModal(null)}
        />
      )}
      {confirmDeleteProgram && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
            <p className="text-center font-bold mb-1">Delete program</p>
            <p className="text-center text-gray-400 text-sm mb-4">
              Delete "{selectedProgram}" and all its routines? Your workout history is not affected.
            </p>
            <button onClick={handleDeleteProgram}
              className="w-full bg-red-500 rounded-[10px] p-3 text-center font-semibold mb-2 active:opacity-80">
              Delete program
            </button>
            <button onClick={() => setConfirmDeleteProgram(false)}
              className="w-full p-3 text-center text-gray-400 font-semibold">Cancel</button>
          </div>
        </div>
      )}
      {routineUndo.pending && <UndoToast message={routineUndo.pending.message} onUndo={routineUndo.undo} />}
    </div>
  )
}
