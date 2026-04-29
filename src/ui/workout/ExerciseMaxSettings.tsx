import { useState } from 'react'
import type { ExerciseSettings } from '../../types'

interface ExerciseMaxSettingsProps {
  exerciseName: string
  unit: string
  calculatedE1RM: number | null
  settings: ExerciseSettings
  onSave: (s: ExerciseSettings) => void
  onClose: () => void
}

export function ExerciseMaxSettings({
  exerciseName, unit, calculatedE1RM, settings, onSave, onClose,
}: ExerciseMaxSettingsProps) {
  const [ormInput, setOrmInput] = useState(settings.oneRepMax != null ? String(settings.oneRepMax) : '')
  const [tmInput, setTmInput] = useState(settings.tm != null ? String(Math.round(settings.tm * 100)) : '')

  const parsedOrm = ormInput.trim() ? Number(ormInput.trim()) : null
  const parsedTm = tmInput.trim() ? Number(tmInput.trim()) / 100 : null
  const effectiveOrm = (parsedOrm && parsedOrm > 0) ? parsedOrm : calculatedE1RM
  const effectiveTm = (parsedTm && parsedTm > 0 && parsedTm <= 1.5) ? parsedTm : 1.0
  const previewBase = effectiveOrm != null ? Math.round(effectiveOrm * effectiveTm / 5) * 5 : null
  const showPreview = previewBase != null && (ormInput.trim() || tmInput.trim())

  const settingsActive = !!(settings.oneRepMax || settings.tm)

  const handleSave = () => {
    const orm = parsedOrm && parsedOrm > 0 && !isNaN(parsedOrm) ? parsedOrm : undefined
    const tm = parsedTm && parsedTm > 0 && parsedTm <= 1.5 && !isNaN(parsedTm) ? parsedTm : undefined
    onSave({ oneRepMax: orm, tm })
  }

  const e1rmLabel = calculatedE1RM != null
    ? `Calculated E1RM: ${calculatedE1RM} ${unit}`
    : 'No E1RM from logs yet'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-bold text-center mb-1">{exerciseName}</p>
        <p className="text-xs text-gray-400 text-center mb-4">{e1rmLabel}</p>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">1-Rep Max (optional)</p>
            <p className="text-[10px] text-gray-500 mb-1.5">Overrides the calculated E1RM</p>
            <div className="flex items-center gap-2 bg-[#2a2a4a] rounded-[10px] px-3 py-2">
              <input
                type="text"
                inputMode="numeric"
                value={ormInput}
                onChange={(e) => setOrmInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. 285"
                className="flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-gray-600"
              />
              <span className="text-sm text-gray-500 flex-shrink-0">{unit}</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-0.5">Training Max %</p>
            <p className="text-[10px] text-gray-500 mb-1.5">Default 100%. Typical: 85–95%.</p>
            <div className="flex items-center gap-2 bg-[#2a2a4a] rounded-[10px] px-3 py-2">
              <input
                type="text"
                inputMode="numeric"
                value={tmInput}
                onChange={(e) => setTmInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. 90"
                className="flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-gray-600"
              />
              <span className="text-sm text-gray-500 flex-shrink-0">%</span>
            </div>
          </div>
        </div>

        {showPreview && (
          <p className="text-xs text-[#6c63ff] text-center mt-3">
            Effective base: {previewBase} {unit}
          </p>
        )}

        <button onClick={handleSave}
          className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold mt-4 active:opacity-80">
          Save
        </button>
        {settingsActive && (
          <button onClick={() => onSave({})}
            className="w-full bg-[#2a2a4a] rounded-[10px] p-3 text-center font-semibold mt-2 text-gray-300 active:opacity-80">
            Clear Settings
          </button>
        )}
        <button onClick={onClose}
          className="w-full p-3 text-center text-gray-500 font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )
}
