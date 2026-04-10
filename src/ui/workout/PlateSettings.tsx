import { useState } from 'react'

const LBS_PLATE_OPTIONS = [55, 45, 35, 25, 15, 10, 5, 2.5]
// const KG_PLATE_OPTIONS = [25, 20, 15, 10, 5, 2.5, 1.25]

const COLOR_OPTIONS = [
  { name: 'red', value: 'rgba(239,68,68,0.35)' },
  { name: 'yellow', value: 'rgba(234,179,8,0.35)' },
  { name: 'green', value: 'rgba(34,197,94,0.35)' },
  { name: 'blue', value: 'rgba(108,99,255,0.35)' },
  { name: 'black', value: 'rgba(30,30,30,0.6)' },
  { name: 'white', value: 'rgba(220,220,220,0.4)' },
]

const COLOR_DISPLAY: Record<string, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#6c63ff',
  black: '#333',
  white: '#ddd',
}

const SETTINGS_KEY = 'repsheets_plate_settings'

export interface PlateSettingsData {
  availablePlates: number[]
  colorMap: Record<number, string>
}

const DEFAULT_LBS_COLORS: Record<number, string> = {
  55: 'rgba(239,68,68,0.35)',
  45: 'rgba(108,99,255,0.35)',
  35: 'rgba(234,179,8,0.35)',
  25: 'rgba(34,197,94,0.35)',
  15: 'rgba(239,68,68,0.35)',
  10: 'rgba(220,220,220,0.4)',
  5: 'rgba(30,30,30,0.6)',
  2.5: 'rgba(168,162,158,0.25)',
}

const DEFAULT_KG_COLORS: Record<number, string> = {
  25: 'rgba(239,68,68,0.35)',
  20: 'rgba(108,99,255,0.35)',
  15: 'rgba(234,179,8,0.35)',
  10: 'rgba(34,197,94,0.35)',
  5: 'rgba(220,220,220,0.4)',
  2.5: 'rgba(30,30,30,0.6)',
  1.25: 'rgba(168,162,158,0.25)',
}

export function loadPlateSettings(): PlateSettingsData {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    availablePlates: [...LBS_PLATE_OPTIONS],
    colorMap: { ...DEFAULT_LBS_COLORS, ...DEFAULT_KG_COLORS },
  }
}

function savePlateSettings(data: PlateSettingsData) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
}

interface PlateSettingsModalProps {
  onClose: () => void
  onChange: (data: PlateSettingsData) => void
}

export function PlateSettingsModal({ onClose, onChange }: PlateSettingsModalProps) {
  const [settings, setSettings] = useState(loadPlateSettings)
  const [editingPlate, setEditingPlate] = useState<number | null>(null)

  const togglePlate = (plate: number) => {
    setSettings((prev) => {
      const available = prev.availablePlates.includes(plate)
        ? prev.availablePlates.filter((p) => p !== plate)
        : [...prev.availablePlates, plate].sort((a, b) => b - a)
      return { ...prev, availablePlates: available }
    })
  }

  const setColor = (plate: number, color: string) => {
    setSettings((prev) => ({
      ...prev,
      colorMap: { ...prev.colorMap, [plate]: color },
    }))
    setEditingPlate(null)
  }

  const handleSave = () => {
    savePlateSettings(settings)
    onChange(settings)
    onClose()
  }

  const allPlates = LBS_PLATE_OPTIONS

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-center mb-1">Plate Settings</h2>
        <p className="text-xs text-gray-400 text-center mb-4">Toggle available plates and customize colors</p>

        <div className="space-y-2">
          {allPlates.map((plate) => {
            const enabled = settings.availablePlates.includes(plate)
            const color = settings.colorMap[plate] ?? 'rgba(108,99,255,0.35)'
            return (
              <div key={plate}>
                <div className="flex items-center gap-3 bg-[#2a2a4a] rounded-[10px] p-3">
                  <button onClick={() => togglePlate(plate)} className="flex-shrink-0">
                    {enabled ? (
                      <div className="w-5 h-5 bg-[#6c63ff] rounded flex items-center justify-center text-xs">✓</div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-[#444] rounded" />
                    )}
                  </button>
                  <span className={`text-sm font-semibold flex-1 ${enabled ? 'text-white' : 'text-gray-500'}`}>
                    {plate} lbs
                  </span>
                  {enabled && (
                    <button onClick={() => setEditingPlate(editingPlate === plate ? null : plate)}
                      className="w-6 h-6 rounded-full border border-[#555]"
                      style={{ backgroundColor: color }}
                    />
                  )}
                </div>

                {editingPlate === plate && (
                  <div className="flex gap-2 p-2 justify-center">
                    {COLOR_OPTIONS.map((c) => (
                      <button key={c.name} onClick={() => setColor(plate, c.value)}
                        className={`w-8 h-8 rounded-full border-2 ${color === c.value ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: COLOR_DISPLAY[c.name] }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button onClick={handleSave}
          className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm mt-4">
          Save
        </button>
        <button onClick={onClose}
          className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
          Cancel
        </button>
      </div>
    </div>
  )
}
