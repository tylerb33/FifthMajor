import { Cloud, CloudOff, Loader2, AlertCircle } from 'lucide-react'
import { useSyncStore } from '@/stores/syncStore'
import { cn } from '@/lib/utils'

export function SyncIndicator() {
  const { status, pendingCount, isOnline } = useSyncStore()

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-orange-600">
        <CloudOff className="h-4 w-4" />
        <span className="text-xs">Offline</span>
      </div>
    )
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-blue-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Syncing{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span className="text-xs">Sync error</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Cloud className="h-4 w-4" />
        <span className="text-xs">{pendingCount} pending</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-green-600')}>
      <Cloud className="h-4 w-4" />
      <span className="text-xs">Synced</span>
    </div>
  )
}
