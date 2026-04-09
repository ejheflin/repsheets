import type { RoutineRow, LogEntry } from '../types'

export const DEMO_USER = {
  email: 'demo@repsheets.app',
  name: 'Demo User',
  picture: '',
  accessToken: '',
}

export const DEMO_ROUTINES: RoutineRow[] = [
  { program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', sets: '5', reps: 3, value: 185, unit: 'lbs', notes: 'last set AMRAP' },
  { program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', sets: '3', reps: 10, value: 115, unit: 'lbs', notes: '' },
  { program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', sets: '3', reps: 15, value: 80, unit: 'lbs', notes: 'last set AMRAP' },
  { program: 'GZCLP', routine: 'Day A2', exercise: 'Overhead Press (T1)', sets: '5', reps: 3, value: 95, unit: 'lbs', notes: 'last set AMRAP' },
  { program: 'GZCLP', routine: 'Day A2', exercise: 'Deadlift (T2)', sets: '3', reps: 10, value: 185, unit: 'lbs', notes: '' },
  { program: 'GZCLP', routine: 'Day A2', exercise: 'Dumbbell Row (T3)', sets: '3', reps: 15, value: 35, unit: 'lbs', notes: 'last set AMRAP' },
  { program: 'GZCLP', routine: 'Day B1', exercise: 'Bench Press (T1)', sets: '5', reps: 3, value: 135, unit: 'lbs', notes: 'last set AMRAP' },
  { program: 'GZCLP', routine: 'Day B1', exercise: 'Squat (T2)', sets: '3', reps: 10, value: 135, unit: 'lbs', notes: '' },
  { program: 'GZCLP', routine: 'Day B1', exercise: 'Lat Pulldown (T3)', sets: '3', reps: 15, value: 80, unit: 'lbs', notes: 'last set AMRAP' },
]

// Sample log entries spanning a few weeks
const today = new Date()
function daysAgo(n: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export const DEMO_LOGS: LogEntry[] = [
  // 2 weeks ago — Day A1
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 1, reps: 3, value: 175, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 2, reps: 3, value: 175, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 3, reps: 3, value: 175, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 4, reps: 3, value: 175, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 5, reps: 5, value: 175, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 1, reps: 10, value: 105, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 2, reps: 10, value: 105, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 3, reps: 10, value: 105, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 1, reps: 15, value: 70, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 2, reps: 15, value: 70, unit: 'lbs', notes: '' },
  { date: daysAgo(14), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 3, reps: 18, value: 70, unit: 'lbs', notes: '' },

  // 12 days ago — Day A2
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Overhead Press (T1)', set: 1, reps: 3, value: 85, unit: 'lbs', notes: '' },
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Overhead Press (T1)', set: 2, reps: 3, value: 85, unit: 'lbs', notes: '' },
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Overhead Press (T1)', set: 3, reps: 3, value: 85, unit: 'lbs', notes: '' },
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Overhead Press (T1)', set: 4, reps: 3, value: 85, unit: 'lbs', notes: '' },
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Overhead Press (T1)', set: 5, reps: 4, value: 85, unit: 'lbs', notes: '' },
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Deadlift (T2)', set: 1, reps: 10, value: 175, unit: 'lbs', notes: '' },
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Deadlift (T2)', set: 2, reps: 10, value: 175, unit: 'lbs', notes: '' },
  { date: daysAgo(12), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A2', exercise: 'Deadlift (T2)', set: 3, reps: 10, value: 175, unit: 'lbs', notes: '' },

  // 7 days ago — Day A1 (progression)
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 1, reps: 3, value: 185, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 2, reps: 3, value: 185, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 3, reps: 3, value: 185, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 4, reps: 3, value: 185, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 5, reps: 6, value: 185, unit: 'lbs', notes: 'PR!' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 1, reps: 10, value: 110, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 2, reps: 10, value: 110, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 3, reps: 10, value: 110, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 1, reps: 15, value: 75, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 2, reps: 15, value: 75, unit: 'lbs', notes: '' },
  { date: daysAgo(7), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 3, reps: 20, value: 75, unit: 'lbs', notes: '' },

  // 5 days ago — Day B1
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Bench Press (T1)', set: 1, reps: 3, value: 130, unit: 'lbs', notes: '' },
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Bench Press (T1)', set: 2, reps: 3, value: 130, unit: 'lbs', notes: '' },
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Bench Press (T1)', set: 3, reps: 3, value: 130, unit: 'lbs', notes: '' },
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Bench Press (T1)', set: 4, reps: 3, value: 130, unit: 'lbs', notes: '' },
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Bench Press (T1)', set: 5, reps: 5, value: 130, unit: 'lbs', notes: '' },
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Squat (T2)', set: 1, reps: 10, value: 135, unit: 'lbs', notes: '' },
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Squat (T2)', set: 2, reps: 10, value: 135, unit: 'lbs', notes: '' },
  { date: daysAgo(5), athlete: 'Demo U', program: 'GZCLP', routine: 'Day B1', exercise: 'Squat (T2)', set: 3, reps: 10, value: 135, unit: 'lbs', notes: '' },

  // 2 days ago — Day A1 (more progression)
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 1, reps: 3, value: 190, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 2, reps: 3, value: 190, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 3, reps: 3, value: 190, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 4, reps: 3, value: 190, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Squat (T1)', set: 5, reps: 4, value: 190, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 1, reps: 10, value: 115, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 2, reps: 10, value: 115, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Bench Press (T2)', set: 3, reps: 10, value: 115, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 1, reps: 15, value: 80, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 2, reps: 15, value: 80, unit: 'lbs', notes: '' },
  { date: daysAgo(2), athlete: 'Demo U', program: 'GZCLP', routine: 'Day A1', exercise: 'Lat Pulldown (T3)', set: 3, reps: 20, value: 80, unit: 'lbs', notes: '' },
]
