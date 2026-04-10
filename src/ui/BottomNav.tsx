import { RoutinesIcon, WorkoutIcon, LogsIcon } from './icons'

export type TabId = 'routines' | 'workout' | 'logs'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; Icon: typeof RoutinesIcon }[] = [
  { id: 'routines', label: 'Routines', Icon: RoutinesIcon },
  { id: 'workout', label: 'Workout', Icon: WorkoutIcon },
  { id: 'logs', label: 'Logs', Icon: LogsIcon },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] border-t border-[#2a2a4a]">
      <div className="flex justify-around py-2 pb-5 max-w-lg mx-auto">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => onTabChange(id)} className="flex flex-col items-center gap-1">
            <Icon active={activeTab === id} />
            <span className="text-[10px] font-semibold" style={{ color: activeTab === id ? '#6c63ff' : '#555' }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
