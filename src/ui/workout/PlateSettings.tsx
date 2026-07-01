import { useState } from 'react'

const LBS_PLATE_OPTIONS = [55, 45, 35, 25, 15, 10, 5, 2.5]
const KG_PLATE_OPTIONS = [25, 20, 15, 10, 5, 2.5, 1.25, 1]

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

export type UnitSystem = 'imperial' | 'metric'

export interface PlateInventory {
  availablePlates: number[]
  colorMap: Record<number, string>
  plateCounts: Record<number, number | null>
}

export interface PlateSettingsData {
  imperial: PlateInventory
  metric: PlateInventory
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
  1: 'rgba(168,162,158,0.25)',
}

function defaultImperial(): PlateInventory {
  return {
    availablePlates: LBS_PLATE_OPTIONS.filter((p) => p !== 55),
    colorMap: { ...DEFAULT_LBS_COLORS },
    plateCounts: {},
  }
}

function defaultMetric(): PlateInventory {
  return {
    availablePlates: KG_PLATE_OPTIONS.filter((p) => p !== 25 && p !== 1.25),
    colorMap: { ...DEFAULT_KG_COLORS },
    plateCounts: {},
  }
}

const optionsFor = (system: UnitSystem) => (system === 'metric' ? KG_PLATE_OPTIONS : LBS_PLATE_OPTIONS)
const unitLabelFor = (system: UnitSystem) => (system === 'metric' ? 'kg' : 'lbs')

export function loadPlateSettings(): PlateSettingsData {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Current shape: separate inventories per unit system.
      if (parsed.imperial || parsed.metric) {
        return {
          imperial: { ...defaultImperial(), ...parsed.imperial },
          metric: { ...defaultMetric(), ...parsed.metric },
        }
      }
      // Legacy flat (lb-centric) shape — migrate into the imperial slot.
      if (Array.isArray(parsed.availablePlates)) {
        return {
          imperial: {
            availablePlates: parsed.availablePlates,
            colorMap: { ...DEFAULT_LBS_COLORS, ...parsed.colorMap },
            plateCounts: parsed.plateCounts ?? {},
          },
          metric: defaultMetric(),
        }
      }
    }
  } catch {}
  return { imperial: defaultImperial(), metric: defaultMetric() }
}

function savePlateSettings(data: PlateSettingsData) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('plateSettingsChanged', { detail: data }))
}

interface PlateSettingsModalProps {
  system: UnitSystem
  onClose: () => void
  onChange: (data: PlateSettingsData) => void
}

export function PlateSettingsModal({ system, onClose, onChange }: PlateSettingsModalProps) {
  const [settings, setSettings] = useState(loadPlateSettings)
  const [editingPlate, setEditingPlate] = useState<number | null>(null)

  const inv = settings[system]
  const options = optionsFor(system)
  const unitLabel = unitLabelFor(system)

  const updateInv = (fn: (i: PlateInventory) => PlateInventory) => {
    setSettings((prev) => ({ ...prev, [system]: fn(prev[system]) }))
  }

  const togglePlate = (plate: number) => {
    updateInv((i) => ({
      ...i,
      availablePlates: i.availablePlates.includes(plate)
        ? i.availablePlates.filter((p) => p !== plate)
        : [...i.availablePlates, plate].sort((a, b) => b - a),
    }))
  }

  const setColor = (plate: number, color: string) => {
    updateInv((i) => ({ ...i, colorMap: { ...i.colorMap, [plate]: color } }))
    setEditingPlate(null)
  }

  const setPlateCount = (plate: number, count: number | null) => {
    updateInv((i) => ({ ...i, plateCounts: { ...i.plateCounts, [plate]: count } }))
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
        <h2 className="text-base font-bold text-center mb-1 text-white">Plate Settings</h2>
        <p className="text-xs text-gray-400 text-center mb-4">
          {unitLabel} plates — toggle, set counts, and customize colors
        </p>

        <div className="space-y-2">
          {options.map((plate) => {
            const enabled = inv.availablePlates.includes(plate)
            const color = inv.colorMap[plate] ?? 'rgba(108,99,255,0.35)'
            const count = inv.plateCounts[plate] ?? null
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
                    {plate} {unitLabel}
                  </span>
                  {enabled && (
                    <>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPlateCount(plate, count !== null && count <= 2 ? null : count !== null ? count - 2 : null)}
                          disabled={count === null}
                          className="w-6 h-6 rounded bg-[#1a1a2e] text-sm font-bold text-white flex items-center justify-center active:opacity-80 disabled:opacity-30"
                        >−</button>
                        <span className="text-xs font-semibold w-5 text-center tabular-nums text-white">
                          {count === null ? '∞' : count}
                        </span>
                        <button
                          onClick={() => setPlateCount(plate, count === null ? 2 : count + 2)}
                          className="w-6 h-6 rounded bg-[#1a1a2e] text-sm font-bold text-white flex items-center justify-center active:opacity-80"
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
