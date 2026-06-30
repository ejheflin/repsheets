export interface EditableSet {
  reps: number | null
  repsMax?: number | null
  repsOpen?: boolean
  value: number | null   // absolute load
  pct: number | null     // percentage
  rpe?: number
  rir?: number
}
export interface EditableExercise {
  id: string  // transient editor-only id for dnd-kit stable keys; not serialized
  exercise: string
  unit: string
  notes: string
  basis: '1rm' | 'tm'
  loadMode: 'lb' | 'pct' | 'rpe' | 'rir'
  supersetGroup: string | null
  sets: EditableSet[]
}
export interface EditableRoutine {
  program: string
  routine: string
  exercises: EditableExercise[]
}

/** A single row from the Routines tab in Google Sheets */
export interface RoutineRow {
  program: string
  routine: string
  exercise: string
  sets: string       // e.g. "5", "3a", "10"
  reps: number | null
  repsMax?: number | null
  repsOpen?: boolean
  value: number | null
  pct?: number | null  // e.g. 80 when cell contains "80%", null otherwise
  basis?: '1rm' | 'tm'   // present only when pct is a percentage; absent = 1rm
  rpe?: number
  rir?: number
  unit: string
  notes: string
}

/** A single row in the Log tab — one per set */
export interface LogEntry {
  date: string        // YYYY-MM-DD
  athlete: string     // Google email
  program: string
  routine: string
  exercise: string
  set: number
  reps: number
  value: number | null
  unit: string
  notes: string
  pct?: number | null // programmed % of 1RM (col K), null for absolute-weight sets
  achievedRpe?: number | null // performed RPE, parsed from a notes-cell token (@8)
  achievedRir?: number | null // performed RIR, parsed from a notes-cell token (2RIR)
}

/** A set expanded from RoutineRow by the set inference engine */
export interface ExpandedSet {
  exercise: string
  setNumber: number
  reps: number | null
  value: number | null
  pct?: number | null
  basis?: '1rm' | 'tm'  // basis for pct; absent = 1rm
  rpe?: number | null
  rir?: number | null
  unit: string
  notes: string
  supersetGroup: string | null  // "a", "b", etc. or null
}

/** An exercise grouping for the workout UI */
export interface WorkoutExercise {
  exercise: string
  sets: WorkoutSet[]
  notes: string         // from routine config
  userNotes: string     // athlete's per-workout notes
  supersetGroup: string | null
  isExpanded: boolean
}

/** A single set in an active workout */
export interface WorkoutSet {
  setNumber: number
  reps: number | null
  value: number | null
  pct?: number | null   // target percentage of 1RM, null if absolute weight
  basis?: '1rm' | 'tm'  // basis for pct; absent = 1rm (drives TM-prefill in max settings)
  rpe?: number | null   // target RPE, resolves to a weight via raw e1rm
  rir?: number | null   // target RIR, resolves to a weight via raw e1rm
  achievedRpe?: number | null  // RPE actually performed; defaults to prescribed when untouched
  achievedRir?: number | null  // RIR actually performed; defaults to prescribed when untouched
  unit: string
  completed: boolean
  isAdded: boolean      // true if user added this set (not in routine config)
  rowIndex?: number     // 1-based sheet row in Log tab; only set in edit mode
  fromPct?: boolean     // true when value was computed from pct×1RM with no log history; cleared on manual edit
}

export interface EditModeState {
  originalDate: string  // YYYY-MM-DD — the session being edited
  editDate: string      // current date picker value (may differ from originalDate)
  athlete: string       // athlete string as stored in the log rows
}

/** Full state of an in-progress workout */
export interface WorkoutState {
  program: string
  routine: string
  exercises: WorkoutExercise[]
  startedAt: string     // ISO timestamp
  editMode?: EditModeState
}

/** Metadata about a Google Sheet that matches RepSheets schema */
export interface RepSheet {
  spreadsheetId: string
  name: string
  owner: string
  ownerEmail: string
  isOwner: boolean
  isTemplate: boolean  // true if _meta tab has type=shared_template
}

/** Per-exercise 1RM and training max overrides */
export interface ExerciseSettings {
  oneRepMax?: number  // user-defined; replaces calculated E1RM
  tm?: number         // decimal: 0.9 = 90%; absent means 1.0
}

/** User auth state */
export interface AuthUser {
  email: string
  name: string
  picture: string
  accessToken: string
  scopeVersion?: number
}
