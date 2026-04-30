import { useState, useRef } from 'react'

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

function DragHandle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3" y1="5" x2="13" y2="5" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="11" x2="13" y2="11" />
    </svg>
  )
}

interface LogsSettingsModalProps {
  panes: LogsPaneConfig[]
  onChange: (panes: LogsPaneConfig[]) => void
  onClose: () => void
}

export function LogsSettingsModal({ panes, onChange, onClose }: LogsSettingsModalProps) {
  const [local, setLocal] = useState<LogsPaneConfig[]>([...panes])
  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; from: number; to: number } | null>(null)
  const [dragState, setDragState] = useState<{ id: string; from: number; to: number } | null>(null)

  const togglePane = (id: string) => {
    setLocal((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p))
  }

  const getTargetIndex = (clientY: number): number => {
    if (!listRef.current) return 0
    const children = Array.from(listRef.current.children) as HTMLElement[]
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return children.length - 1
  }

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    const from = local.findIndex((p) => p.id === id)
    if (from === -1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const state = { id, from, to: from }
    dragRef.current = state
    setDragState(state)
  }

  const onDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    const to = getTargetIndex(e.clientY)
    if (to !== dragRef.current.to) {
      const next = { ...dragRef.current, to }
      dragRef.current = next
      setDragState(next)
    }
  }

  const endDrag = () => {
    if (!dragRef.current) return
    const { from, to } = dragRef.current
    if (from !== to) {
      setLocal((prev) => {
        const next = [...prev]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        return next
      })
    }
    dragRef.current = null
    setDragState(null)
  }

  const displayItems = dragState && dragState.from !== dragState.to
    ? (() => {
        const next = [...local]
        const [item] = next.splice(dragState.from, 1)
        next.splice(dragState.to, 0, item)
        return next
      })()
    : local

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

        <div className="space-y-2" ref={listRef}>
          {displayItems.map((pane) => (
            <div key={pane.id}
              className={`flex items-center gap-2 rounded-[10px] p-3 ${
                pane.enabled ? 'bg-[#2a2a4a]' : 'bg-[#2a2a4a]/50'
              } ${dragState?.id === pane.id ? 'opacity-40' : ''}`}>

              <button onClick={() => togglePane(pane.id)} className="flex-shrink-0">
                {pane.enabled ? (
                  <div className="w-5 h-5 bg-[#6c63ff] rounded flex items-center justify-center text-xs">✓</div>
                ) : (
                  <div className="w-5 h-5 border-2 border-[#444] rounded" />
                )}
              </button>

              <span className={`flex-1 text-sm ${pane.enabled ? 'text-white' : 'text-gray-500'}`}>
                {pane.label}
              </span>

              <button
                onPointerDown={(e) => startDrag(e, pane.id)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="text-gray-500 p-1 active:text-gray-300 cursor-grab"
                style={{ touchAction: 'none' }}
              >
                <DragHandle />
              </button>
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
