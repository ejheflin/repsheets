import { useState, useEffect, useCallback } from 'react'
import { readExerciseSettings, writeExerciseSettings } from '../sheets/driveApi'
import type { ExerciseSettings } from '../types'

export function useExerciseSettings(sheetId: string | null) {
  const [settings, setSettings] = useState<Record<string, ExerciseSettings>>({})

  useEffect(() => {
    if (!sheetId) { setSettings({}); return }
    readExerciseSettings(sheetId).then(setSettings).catch(() => {})
  }, [sheetId])

  const saveSettings = useCallback(async (exercise: string, next: ExerciseSettings) => {
    const prev = settings[exercise]
    setSettings((s) => ({ ...s, [exercise]: next }))
    if (!sheetId) return
    try {
      await writeExerciseSettings(sheetId, exercise, next)
    } catch {
      setSettings((s) => ({ ...s, [exercise]: prev ?? {} }))
    }
  }, [sheetId, settings])

  return { settings, saveSettings }
}
