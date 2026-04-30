import { useRef } from 'react'

interface AthleteFilterProps {
  athletes: string[]
  selected: string[]
  onToggle: (id: string) => void
  onLongPressMe?: () => void
}

export function AthleteFilter({ athletes, selected, onToggle, onLongPressMe }: AthleteFilterProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  const startLongPress = () => {
    if (!onLongPressMe) return
    didLongPressRef.current = false
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      onLongPressMe()
    }, 600)
  }

  const cancelLongPress = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  const handleMeClick = () => {
    if (didLongPressRef.current) return
    onToggle('__me__')
  }

  const isActive = (id: string) => selected.includes(id)

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
      <button
        onClick={handleMeClick}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
          isActive('__me__') ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
        }`}>
        Me
      </button>
      <button onClick={() => onToggle('__all__')}
        className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
          isActive('__all__') ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
        }`}>
        Everyone
      </button>
      {athletes.map((a) => (
        <button key={a} onClick={() => onToggle(a)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
            isActive(a) ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
          }`}>
          {a}
        </button>
      ))}
    </div>
  )
}
