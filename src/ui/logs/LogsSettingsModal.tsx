import { useState } from 'react'

export interface LogsPaneConfig {
  id: string
  label: string
  enabled: boolean
}

const DEFAULT_PANES: LogsPaneConfig[] = [
  { id: 'calendar', label: 'Calendar', enabled: true },
  { id: 'progress', label: 'Progress', enabled: true },
  { id: 'records', label: 'Personal Records', enabled: true },
  { id: 'leaderboard', label: 'Leaderboard', enabled: true },
]

const STORAGE_KEY = 'repsheets_logs_panes'

export function loadPaneConfig(): LogsPaneConfig[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return DEFAULT_PANES
  try {
    const parsed = JSON.parse(saved) as LogsPaneConfig[]
    // Merge with defaults in case new panes were added
    const ids = parsed.map((p) => p.id)
    const merged = [...parsed]
    for (const def of DEFAULT_PANES) {
      if (!ids.includes(def.id)) merged.push(def)
    }
    return merged
  } catch {
    return DEFAULT_PANES
  }
}

function savePaneConfig(panes: LogsPaneConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(panes))
}

interface LogsSettingsModalProps {
  panes: LogsPaneConfig[]
  onChange: (panes: LogsPaneConfig[]) => void
  onClose: () => void
}

export function LogsSettingsModal({ panes, onChange, onClose }: LogsSettingsModalProps) {
  const [local, setLocal] = useState<LogsPaneConfig[]>([...panes])
  const [dragging, setDragging] = useState<number | null>(null)

  const togglePane = (id: string) => {
    setLocal((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p))
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    setLocal((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const moveDown = (index: number) => {
    if (index >= local.length - 1) return
    setLocal((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleSave = () => {
    savePaneConfig(local)
    onChange(local)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-center mb-1">Customize Logs</h2>
        <p className="text-xs text-gray-400 text-center mb-4">Toggle and reorder your dashboard panes</p>

        <div className="space-y-2">
          {local.map((pane, index) => (
            <div key={pane.id}
              className={`flex items-center gap-2 rounded-[10px] p-3 ${pane.enabled ? 'bg-[#2a2a4a]' : 'bg-[#2a2a4a]/50'}`}>

              {/* Toggle */}
              <button onClick={() => togglePane(pane.id)}
                className="flex-shrink-0">
                {pane.enabled ? (
                  <div className="w-5 h-5 bg-[#6c63ff] rounded flex items-center justify-center text-xs">✓</div>
                ) : (
                  <div className="w-5 h-5 border-2 border-[#444] rounded" />
                )}
              </button>

              {/* Label */}
              <span className={`flex-1 text-sm ${pane.enabled ? 'text-white' : 'text-gray-500'}`}>
                {pane.label}
              </span>

              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(index)}
                  className={`text-[10px] px-1 ${index === 0 ? 'text-[#2a2a4a]' : 'text-gray-500 active:text-white'}`}
                  disabled={index === 0}>
                  ▲
                </button>
                <button onClick={() => moveDown(index)}
                  className={`text-[10px] px-1 ${index === local.length - 1 ? 'text-[#2a2a4a]' : 'text-gray-500 active:text-white'}`}
                  disabled={index === local.length - 1}>
                  ▼
                </button>
              </div>
            </div>
          ))}
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
