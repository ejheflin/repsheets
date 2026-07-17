/** A single row from the Routines tab in Google Sheets */
export interface RoutineRow {
  program: string
  routine: string
  exercise: string
  sets: string       // e.g. "5", "3a", "10"
  reps: number | null
  value: number | null
  pct?: number | null  // e.g. 80 when cell contains "80%", null otherwise
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
}

/** A set expanded from RoutineRow by the set inference engine */
export interface ExpandedSet {
  exercise: string
  setNumber: number
  reps: number | null
  value: number | null
  pct?: number | null
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
  unit: string
  completed: boolean
  isAdded: boolean      // true if user added this set (not in routine config)
  userEdited?: boolean  // true once the user typed a value — autofill refresh must not overwrite it
  rowIndex?: number     // 1-based sheet row in Log tab; only set in edit mode
  // Original exercise/set of the sheet row this edit-mode set came from —
  // rows are re-resolved by identity at save time, since collaborators can
  // shift row positions between load and save
  origIdentity?: { exercise: string; set: number }
  fromPct?: boolean     // true when value was computed from pct×1RM with no log history; cleared on manual edit
}

export interface EditModeState {
  originalDate: string  // YYYY-MM-DD — the session being edited
  editDate: string      // current date picker value (may differ from originalDate)
  athlete: string       // athlete string as stored in the log rows
  // Original identities of sets removed during the edit — resolved to sheet
  // rows and deleted on save
  deletedSets?: Array<{ exercise: string; set: number }>
}

/** Full state of an in-progress workout */
export interface WorkoutState {
  program: string
  routine: string
  exercises: WorkoutExercise[]
  startedAt: string     // ISO timestamp
  // Sheet the workout was started on — finishing always logs here, even if
  // the user switched sheets mid-workout. Optional: persisted pre-upgrade
  // workouts lack it and fall back to the active sheet.
  spreadsheetId?: string
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
