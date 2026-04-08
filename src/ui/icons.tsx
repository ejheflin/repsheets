interface IconProps {
  active: boolean
  size?: number
}

const activeColor = '#6c63ff'
const inactiveColor = '#555'

export function RoutinesIcon({ active, size = 22 }: IconProps) {
  const color = active ? activeColor : inactiveColor
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={active ? color : 'none'} fillOpacity={active ? 0.2 : 0}
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="13" y2="16" />
    </svg>
  )
}

export function WorkoutIcon({ active, size = 22 }: IconProps) {
  const color = active ? activeColor : inactiveColor
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={active ? color : 'none'} fillOpacity={active ? 0.2 : 0}
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="8" width="3" height="8" rx="0.5" />
      <rect x="4.5" y="6" width="3" height="12" rx="0.5" />
      <rect x="16.5" y="6" width="3" height="12" rx="0.5" />
      <rect x="20" y="8" width="3" height="8" rx="0.5" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" />
    </svg>
  )
}

export function LogsIcon({ active, size = 22 }: IconProps) {
  const color = active ? activeColor : inactiveColor
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={active ? color : 'none'} fillOpacity={active ? 0.2 : 0}
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 18 8 10 12 14 16 6 20 12" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  )
}
