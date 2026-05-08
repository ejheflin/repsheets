import { useState, useEffect, useCallback } from 'react'
import { readExerciseSettings, writeExerciseSettings } from '../sheets/driveApi'
import type { ExerciseSettings } from '../types'

const localKey = (sheetId: string) => `repsheets_exsettings_${sheetId}`

function readLocal(sheetId: string | null): Record<string, ExerciseSettings> {
  if (!sheetId) return {}
  try {
    const raw = localStorage.getItem(localKey(sheetId))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function useExerciseSettings(sheetId: string | null) {
  const [settings, setSettings] = useState<Record<string, ExerciseSettings>>(() => readLocal(sheetId))

  useEffect(() => {
    if (!sheetId) { setSettings({}); return }
    setSettings(readLocal(sheetId))
    readExerciseSettings(sheetId).then((remote) => {
      setSettings((local) => {
        // local wins for conflicts — it reflects the most recent user action on this device
        const merged = { ...remote, ...local }
        try { localStorage.setItem(localKey(sheetId), JSON.stringify(merged)) } catch {}
        return merged
      })
    }).catch(() => {})
  }, [sheetId])

  const saveSettings = useCallback(async (exercise: string, next: ExerciseSettings) => {
    const prev = settings[exercise]
    const updated = { ...settings, [exercise]: next }
    setSettings(updated)
    if (sheetId) try { localStorage.setItem(localKey(sheetId), JSON.stringify(updated)) } catch {}
    if (!sheetId) return
    try {
      await writeExerciseSettings(sheetId, exercise, next)
    } catch {
      const reverted = { ...settings, [exercise]: prev ?? {} }
      setSettings(reverted)
      if (sheetId) try { localStorage.setItem(localKey(sheetId), JSON.stringify(reverted)) } catch {}
    }
  }, [sheetId, settings])

  return { settings, saveSettings }
}
