import { useState, useEffect, useCallback } from 'react'
import { ProgramSelector } from './ProgramSelector'
import { RoutineCard } from './RoutineCard'
import { useRoutines } from '../../data/useRoutines'
import { useWorkout } from '../../data/useWorkout'
import { useAuth } from '../../auth/useAuth'
import { AuthExpiredError } from '../../auth/authFetch'
import { getPreference, setPreference } from '../../data/db'
import { useSheetContext } from '../../data/useSheetContext'
import { SheetSwitcherModal } from '../SheetSwitcherModal'
import { ShareCopyModal } from '../sharing/ShareModal'
import { fetchLogEntriesWithRows, type IndexedLogEntry } from '../../sheets/sheetsApi'
import type { RoutineRow } from '../../types'

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

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
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

  const setSelectedProgram = useCallback((program: string) => {
    setSelectedProgramState(program)
    setPreference('activeProgram', program)
  }, [])
  const { routineList, programs, isLoading, refresh } = useRoutines(selectedProgram || null)
  const { workout, startWorkout, discardWorkout, loadPastWorkout } = useWorkout()
  const { spreadsheetId } = useSheetContext()
  const { user, login } = useAuth()
  const [showSheetSwitcher, setShowSheetSwitcher] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState<{
    program: string; routine: string; rows: RoutineRow[]
  } | null>(null)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [confirmEditSession, setConfirmEditSession] = useState<RecentSession | null>(null)

  // Load saved preference once on mount
  useEffect(() => {
    getPreference('activeProgram').then((saved) => {
      setSavedProgram(saved ?? null)
      setPrefLoaded(true)
    })
  }, [])

  // Once both preference and programs are available, reconcile
  useEffect(() => {
    if (!prefLoaded || programs.length === 0) return
    if (selectedProgram && programs.includes(selectedProgram)) return

    if (savedProgram && programs.includes(savedProgram)) {
      setSelectedProgramState(savedProgram)
    } else {
      setSelectedProgram(programs[0])
    }
  }, [prefLoaded, programs, savedProgram, selectedProgram, setSelectedProgram])

  useEffect(() => {
    if (!spreadsheetId || !user || !navigator.onLine) return
    fetchLogEntriesWithRows(spreadsheetId)
      .then((entries) => {
        const athlete = (() => {
          const parts = user.name.trim().split(/\s+/)
          if (parts.length < 2) return parts[0] || ''
          return `${parts[0]} ${parts[parts.length - 1][0]}`
        })()
        const sessionMap = new Map<string, RecentSession>()
        for (const entry of entries) {
          if (entry.athlete !== athlete) continue
          const key = `${entry.date}||${entry.program}||${entry.routine}`
          if (!sessionMap.has(key)) {
            sessionMap.set(key, { date: entry.date, athlete, program: entry.program, routine: entry.routine, exerciseCount: 0, entries: [] })
          }
          const session = sessionMap.get(key)!
          session.entries.push(entry)
          const exercises = new Set(session.entries.map((e) => e.exercise))
          session.exerciseCount = exercises.size
        }
        const sorted = [...sessionMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
        setRecentSessions(sorted)
      })
      .catch(() => {})
  }, [spreadsheetId, user])

  const handleEditSession = useCallback(async (session: RecentSession) => {
    if (workout) {
      await discardWorkout()
    }
    await loadPastWorkout(session.entries, session.program, session.routine, session.athlete, session.date)
    setConfirmEditSession(null)
    onStartWorkout()
  }, [workout, discardWorkout, loadPastWorkout, onStartWorkout])

  const handleRoutineTap = (routine: { name: string; rows: RoutineRow[] }) => {
    if (workout) {
      setConfirmDiscard({ program: selectedProgram, routine: routine.name, rows: routine.rows })
      return
    }
    startWorkout(selectedProgram, routine.name, routine.rows)
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
        <ProgramSelector programs={programs} selected={selectedProgram} onSelect={setSelectedProgram} />
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
      <h1 className="text-[20px] font-bold mb-3">Routines</h1>
      {routineList.length === 0 ? (
        <p className="text-gray-500 text-sm">No routines found for this program.</p>
      ) : (
        routineList.map((r, i) => (
          <RoutineCard key={r.name} name={r.name} exercises={r.exercises}
            onTap={() => handleRoutineTap(r)} tourId={i === 0 ? 'routine-card' : undefined} />
        ))
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
      {recentSessions.length > 0 && (
        <div className="border-t border-white/10 mt-4 pt-4">
          <h2 className="text-[13px] font-semibold text-gray-400 mb-2">Recent Workouts</h2>
          {recentSessions.map((s) => (
            <button
              key={`${s.date}||${s.routine}`}
              onClick={() => setConfirmEditSession(s)}
              className="w-full flex items-center justify-between bg-[#2a2a4a] rounded-[10px] px-4 py-3 mb-2 active:opacity-80"
            >
              <div className="text-left">
                <div className="text-[14px] font-semibold">{s.routine}</div>
                <div className="text-[11px] text-gray-400">{formatSessionDate(s.date)} · {s.exerciseCount} exercise{s.exerciseCount !== 1 ? 's' : ''}</div>
              </div>
              <span className="text-gray-500"><PencilIcon /></span>
            </button>
          ))}
        </div>
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
      {confirmEditSession && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="w-full bg-[#2a2a4a] rounded-t-2xl p-6 pb-8">
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
              onClick={() => setConfirmEditSession(null)}
              className="w-full text-gray-400 py-3 text-[15px] active:opacity-60">
              Log New Workout Instead
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
