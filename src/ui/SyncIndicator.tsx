export type SyncStatus = 'synced' | 'pending' | 'offline'

const colors: Record<SyncStatus, string> = {
  synced: '#22c55e',
  pending: '#eab308',
  offline: '#888',
}

const labels: Record<SyncStatus, string> = {
  synced: 'synced',
  pending: 'tap to sync',
  offline: 'offline',
}

export function SyncIndicator({ status }: { status: SyncStatus }) {
  return (
    <span className="flex items-center gap-1 text-[9px]" style={{ color: colors[status] }}>
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${status === 'pending' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: colors[status] }}
      />
      {labels[status]}
    </span>
  )
}
