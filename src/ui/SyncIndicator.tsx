export type SyncStatus = 'synced' | 'pending' | 'offline'

const colors: Record<SyncStatus, string> = {
  synced: '#22c55e',
  pending: '#eab308',
  offline: '#888',
}

export function SyncIndicator({ status }: { status: SyncStatus }) {
  return (
    <span className="flex items-center gap-1 text-[9px]" style={{ color: colors[status] }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[status] }} />
      {status}
    </span>
  )
}
