import { useState } from 'react'

const LBS_PLATE_OPTIONS = [55, 45, 35, 25, 15, 10, 5, 2.5]

const LBS_TO_KG_LABEL: Partial<Record<number, string>> = {
  55: '25 kg',
  45: '20 kg',
  35: '15 kg',
  25: '10 kg',
  10: '5 kg',
  5: '2.5 kg',
  2.5: '1 kg',
}

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
  plateCounts: Record<number, number | null>
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
  1: 'rgba(168,162,158,0.25)',
}

export function loadPlateSettings(): PlateSettingsData {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const availablePlates = (parsed.availablePlates ?? []).map((p: number) => p === 1.25 ? 1 : p)
      const colorMap = { ...parsed.colorMap }
      if (colorMap[1.25] !== undefined) { colorMap[1] = colorMap[1.25]; delete colorMap[1.25] }
      const { maxPlates: _m, ...rest } = parsed
      return { plateCounts: {}, ...rest, availablePlates, colorMap }
    }
  } catch {}
  return {
    availablePlates: LBS_PLATE_OPTIONS.filter((p) => p !== 55),
    colorMap: { ...DEFAULT_LBS_COLORS, ...DEFAULT_KG_COLORS },
    plateCounts: {},
  }
}

function savePlateSettings(data: PlateSettingsData) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('plateSettingsChanged', { detail: data }))
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

  const setPlateCount = (plate: number, count: number | null) => {
    setSettings((prev) => ({
      ...prev,
      plateCounts: { ...prev.plateCounts, [plate]: count },
    }))
  }

  const handleClose = () => {
    savePlateSettings(settings)
    onChange(settings)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={handleClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-center mb-1">Plate Settings</h2>
        <p className="text-xs text-gray-400 text-center mb-4">Toggle plates, set counts, and customize colors</p>

        <div className="space-y-2">
          {LBS_PLATE_OPTIONS.map((plate) => {
            const enabled = settings.availablePlates.includes(plate)
            const color = settings.colorMap[plate] ?? 'rgba(108,99,255,0.35)'
            const kgLabel = LBS_TO_KG_LABEL[plate]
            const count = settings.plateCounts[plate] ?? null
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
                    {plate} lbs{kgLabel ? ` / ${kgLabel}` : ''}
                  </span>
                  {enabled && (
                    <>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPlateCount(plate, count !== null && count <= 2 ? null : count !== null ? count - 2 : null)}
                          disabled={count === null}
                          className="w-6 h-6 rounded bg-[#1a1a2e] text-sm font-bold flex items-center justify-center active:opacity-80 disabled:opacity-30"
                        >−</button>
                        <span className="text-xs font-semibold w-5 text-center tabular-nums">
                          {count === null ? '∞' : count}
                        </span>
                        <button
                          onClick={() => setPlateCount(plate, count === null ? 2 : count + 2)}
                          className="w-6 h-6 rounded bg-[#1a1a2e] text-sm font-bold flex items-center justify-center active:opacity-80"
                        >+</button>
                      </div>
                      <button
                        onClick={() => setEditingPlate(editingPlate === plate ? null : plate)}
                        className="w-6 h-6 rounded-full border border-[#555] flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    </>
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

      </div>
    </div>
  )
}
