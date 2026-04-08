/** A single row from the Routines tab in Google Sheets */
export interface RoutineRow {
  program: string
  routine: string
  exercise: string
  sets: string       // e.g. "5", "3a", "10"
  reps: number | null
  value: number | null
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
}

/** A set expanded from RoutineRow by the set inference engine */
export interface ExpandedSet {
  exercise: string
  setNumber: number
  reps: number | null
  value: number | null
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
  unit: string
  completed: boolean
  isAdded: boolean      // true if user added this set (not in routine config)
}

/** Full state of an in-progress workout */
export interface WorkoutState {
  program: string
  routine: string
  exercises: WorkoutExercise[]
  startedAt: string     // ISO timestamp
}

/** Metadata about a Google Sheet that matches RepSheets schema */
export interface RepSheet {
  spreadsheetId: string
  name: string
  owner: string
  ownerEmail: string
}

/** User auth state */
export interface AuthUser {
  email: string
  name: string
  picture: string
  accessToken: string
}
