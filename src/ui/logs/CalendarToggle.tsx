export type CalendarColorMode = 'attendance' | 'routine'

interface CalendarToggleProps {
  mode: CalendarColorMode
  onToggle: (mode: CalendarColorMode) => void
}

export function CalendarToggle({ mode, onToggle }: CalendarToggleProps) {
  return (
    <div className="flex bg-[#1a1a2e] rounded-md p-0.5 text-[10px]">
      <button
        onClick={() => onToggle('attendance')}
        className={`px-3 py-1 rounded transition ${mode === 'attendance' ? 'bg-[#2a2a4a] text-white' : 'text-gray-500'}`}
      >Attendance</button>
      <button
        onClick={() => onToggle('routine')}
        className={`px-3 py-1 rounded transition ${mode === 'routine' ? 'bg-[#2a2a4a] text-white' : 'text-gray-500'}`}
      >By Routine</button>
    </div>
  )
}
